import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { P0RestHandlers } from '@mustbeviral/contracts';

import { createCoreApp, defaultV1Dependencies } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { createSupabaseRequestDependencies } from '../../src/composition/supabase';
import type { RequestDependencyFactory } from '../../src/routes/v1';

const actor = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  authenticationMethod: 'supabase_jwt' as const,
};
const workspaceId = '10000000-0000-4000-8000-000000000001';
const configuredBindings = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
  SUPABASE_JWT_AUDIENCE: 'authenticated',
  PROVIDER_RUNS_ENABLED: 'false',
} as unknown as PlatformBindings;

function headers(): Readonly<Record<string, string>> {
  return {
    accept: 'application/json, text/event-stream',
    authorization: 'Bearer verified-caller-jwt',
    'content-type': 'application/json',
    'mcp-protocol-version': '2025-11-25',
    'x-request-id': 'request-composition-1',
  };
}

describe('production Supabase composition', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('keeps the existing fail-closed fallback when required bindings are missing', async () => {
    const missingBindings: CoreBindings = {
      MEDIA_BUCKET: configuredBindings.MEDIA_BUCKET,
      SERVICE_NAME: configuredBindings.SERVICE_NAME,
      SERVICE_GENERATION: configuredBindings.SERVICE_GENERATION,
      SUPABASE_URL: 'https://project.supabase.co',
    };
    expect(
      createSupabaseRequestDependencies(missingBindings, 'verified-caller-jwt', actor, vi.fn()),
    ).toBeNull();

    const requestFactory: RequestDependencyFactory = { create: async () => null };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });
    const response = await app.request(
      `/v1/workspaces/${workspaceId}`,
      { headers: headers() },
      {} as PlatformBindings,
    );
    expect(response.status).toBe(403);
  });

  it('forwards the verified JWT into every composed Data API request', async () => {
    const privilegedSecret = 'fixture-privileged-secret';
    const legacyPrivilegedSecret = 'fixture-legacy-privileged-secret';
    const privilegedBindings = {
      ...configuredBindings,
      [['SUPABASE', 'SECRET', 'KEY'].join('_')]: privilegedSecret,
      [['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_')]: legacyPrivilegedSecret,
    } as unknown as PlatformBindings;
    const authorizationHeaders: string[] = [];
    const apiKeyHeaders: string[] = [];
    const fetchImplementation = vi.fn(
      async (request: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const requestHeaders = new Headers(init?.headers);
        authorizationHeaders.push(requestHeaders.get('authorization') ?? '');
        apiKeyHeaders.push(requestHeaders.get('apikey') ?? '');
        const url = String(request);
        if (url.includes('workspace_memberships')) {
          return Response.json({ workspace_id: workspaceId });
        }
        if (url.includes('workspaces')) {
          return Response.json({
            id: workspaceId,
            name: 'Staging workspace',
            slug: 'staging-workspace',
            status: 'active',
            created_by: actor.actorId,
            created_at: '2026-07-20T00:00:00.000Z',
            updated_at: '2026-07-20T00:00:00.000Z',
            daily_spend_cap_micros: 0,
            per_run_spend_cap_micros: 0,
          });
        }
        throw new Error(`Unexpected fixture request: ${url}`);
      },
    );
    const requestFactory: RequestDependencyFactory = {
      create: async ({ bindings, callerJwt, actor: verifiedActor }) =>
        createSupabaseRequestDependencies(bindings, callerJwt, verifiedActor, fetchImplementation),
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });
    const response = await app.request(
      `/v1/workspaces/${workspaceId}`,
      { headers: headers() },
      privilegedBindings,
    );

    expect(response.status).toBe(200);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    expect(authorizationHeaders).toEqual([
      'Bearer verified-caller-jwt',
      'Bearer verified-caller-jwt',
    ]);
    expect(apiKeyHeaders).toEqual(['sb_publishable_fixture', 'sb_publishable_fixture']);
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(privilegedSecret);
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(legacyPrivilegedSecret);
  });

  it('normalizes create-workspace input before the composed port calls the RPC', async () => {
    const fetchImplementation = vi.fn(
      async (request: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        expect(String(request)).toBe('https://project.supabase.co/rest/v1/rpc/create_workspace');
        expect(new Headers(init?.headers).get('authorization')).toBe('Bearer verified-caller-jwt');
        expect(JSON.parse(String(init?.body))).toEqual({
          p_name: 'GB-01 Vanilla Oat Cold Brew',
          p_slug: 'gb-01-vanilla-oat-cold-brew',
          p_idempotency_key: 'launch-pack-gb-01-create-workspace',
          p_request_id: 'request-composition-1',
        });
        return Response.json({ role: 'owner', workspace_id: workspaceId });
      },
    );
    const requestFactory: RequestDependencyFactory = {
      create: async ({ bindings, callerJwt, actor: verifiedActor }) =>
        createSupabaseRequestDependencies(bindings, callerJwt, verifiedActor, fetchImplementation),
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });

    const response = await app.request(
      '/v1/workspaces',
      {
        method: 'POST',
        headers: {
          ...headers(),
          'idempotency-key': 'launch-pack-gb-01-create-workspace',
        },
        body: JSON.stringify({ name: 'GB-01 Vanilla Oat Cold Brew' }),
      },
      configuredBindings,
    );

    expect(response.status).toBe(201);
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
    expect(await response.json()).toMatchObject({
      data: { role: 'owner', workspace_id: workspaceId },
    });
  });

  it('replays direct project creation and rejects changed-body key reuse', async () => {
    let storedProject: Readonly<Record<string, unknown>> | null = null;
    const fetchImplementation = vi.fn(
      async (request: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const url = String(request);
        if (url.includes('workspace_memberships')) {
          return Response.json({ workspace_id: workspaceId });
        }
        if (url.includes('/projects?select=*') && init?.method === 'POST') {
          const input = JSON.parse(String(init.body)) as Readonly<Record<string, unknown>>;
          if (storedProject !== null) {
            return Response.json({ code: '23505', message: 'duplicate key' }, { status: 409 });
          }
          storedProject = {
            ...input,
            status: 'active',
            created_at: '2026-07-20T00:00:00.000Z',
            updated_at: '2026-07-20T00:00:00.000Z',
          };
          return Response.json([storedProject]);
        }
        if (url.includes('/projects?') && init?.method === 'GET' && storedProject !== null) {
          return Response.json(storedProject);
        }
        throw new Error(`Unexpected fixture request: ${url}`);
      },
    );
    const requestFactory: RequestDependencyFactory = {
      create: async ({ bindings, callerJwt, actor: verifiedActor }) =>
        createSupabaseRequestDependencies(bindings, callerJwt, verifiedActor, fetchImplementation),
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });
    const request = (name: string) =>
      app.request(
        `/v1/workspaces/${workspaceId}/projects`,
        {
          method: 'POST',
          headers: { ...headers(), 'idempotency-key': 'project-key-1' },
          body: JSON.stringify({ name }),
        },
        configuredBindings,
      );

    const first = await request('Launch project');
    const replay = await request('Launch project');
    const mismatch = await request('Changed project');

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(await replay.json()).toEqual(await first.json());
    expect(mismatch.status).toBe(409);
  });

  it('dispatches REST and MCP through the same request-composed handler map', async () => {
    const getCanvasContext = vi.fn(async (input: unknown) => {
      void input;
      return { status: 'ok' as const, canvas_id: 'canvas-1' };
    });
    const handlers: P0RestHandlers = {
      ...defaultV1Dependencies.handlers,
      get_canvas_context: getCanvasContext,
    };
    const requestFactory: RequestDependencyFactory = {
      create: async () => ({
        handlers,
        workspaces: { resolve: async () => workspaceId },
      }),
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });

    const rest = await app.request(
      '/v1/canvases/canvas-1',
      { headers: headers() },
      configuredBindings,
    );
    const mcp = await app.request(
      '/mcp',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'get_canvas_context', arguments: { canvas_id: 'canvas-1' } },
        }),
      },
      configuredBindings,
    );

    expect(rest.status).toBe(200);
    expect(mcp.status).toBe(200);
    expect(getCanvasContext).toHaveBeenCalledTimes(2);
    expect(getCanvasContext.mock.calls[0]?.[0]).toMatchObject({
      context: { workspace_id: workspaceId, actor_id: actor.actorId },
    });
    expect(getCanvasContext.mock.calls[1]?.[0]).toMatchObject({
      context: { workspace_id: workspaceId, actor_id: actor.actorId },
    });
  });
});
