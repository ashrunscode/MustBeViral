import { createHmac } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiErrorEnvelopeSchema,
  ApiSuccessEnvelopeSchema,
  P0_REST_OPERATIONS,
  type P0HandlerResult,
  type P0RestHandlers,
} from '@mustbeviral/contracts';

import { FalWebhookVerifier } from '../../../../packages/provider/src/webhook';
import { createCoreApp } from '../../src/app';
import type { V1Dependencies } from '../../src/routes/v1';
import { V1_ROUTE_TABLE } from '../../src/routes/v1-table';

const workerBindings = {
  PROVIDER_RUNS_ENABLED: 'true',
  FAL_KEY: 'test-provider-key',
} as unknown as PlatformBindings;

function handlersWith(
  operation?: keyof P0RestHandlers,
  result: P0HandlerResult = { status: 'ok' },
): P0RestHandlers {
  return Object.fromEntries(
    P0_REST_OPERATIONS.map((name) => [
      name,
      async () => (name === operation ? result : { status: 'ok' as const, operation: name }),
    ]),
  ) as unknown as P0RestHandlers;
}

function dependencies(overrides: Partial<V1Dependencies> = {}): V1Dependencies {
  return {
    handlers: handlersWith(),
    jwt: {
      verify: async (token) => {
        if (token !== 'valid-jwt') throw new Error('rejected');
        return { actorId: 'user-1', authenticationMethod: 'supabase_jwt' };
      },
    },
    workspaces: { resolve: async () => 'workspace-1' },
    ...overrides,
  };
}

const requestBodies: Partial<Record<keyof P0RestHandlers, Readonly<Record<string, unknown>>>> = {
  create_workspace: { name: 'Launch workspace' },
  create_project: { name: 'Summer launch' },
  create_canvas: {},
  apply_canvas_patch: { expected_revision_id: 'revision-1', reason: 'Fixture patch', patch: {} },
  validate_graph: {},
  quote_run: { expected_revision_id: 'revision-1' },
  start_run: { confirmed: true, confirmation_token: 'confirmation-token-1' },
  cancel_run: { reason: 'Operator requested cancellation' },
  create_artifact_upload: {
    project_id: 'project-1',
    content_type: 'image/png',
    byte_size: 2048,
    sha256: 'a'.repeat(64),
    purpose: 'reference',
  },
  approve_artifacts: {
    approvals: [{ artifact_id: 'artifact-1', accessibility_description: 'Fixture description.' }],
  },
  create_export: { artifact_ids: ['artifact-1'], format: 'zip' },
};

async function requestRoute(
  app: ReturnType<typeof createCoreApp>,
  operation: keyof P0RestHandlers,
  bodyOverride?: Readonly<Record<string, unknown>>,
  headersOverride: Readonly<Record<string, string>> = {},
) {
  const route = V1_ROUTE_TABLE.find((candidate) => candidate.operation === operation);
  if (route === undefined) throw new Error(`Missing fixture for ${operation}`);
  const body = bodyOverride ?? requestBodies[operation];
  return app.request(
    `/v1${route.path.replace(':id', operation.includes('quote') ? 'quote-1' : 'resource-1')}`,
    {
      method: route.method,
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
        'idempotency-key': 'idem-1',
        'x-request-id': 'request-v1-0001',
        ...headersOverride,
      },
      ...(route.method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
    },
    workerBindings,
  );
}

describe('P0 /v1 route boundary', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('maps all 18 authenticated operations through the shared handler table', async () => {
    const calls: string[] = [];
    const handlers = Object.fromEntries(
      P0_REST_OPERATIONS.map((operation) => [
        operation,
        async () => {
          calls.push(operation);
          return { status: 'ok' as const, operation, total_micros: 12_345_678n };
        },
      ]),
    ) as unknown as P0RestHandlers;
    const app = createCoreApp(dependencies({ handlers }));

    for (const route of V1_ROUTE_TABLE.filter((candidate) => candidate.auth === 'supabase_jwt')) {
      const response = await requestRoute(app, route.operation);
      expect(response.status, route.operation).toBe(
        [
          'create_workspace',
          'create_project',
          'create_canvas',
          'start_run',
          'create_artifact_upload',
          'create_export',
        ].includes(route.operation)
          ? 201
          : 200,
      );
      const body = ApiSuccessEnvelopeSchema.parse(await response.json());
      expect(body.meta.request_id).toBe('request-v1-0001');
      if (route.operation === 'create_workspace') {
        expect(body.data).toMatchObject({ total_micros: '12345678' });
      }
    }
    expect(calls).toEqual(
      V1_ROUTE_TABLE.filter((route) => route.auth === 'supabase_jwt').map(
        (route) => route.operation,
      ),
    );
  });

  it('rejects missing authentication and cross-workspace authorization', async () => {
    const app = createCoreApp(dependencies({ workspaces: { resolve: async () => null } }));
    const unauthenticated = await requestRoute(app, 'get_run', undefined, { authorization: '' });
    expect(unauthenticated.status).toBe(401);
    expect(ApiErrorEnvelopeSchema.parse(await unauthenticated.json()).error.code).toBe(
      'UNAUTHENTICATED',
    );

    const forbidden = await requestRoute(app, 'get_run');
    expect(forbidden.status).toBe(403);
    expect(ApiErrorEnvelopeSchema.parse(await forbidden.json()).error.code).toBe('FORBIDDEN');
  });

  it('uses shared schemas for validation and requires idempotency on mutations', async () => {
    const app = createCoreApp(dependencies());
    const invalid = await requestRoute(app, 'start_run', { confirmed: false });
    expect(invalid.status).toBe(400);
    expect(ApiErrorEnvelopeSchema.parse(await invalid.json()).error.code).toBe('VALIDATION_FAILED');

    const missingKey = await requestRoute(app, 'create_workspace', undefined, {
      'idempotency-key': '',
    });
    expect(missingKey.status).toBe(400);
    expect(ApiErrorEnvelopeSchema.parse(await missingKey.json()).error.code).toBe(
      'VALIDATION_FAILED',
    );
  });

  it.each([
    [{ status: 'forbidden' }, 403, 'FORBIDDEN'],
    [{ status: 'not_found' }, 404, 'NOT_FOUND'],
    [{ status: 'conflict', reason: 'revision' }, 409, 'REVISION_CONFLICT'],
    [{ status: 'conflict', reason: 'idempotency' }, 409, 'IDEMPOTENCY_CONFLICT'],
    [{ status: 'conflict', reason: 'quote_stale' }, 409, 'QUOTE_STALE'],
    [{ status: 'conflict', reason: 'run_state' }, 409, 'RUN_NOT_CANCELABLE'],
    [{ status: 'expired_quote' }, 409, 'QUOTE_EXPIRED'],
    [{ status: 'cap_exceeded', tier: 'available_balance' }, 402, 'INSUFFICIENT_BALANCE'],
    [{ status: 'cap_exceeded', tier: 'run' }, 409, 'BUDGET_EXCEEDED'],
    [{ status: 'graph_invalid' }, 422, 'GRAPH_INVALID'],
    [{ status: 'provider_unavailable' }, 503, 'MODEL_UNAVAILABLE'],
  ] as const)('maps result union %o to safe HTTP %s', async (result, status, code) => {
    const app = createCoreApp(
      dependencies({ handlers: handlersWith('get_run', result as P0HandlerResult) }),
    );
    const response = await requestRoute(app, 'get_run');
    expect(response.status).toBe(status);
    const error = ApiErrorEnvelopeSchema.parse(await response.json()).error;
    expect(error.code).toBe(code);
    if (result.status === 'conflict') {
      expect(error.details).toEqual({ reason: result.reason });
    } else {
      expect(error.details).toBeUndefined();
    }
  });

  it('preserves safe revision and graph details required by client recovery states', async () => {
    const conflictApp = createCoreApp(
      dependencies({
        handlers: handlersWith('apply_canvas_patch', {
          status: 'conflict',
          reason: 'revision',
          actual: 'revision-current',
        }),
      }),
    );
    const conflictResponse = await requestRoute(conflictApp, 'apply_canvas_patch');
    expect(ApiErrorEnvelopeSchema.parse(await conflictResponse.json()).error.details).toEqual({
      reason: 'revision',
      actual: 'revision-current',
    });

    const graphApp = createCoreApp(
      dependencies({
        handlers: handlersWith('apply_canvas_patch', {
          status: 'graph_invalid',
          issues: [{ code: 'CYCLE', message: 'The canvas contains a cycle.' }],
        }),
      }),
    );
    const graphResponse = await requestRoute(graphApp, 'apply_canvas_patch');
    expect(ApiErrorEnvelopeSchema.parse(await graphResponse.json()).error.details).toEqual({
      issues: [{ code: 'CYCLE', message: 'The canvas contains a cycle.' }],
    });
  });

  it('passes canonical inputs and idempotency keys for replay and mismatch detection', async () => {
    let executions = 0;
    const records = new Map<string, { fingerprint: string; result: P0HandlerResult }>();
    const handlers = handlersWith();
    const createWorkspace = vi.fn(async (input: unknown): Promise<P0HandlerResult> => {
      const command = input as { idempotency_key: string; name: string };
      const fingerprint = command.name;
      const existing = records.get(command.idempotency_key);
      if (existing?.fingerprint === fingerprint) return existing.result;
      if (existing !== undefined) return { status: 'conflict', reason: 'idempotency' };
      executions += 1;
      const result = { status: 'ok' as const, workspace_id: `workspace-${executions}` };
      records.set(command.idempotency_key, { fingerprint, result });
      return result;
    });
    const app = createCoreApp(
      dependencies({ handlers: { ...handlers, create_workspace: createWorkspace } }),
    );

    const first = await requestRoute(app, 'create_workspace');
    const replay = await requestRoute(app, 'create_workspace');
    const mismatch = await requestRoute(app, 'create_workspace', { name: 'Changed body' });

    expect(first.status).toBe(201);
    expect(replay.status).toBe(201);
    expect(executions).toBe(1);
    expect(mismatch.status).toBe(409);
    expect(ApiErrorEnvelopeSchema.parse(await mismatch.json()).error.code).toBe(
      'IDEMPOTENCY_CONFLICT',
    );
  });

  it('fails closed before run dispatch when provider gates or credentials are absent', async () => {
    const handler = vi.fn(async () => ({ status: 'ok' as const }));
    const app = createCoreApp(
      dependencies({ handlers: { ...handlersWith(), start_run: handler } }),
    );
    const response = await app.request(
      '/v1/quotes/quote-1/runs',
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-jwt',
          'content-type': 'application/json',
          'idempotency-key': 'idem-1',
          'x-request-id': 'request-v1-0002',
        },
        body: JSON.stringify(requestBodies.start_run),
      },
      { PROVIDER_RUNS_ENABLED: 'false' } as unknown as PlatformBindings,
    );
    expect(response.status).toBe(503);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error.code).toBe(
      'MODEL_UNAVAILABLE',
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it('mounts fal raw-body signature verification and durable event dedup', async () => {
    const secret = 'fixture-webhook-secret';
    const claimed = new Set<string>();
    const processed = new Set<string>();
    const dedup = {
      claim: async (_provider: 'fal', eventId: string) => {
        if (processed.has(eventId)) return 'duplicate' as const;
        if (claimed.has(eventId)) return 'in_progress' as const;
        claimed.add(eventId);
        return 'claimed' as const;
      },
      markProcessed: async (_provider: 'fal', eventId: string) => {
        if (!claimed.has(eventId)) return false;
        processed.add(eventId);
        return true;
      },
      release: async (_provider: 'fal', eventId: string) => {
        if (processed.has(eventId)) return false;
        return claimed.delete(eventId);
      },
    };
    const verifier = new FalWebhookVerifier(secret, dedup, { nowEpochSeconds: () => 2_000 });
    const webhookHandler = vi.fn(async () => ({ status: 'ok' as const, accepted: true }));
    const app = createCoreApp(
      dependencies({
        handlers: { ...handlersWith(), ingest_fal_webhook: webhookHandler },
        falWebhook: {
          verifyAndMap: (request) => verifier.verifyAndMap(request),
          markProcessed: dedup.markProcessed,
          release: dedup.release,
        },
      }),
    );
    const payload = JSON.stringify({ request_id: 'fal-job-1', status: 'IN_PROGRESS' });
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    const headers = {
      'content-type': 'application/json',
      'x-fal-event-id': 'event-1',
      'x-fal-timestamp': '2000',
      'x-fal-signature': `sha256=${signature}`,
      'x-request-id': 'request-v1-0003',
    };

    const accepted = await app.request(
      '/v1/webhooks/fal',
      { method: 'POST', headers, body: payload },
      workerBindings,
    );
    expect(accepted.status).toBe(202);
    expect(webhookHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { provider: 'fal', event_id: 'event-1', dedup_key: 'event-1' },
      }),
    );

    const replay = await app.request(
      '/v1/webhooks/fal',
      { method: 'POST', headers, body: payload },
      workerBindings,
    );
    expect(replay.status).toBe(200);
    expect(ApiSuccessEnvelopeSchema.parse(await replay.json()).data).toEqual({
      accepted: true,
      idempotent: true,
    });

    const badSignature = await app.request(
      '/v1/webhooks/fal',
      {
        method: 'POST',
        headers: {
          ...headers,
          'x-fal-event-id': 'event-2',
          'x-fal-signature': `sha256=${'0'.repeat(64)}`,
        },
        body: payload,
      },
      workerBindings,
    );
    expect(badSignature.status).toBe(401);
    expect(ApiErrorEnvelopeSchema.parse(await badSignature.json()).error.code).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('returns retryable 503 for an event whose claim is in progress', async () => {
    const app = createCoreApp(
      dependencies({
        falWebhook: {
          verifyAndMap: async () => {
            throw Object.assign(new Error('claim in progress'), {
              code: 'provider_error',
              retryable: true,
              details: { reason: 'webhook_in_progress' },
            });
          },
          markProcessed: async () => true,
          release: async () => true,
        },
      }),
    );

    const response = await app.request(
      '/v1/webhooks/fal',
      {
        method: 'POST',
        headers: { 'x-request-id': 'request-v1-in-progress' },
        body: '{}',
      },
      workerBindings,
    );

    expect(response.status).toBe(503);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error).toMatchObject({
      code: 'PROVIDER_REJECTED',
      retryable: true,
    });
  });

  it('releases the claim after thrown ingest failure before returning retryable 503', async () => {
    const ordering: string[] = [];
    const app = createCoreApp(
      dependencies({
        handlers: {
          ...handlersWith(),
          ingest_fal_webhook: async () => {
            ordering.push('ingest');
            throw new Error('fixture ingest failure');
          },
        },
        falWebhook: {
          verifyAndMap: async () => {
            ordering.push('claim');
            return {
              provider: 'fal',
              eventId: 'fal-event-release-order',
              receivedAtEpochSeconds: 2_000,
              attempt: {
                providerJobId: 'fal-job-release-order',
                status: { state: 'running', providerJobId: 'fal-job-release-order' },
              },
            };
          },
          markProcessed: async () => {
            ordering.push('mark');
            return true;
          },
          release: async () => {
            ordering.push('release');
            return true;
          },
        },
      }),
    );

    const response = await app.request(
      '/v1/webhooks/fal',
      {
        method: 'POST',
        headers: { 'x-request-id': 'request-v1-release-order' },
        body: '{}',
      },
      workerBindings,
    );

    expect(response.status).toBe(503);
    expect(ordering).toEqual(['claim', 'ingest', 'release']);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error).toMatchObject({
      code: 'INTERNAL_ERROR',
      retryable: true,
    });
  });

  it('returns a retryable error when durable webhook replay protection is unavailable', async () => {
    const app = createCoreApp(
      dependencies({
        falWebhook: {
          verifyAndMap: async () => {
            throw Object.assign(new Error('dedup unavailable'), {
              code: 'provider_error',
              details: { reason: 'webhook_dedup_unavailable' },
            });
          },
          markProcessed: async () => true,
          release: async () => true,
        },
      }),
    );
    const response = await app.request(
      '/v1/webhooks/fal',
      {
        method: 'POST',
        headers: { 'x-request-id': 'request-v1-dedup-unavailable' },
        body: '{}',
      },
      workerBindings,
    );

    expect(response.status).toBe(503);
    expect(ApiErrorEnvelopeSchema.parse(await response.json()).error).toMatchObject({
      code: 'INTERNAL_ERROR',
      retryable: true,
    });
  });

  it('returns only an opaque error id on unhandled failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = handlersWith();
    const app = createCoreApp(
      dependencies({
        handlers: {
          ...failing,
          get_run: async () => {
            throw new Error('database-password=must-not-leak');
          },
        },
      }),
    );
    const response = await requestRoute(app, 'get_run');
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(text).not.toContain('database-password');
    expect(ApiErrorEnvelopeSchema.parse(JSON.parse(text)).error.details).toEqual({
      error_id: 'request-v1-0001',
    });
  });
});
