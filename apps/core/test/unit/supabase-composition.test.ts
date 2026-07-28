import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiErrorEnvelopeSchema, type P0RestHandlers } from '@mustbeviral/contracts';

import { createCoreApp, defaultV1Dependencies } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { createSupabaseRequestDependencies } from '../../src/composition/supabase';
import type { RequestDependencyFactory } from '../../src/routes/v1';
import { V1_ROUTE_TABLE, type V1Operation } from '../../src/routes/v1-table';

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

// No authenticated V1 operation is intentionally denied workspace resolution today. If a future
// route must be denied before its handler, add it here with a non-empty security/product reason.
const WORKSPACE_RESOLUTION_DENY_LIST: Readonly<Partial<Record<V1Operation, string>>> = {};

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

  it('resolves every non-webhook V1 route or requires a documented denial reason', async () => {
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (
        url.includes('/workspace_memberships?') ||
        ['/projects?', '/canvases?', '/quotes?', '/runs?', '/artifacts?'].some((path) =>
          url.includes(path),
        )
      ) {
        return Response.json({ workspace_id: workspaceId });
      }
      throw new Error(`Unexpected workspace-resolution request: ${url}`);
    });
    const scoped = createSupabaseRequestDependencies(
      configuredBindings,
      'verified-caller-jwt',
      actor,
      fetchImplementation,
    );
    expect(scoped).not.toBeNull();
    if (scoped === null) throw new Error('Expected configured Supabase dependencies');

    for (const [operation, reason] of Object.entries(WORKSPACE_RESOLUTION_DENY_LIST)) {
      expect(reason.trim(), `${operation} deny-list reason`).not.toBe('');
      expect(
        V1_ROUTE_TABLE.some(
          (route) => route.operation === operation && route.auth === 'supabase_jwt',
        ),
        `${operation} deny-list entry`,
      ).toBe(true);
    }

    for (const route of V1_ROUTE_TABLE) {
      if (route.auth === 'fal_signature') continue;
      const resolved = await scoped.workspaces.resolve({
        actor,
        operation: route.operation,
        pathId: route.path.includes(':id') ? `${route.operation}-resource` : undefined,
        body:
          route.operation === 'create_artifact_upload'
            ? { project_id: 'artifact-upload-project' }
            : {},
      });
      const denialReason = WORKSPACE_RESOLUTION_DENY_LIST[route.operation];
      if (denialReason === undefined) {
        expect(resolved, route.operation).not.toBeNull();
      } else {
        expect(resolved, `${route.operation}: ${denialReason}`).toBeNull();
      }
    }
  });

  it('lets an authorized member reach get_receipt through run-scoped resolution', async () => {
    const getReceipt = vi.fn(async () => ({ status: 'ok' as const, receipt: 'fixture' }));
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/runs?id=eq.run-member&select=workspace_id')) {
        return Response.json({ workspace_id: workspaceId });
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    });
    const requestFactory: RequestDependencyFactory = {
      create: async ({ bindings, callerJwt, actor: verifiedActor }) => {
        const scoped = createSupabaseRequestDependencies(
          bindings,
          callerJwt,
          verifiedActor,
          fetchImplementation,
        );
        if (scoped === null) return null;
        return {
          ...scoped,
          handlers: { ...scoped.handlers, get_receipt: getReceipt },
        };
      },
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });

    const response = await app.request(
      '/v1/runs/run-member/receipt',
      { headers: headers() },
      configuredBindings,
    );

    expect(response.status).toBe(200);
    expect(getReceipt).toHaveBeenCalledOnce();
    expect(getReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          actor_id: actor.actorId,
          workspace_id: workspaceId,
        }),
        run_id: 'run-member',
      }),
    );
  });

  it('refuses get_receipt for a caller outside the run workspace', async () => {
    const getReceipt = vi.fn(async () => ({ status: 'ok' as const }));
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/runs?id=eq.run-other-workspace&select=workspace_id')) {
        return Response.json(
          { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
          { status: 406 },
        );
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    });
    const requestFactory: RequestDependencyFactory = {
      create: async ({ bindings, callerJwt, actor: verifiedActor }) => {
        const scoped = createSupabaseRequestDependencies(
          bindings,
          callerJwt,
          verifiedActor,
          fetchImplementation,
        );
        if (scoped === null) return null;
        return {
          ...scoped,
          handlers: { ...scoped.handlers, get_receipt: getReceipt },
        };
      },
    };
    const app = createCoreApp({
      ...defaultV1Dependencies,
      jwt: { verify: async () => actor },
      requestFactory,
    });

    const response = await app.request(
      '/v1/runs/run-other-workspace/receipt',
      { headers: headers() },
      configuredBindings,
    );

    expect(response.status).toBe(403);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe('FORBIDDEN');
    expect(getReceipt).not.toHaveBeenCalled();
  });

  it('reaches the artifact-upload stub through project scope and reports model unavailable', async () => {
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/projects?id=eq.project-upload&select=workspace_id')) {
        return Response.json({ workspace_id: workspaceId });
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    });
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
      '/v1/artifacts/uploads',
      {
        method: 'POST',
        headers: { ...headers(), 'idempotency-key': 'artifact-upload-1' },
        body: JSON.stringify({
          project_id: 'project-upload',
          content_type: 'image/png',
          byte_size: 2_048,
          sha256: 'a'.repeat(64),
          purpose: 'reference',
        }),
      },
      configuredBindings,
    );

    expect(response.status).toBe(503);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe(
      'MODEL_UNAVAILABLE',
    );
  });

  it('allows a member to explain a global model route without treating the model id as a tenant id', async () => {
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/workspace_memberships?')) {
        return Response.json({ workspace_id: workspaceId });
      }
      if (url.includes('/model_routes?')) {
        return Response.json({ id: 'fal-image-route', capability: 'image_generation' });
      }
      throw new Error(`Unexpected fixture request: ${url}`);
    });
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
      '/v1/models/fal-image-route',
      { headers: headers() },
      configuredBindings,
    );

    expect(response.status).toBe(200);
    expect(fetchImplementation.mock.calls.map(([request]) => String(request))).toEqual([
      expect.stringContaining('/workspace_memberships?'),
      expect.stringContaining('/model_routes?'),
    ]);
  });

  it('requires active workspace membership before reading the global model catalog', async () => {
    const fetchImplementation = vi.fn(async (request: Parameters<typeof fetch>[0]) => {
      const url = String(request);
      if (url.includes('/workspace_memberships?')) {
        return Response.json(
          { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
          { status: 406 },
        );
      }
      throw new Error(`A non-member must not reach the model catalog: ${url}`);
    });
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
      '/v1/models/fal-image-route',
      { headers: headers() },
      configuredBindings,
    );

    expect(response.status).toBe(403);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe('FORBIDDEN');
    expect(fetchImplementation).toHaveBeenCalledOnce();
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
