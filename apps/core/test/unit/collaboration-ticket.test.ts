import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiErrorEnvelopeSchema,
  P0_OPERATION_RESPONSE_SCHEMAS,
  type P0RestHandlers,
} from '@mustbeviral/contracts';

import {
  COLLABORATION_TICKET_MAX_TTL_SECONDS,
  verifyCollaborationTicket,
} from '../../../../packages/collaboration/src/ticket';
import { createCoreApp, defaultV1Dependencies } from '../../src/app';
import type { RequestAuthenticator } from '../../src/auth/authenticate';
import { createSupabaseRequestDependencies } from '../../src/composition/supabase';
import type { RequestDependencyFactory } from '../../src/routes/v1';

const SECRET = 'core-unit-test-collaboration-secret-00000000';
const actor = {
  actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  authenticationMethod: 'supabase_jwt' as const,
};
const workspaceId = '10000000-0000-4000-8000-000000000001';
const canvasId = '20000000-0000-4000-8000-000000000002';
const CALLER_JWT = 'verified-caller-jwt';

function bindings(secret: string | null = SECRET): PlatformBindings {
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    SUPABASE_JWT_AUDIENCE: 'authenticated',
    PROVIDER_RUNS_ENABLED: 'false',
    ...(secret === null ? {} : { COLLABORATION_TICKET_SECRET: secret }),
  } as unknown as PlatformBindings;
}

const pgrstNoRows = () =>
  Response.json(
    { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' },
    { status: 406 },
  );

type Visibility = Readonly<{ canvasVisible: boolean; member: boolean }>;

function supabaseFixture(visibility: Visibility) {
  const calls: { url: string; authorization: string | null }[] = [];
  const fetchImplementation = vi.fn(
    async (request: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(request instanceof Request ? request.url : request);
      const headers = new Headers(request instanceof Request ? request.headers : init?.headers);
      calls.push({ url, authorization: headers.get('authorization') });
      if (url.includes('/canvases?') && url.includes('select=workspace_id')) {
        return visibility.canvasVisible && url.includes(`id=eq.${canvasId}&`)
          ? Response.json({ workspace_id: workspaceId })
          : pgrstNoRows();
      }
      if (url.includes('/workspace_memberships?')) {
        return visibility.member ? Response.json({ id: 'membership-1' }) : pgrstNoRows();
      }
      if (url.includes(`/canvases?id=eq.${canvasId}&workspace_id=eq.${workspaceId}`)) {
        return Response.json({
          id: canvasId,
          workspace_id: workspaceId,
          project_id: '30000000-0000-4000-8000-000000000003',
          name: 'Launch canvas',
          head_revision_id: null,
          created_by: actor.actorId,
          created_at: '2026-09-16T10:00:00.000Z',
          updated_at: '2026-09-16T10:00:00.000Z',
        });
      }
      throw new Error(`Unexpected Supabase request: ${url}`);
    },
  );
  const requestFactory: RequestDependencyFactory = {
    create: async ({ bindings: requestBindings, callerJwt, actor: verifiedActor }) =>
      createSupabaseRequestDependencies(
        requestBindings,
        callerJwt,
        verifiedActor,
        fetchImplementation as unknown as typeof fetch,
      ),
  };
  return { calls, fetchImplementation, requestFactory };
}

function appWith(requestFactory: RequestDependencyFactory) {
  return createCoreApp({
    ...defaultV1Dependencies,
    jwt: {
      verify: async (token) => {
        if (token !== CALLER_JWT) throw new Error('rejected');
        return actor;
      },
    },
    requestFactory,
  });
}

function ticketRequest(
  headers: Readonly<Record<string, string>> = { authorization: `Bearer ${CALLER_JWT}` },
) {
  return {
    method: 'POST',
    headers: { 'x-request-id': 'request-collab-0001', ...headers },
  };
}

describe('POST /v1/canvases/:id/collaboration-tickets', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('returns 401 without a session and never reaches Supabase', async () => {
    const fixture = supabaseFixture({ canvasVisible: true, member: true });
    const app = appWith(fixture.requestFactory);
    for (const headers of [
      {},
      { authorization: 'Bearer not-a-valid-session' },
      { authorization: 'Basic abc' },
    ]) {
      const response = await app.request(
        `/v1/canvases/${canvasId}/collaboration-tickets`,
        ticketRequest(headers),
        bindings(),
      );
      expect(response.status).toBe(401);
      const body = ApiErrorEnvelopeSchema.parse(await response.json());
      expect(body.error.code).toBe('UNAUTHENTICATED');
    }
    expect(fixture.fetchImplementation).not.toHaveBeenCalled();
  });

  it('refuses scoped API keys and OAuth tokens even with canvas scopes', async () => {
    const fixture = supabaseFixture({ canvasVisible: true, member: true });
    for (const authenticationMethod of ['api_key', 'oauth_token'] as const) {
      const authenticator: RequestAuthenticator = {
        authenticate: async () => ({
          actor: {
            actorId: actor.actorId,
            authenticationMethod,
            workspaceId,
            scopes: ['canvas:read', 'canvas:write'],
          },
        }),
        authorizeOperation: () => true,
      };
      const app = createCoreApp({
        ...defaultV1Dependencies,
        authenticator,
        requestFactory: fixture.requestFactory,
      });
      const response = await app.request(
        `/v1/canvases/${canvasId}/collaboration-tickets`,
        ticketRequest({ authorization: 'Bearer mbv_sk_fixture' }),
        // A privileged key is configured, so without the browser-session rule the scoped
        // credential would resolve the canvas and pass membership: the refusal below is that rule.
        {
          ...bindings(),
          SUPABASE_SECRET_KEY: 'sb_secret_fixture',
        } as unknown as PlatformBindings,
      );
      expect(response.status).toBe(403);
      expect(ApiErrorEnvelopeSchema.parse(await response.json()).error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'This operation requires a browser session.',
      });
    }
    expect(fixture.fetchImplementation).not.toHaveBeenCalled();
  });

  it('denies a caller who cannot see the canvas without revealing whether it exists', async () => {
    const hidden = supabaseFixture({ canvasVisible: false, member: false });
    const hiddenResponse = await appWith(hidden.requestFactory).request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      ticketRequest(),
      bindings(),
    );
    const missing = supabaseFixture({ canvasVisible: false, member: false });
    const missingResponse = await appWith(missing.requestFactory).request(
      `/v1/canvases/00000000-0000-4000-8000-00000000dead/collaboration-tickets`,
      ticketRequest(),
      bindings(),
    );
    for (const response of [hiddenResponse, missingResponse]) {
      expect(response.status).toBe(403);
      const text = await response.text();
      expect(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error).toMatchObject({
        code: 'FORBIDDEN',
        message: 'Access to this resource is forbidden.',
      });
      expect(text).not.toContain('ticket"');
    }
    expect(hidden.calls.every((call) => call.authorization === `Bearer ${CALLER_JWT}`)).toBe(true);
    expect(hidden.calls.some((call) => call.url.includes('/workspace_memberships?'))).toBe(false);
  });

  it('denies a caller whose workspace membership is not active', async () => {
    const fixture = supabaseFixture({ canvasVisible: true, member: false });
    const response = await appWith(fixture.requestFactory).request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      ticketRequest(),
      bindings(),
    );
    expect(response.status).toBe(403);
    const text = await response.text();
    expect(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error.code).toBe('FORBIDDEN');
    expect(text).not.toContain('ticket"');
    const membership = fixture.calls.find((call) => call.url.includes('/workspace_memberships?'));
    expect(membership?.url).toContain(`user_id=eq.${actor.actorId}`);
    expect(membership?.url).toContain('status=eq.active');
    expect(membership?.url).toContain('revoked_at=is.null');
  });

  it('re-checks membership for every ticket, so a removed member cannot reconnect', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const visibility = { canvasVisible: true, member: true };
    const fixture = supabaseFixture(visibility);
    const app = appWith(fixture.requestFactory);

    // The first connection and a reconnect while still a member both receive tickets.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const issued = await app.request(
        `/v1/canvases/${canvasId}/collaboration-tickets`,
        ticketRequest(),
        bindings(),
      );
      expect(issued.status).toBe(200);
    }
    const membershipChecks = () =>
      fixture.calls.filter((call) => call.url.includes('/workspace_memberships?')).length;
    expect(membershipChecks()).toBe(2);

    // The member is removed (or the workspace deleted) while a socket is open. When the Worker
    // ends that socket at its lifetime, the client's reconnect asks for a new ticket and is refused
    // with a non-retryable error, so the client stops instead of retrying.
    visibility.member = false;
    const refused = await app.request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      ticketRequest(),
      bindings(),
    );
    expect(refused.status).toBe(403);
    const text = await refused.text();
    expect(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error).toMatchObject({
      code: 'FORBIDDEN',
      retryable: false,
    });
    expect(text).not.toContain('ticket"');
    expect(membershipChecks()).toBe(3);

    visibility.canvasVisible = false;
    const deleted = await app.request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      ticketRequest(),
      bindings(),
    );
    expect(deleted.status).toBe(403);
    expect(await deleted.text()).not.toContain('ticket"');
  });

  it('issues a verifiable ticket bound to the authenticated caller and the canvas', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const fixture = supabaseFixture({ canvasVisible: true, member: true });
    const before = Math.floor(Date.now() / 1000);
    const response = await appWith(fixture.requestFactory).request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      ticketRequest({ authorization: `Bearer ${CALLER_JWT}`, 'idempotency-key': 'ignored' }),
      bindings(),
    );
    const after = Math.floor(Date.now() / 1000);

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = (await response.json()) as {
      data: {
        canvas_id: string;
        ticket: string;
        expires_at: string;
        actor: { actor_id: string; display_name: string; color: string };
      };
      meta: { request_id: string };
    };
    expect(P0_OPERATION_RESPONSE_SCHEMAS.create_collaboration_ticket.safeParse(body).success).toBe(
      true,
    );
    expect(body.data.canvas_id).toBe(canvasId);
    expect(body.data.actor.actor_id).toBe(actor.actorId);
    expect(body.data.actor.display_name).not.toContain('@');
    expect(body.data.actor.color).toMatch(/^#[0-9a-f]{6}$/u);

    const verification = await verifyCollaborationTicket(SECRET, body.data.ticket, {
      canvasId,
      nowEpochSeconds: after,
    });
    expect(verification.valid).toBe(true);
    if (!verification.valid) throw new Error('ticket did not verify');
    expect(verification.actor).toEqual(body.data.actor);
    expect(verification.claims.aud).toBe('collaboration');
    expect(verification.claims.iat).toBeGreaterThanOrEqual(before);
    expect(verification.claims.exp - verification.claims.iat).toBeLessThanOrEqual(
      COLLABORATION_TICKET_MAX_TTL_SECONDS,
    );
    const expiresAt = Date.parse(body.data.expires_at) / 1000;
    expect(expiresAt).toBe(verification.claims.exp);
    expect(expiresAt).toBeGreaterThan(before);
    expect(expiresAt).toBeLessThanOrEqual(after + COLLABORATION_TICKET_MAX_TTL_SECONDS);

    expect(
      await verifyCollaborationTicket(SECRET, body.data.ticket, {
        canvasId: '20000000-0000-4000-8000-00000000ffff',
        nowEpochSeconds: after,
      }),
    ).toEqual({ valid: false, reason: 'canvas_mismatch' });
    expect(
      (
        await verifyCollaborationTicket(
          'some-other-secret-that-is-32-chars-long',
          body.data.ticket,
          {
            canvasId,
            nowEpochSeconds: after,
          },
        )
      ).valid,
    ).toBe(false);

    // Every Supabase read ran as the caller, so RLS decided visibility.
    expect(fixture.calls.length).toBe(3);
    expect(fixture.calls.every((call) => call.authorization === `Bearer ${CALLER_JWT}`)).toBe(true);
    // The ticket never appears in logs.
    expect(JSON.stringify(log.mock.calls)).not.toContain(body.data.ticket);
  });

  it('fails closed with 503 and no ticket when the signing secret is missing or too short', async () => {
    // null omits the binding entirely.
    for (const secret of [null, '', 'short']) {
      const fixture = supabaseFixture({ canvasVisible: true, member: true });
      const response = await appWith(fixture.requestFactory).request(
        `/v1/canvases/${canvasId}/collaboration-tickets`,
        ticketRequest(),
        bindings(secret),
      );
      const text = await response.text();
      expect(response.status, `secret=${String(secret)} body=${text}`).toBe(503);
      expect(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error).toMatchObject({
        code: 'INTERNAL_ERROR',
        message: 'Collaboration is not configured.',
      });
      expect(text).not.toContain('ticket"');
    }
  });

  it('rejects an unexpected request body', async () => {
    const handlers = { create_collaboration_ticket: vi.fn() } as unknown as P0RestHandlers;
    const app = createCoreApp({
      ...defaultV1Dependencies,
      handlers,
      jwt: { verify: async () => actor },
      workspaces: { resolve: async () => workspaceId },
    });
    const response = await app.request(
      `/v1/canvases/${canvasId}/collaboration-tickets`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${CALLER_JWT}`, 'content-type': 'application/json' },
        body: JSON.stringify({ actor_id: 'someone-else' }),
      },
      bindings(),
    );
    expect(response.status).toBe(400);
    expect(handlers.create_collaboration_ticket).not.toHaveBeenCalled();
  });
});
