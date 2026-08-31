import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiErrorEnvelopeSchema,
  P0_MCP_TOOL_NAMES,
  P0_REST_OPERATIONS,
  PRODUCTION_MCP_TOOL_NAMES,
  type P0HandlerResult,
  type P0McpToolName,
  type P0RestHandlers,
} from '@mustbeviral/contracts';

import { createCoreApp } from '../../src/app';
import type { V1Dependencies } from '../../src/routes/v1';

const enabledBindings = {
  PROVIDER_RUNS_ENABLED: 'true',
  FAL_KEY: 'fixture-provider-key',
} as unknown as PlatformBindings;

const restPaths: Readonly<Record<P0McpToolName, string>> = {
  get_canvas_context: '/v1/canvases/canvas-1',
  apply_canvas_patch: '/v1/canvases/canvas-1/patches',
  quote_run: '/v1/canvases/canvas-1/quotes',
  start_run: '/v1/quotes/quote-1/runs',
  get_run: '/v1/runs/run-1',
};

const validArguments: Readonly<Record<P0McpToolName, Readonly<Record<string, unknown>>>> = {
  get_canvas_context: { canvas_id: 'canvas-1' },
  apply_canvas_patch: {
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    reason: 'Vector patch',
    patch: {},
    idempotency_key: 'vector-idem-1',
  },
  quote_run: {
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    idempotency_key: 'vector-idem-1',
  },
  start_run: {
    quote_id: 'quote-1',
    confirmed: true,
    confirmation_token: 'confirmation-token-1',
    idempotency_key: 'vector-idem-1',
  },
  get_run: { run_id: 'run-1' },
};

interface ParityVector {
  readonly name: string;
  readonly tool: P0McpToolName;
  readonly result?: P0HandlerResult;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly forbiddenWorkspace?: boolean;
  readonly throws?: boolean;
  readonly replay?: boolean;
  readonly expectedCode?: string;
}

const vectors: readonly ParityVector[] = [
  {
    name: 'success',
    tool: 'get_canvas_context',
    result: { status: 'ok' },
  },
  {
    name: 'validation failure',
    tool: 'apply_canvas_patch',
    arguments: { canvas_id: 'canvas-1', idempotency_key: 'vector-idem-1' },
    expectedCode: 'VALIDATION_FAILED',
  },
  {
    name: 'authorization failure',
    tool: 'get_run',
    forbiddenWorkspace: true,
    expectedCode: 'FORBIDDEN',
  },
  {
    name: 'expected revision conflict',
    tool: 'apply_canvas_patch',
    result: { status: 'conflict', reason: 'revision' },
    expectedCode: 'REVISION_CONFLICT',
  },
  {
    name: 'quote expiry',
    tool: 'start_run',
    result: { status: 'expired_quote' },
    expectedCode: 'QUOTE_EXPIRED',
  },
  {
    name: 'explicit confirmation missing',
    tool: 'start_run',
    arguments: {
      quote_id: 'quote-1',
      confirmation_token: 'confirmation-token-1',
      idempotency_key: 'vector-idem-1',
    },
    expectedCode: 'VALIDATION_FAILED',
  },
  {
    name: 'idempotent replay',
    tool: 'apply_canvas_patch',
    replay: true,
  },
  {
    name: 'rate limit shape',
    tool: 'get_run',
    result: { status: 'rate_limited', retry_after_seconds: 30 },
    expectedCode: 'RATE_LIMITED',
  },
  {
    name: 'provider ambiguity reconcile state',
    tool: 'start_run',
    result: { status: 'provider_ambiguous', reconcile_state: 'reconcile_pending' },
    expectedCode: 'PROVIDER_AMBIGUOUS',
  },
  {
    name: 'safe error opacity',
    tool: 'get_run',
    throws: true,
    expectedCode: 'INTERNAL_ERROR',
  },
];

function normalizedEnvelope(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  const record = value as Readonly<Record<string, unknown>>;
  if ('error' in record) {
    const parsed = ApiErrorEnvelopeSchema.parse(value);
    return {
      error: {
        ...parsed.error,
        request_id: '<request-id>',
        ...(parsed.error.details?.error_id === undefined
          ? {}
          : { details: { ...parsed.error.details, error_id: '<error-id>' } }),
      },
    };
  }
  if ('meta' in record && typeof record.meta === 'object' && record.meta !== null) {
    return { ...record, meta: { ...(record.meta as object), request_id: '<request-id>' } };
  }
  return value;
}

function createHandlers(vector: ParityVector, executions: { value: number }): P0RestHandlers {
  return Object.fromEntries(
    P0_REST_OPERATIONS.map((operation) => [
      operation,
      async (input: unknown) => {
        if (operation !== vector.tool) return { status: 'ok' as const };
        if (vector.throws) throw new Error('database-password=opaque-vector-secret');
        if (vector.replay) {
          const command = input as { idempotency_key: string };
          expect(command.idempotency_key).toBe('vector-idem-1');
          if (executions.value === 0) executions.value += 1;
          return { status: 'ok' as const, revisionId: 'revision-replayed' };
        }
        return vector.result ?? { status: 'ok' as const, fixture: vector.name };
      },
    ]),
  ) as unknown as P0RestHandlers;
}

function dependencies(vector: ParityVector, executions: { value: number }): V1Dependencies {
  return {
    handlers: createHandlers(vector, executions),
    jwt: {
      verify: async (token) => {
        if (token !== 'valid-jwt') throw new Error('rejected');
        return { actorId: 'user-1', authenticationMethod: 'supabase_jwt' };
      },
    },
    workspaces: {
      resolve: async () => (vector.forbiddenWorkspace ? null : 'workspace-1'),
    },
  };
}

function restBody(tool: P0McpToolName, input: Readonly<Record<string, unknown>>) {
  const body = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) => !['canvas_id', 'quote_id', 'run_id', 'idempotency_key'].includes(key),
    ),
  );
  return tool === 'get_canvas_context' || tool === 'get_run' ? undefined : body;
}

async function callRest(
  app: ReturnType<typeof createCoreApp>,
  tool: P0McpToolName,
  input: Readonly<Record<string, unknown>>,
): Promise<{ envelope: unknown; raw: string }> {
  const body = restBody(tool, input);
  const response = await app.request(
    restPaths[tool],
    {
      method: tool === 'get_canvas_context' || tool === 'get_run' ? 'GET' : 'POST',
      headers: {
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
        'idempotency-key': String(input.idempotency_key ?? 'vector-idem-1'),
        'x-request-id': 'vector-rest-0001',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
    enabledBindings,
  );
  const raw = await response.text();
  return { envelope: JSON.parse(raw) as unknown, raw };
}

async function callMcp(
  app: ReturnType<typeof createCoreApp>,
  tool: P0McpToolName,
  input: Readonly<Record<string, unknown>>,
): Promise<{ envelope: unknown; raw: string }> {
  const response = await app.request(
    '/mcp',
    {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer valid-jwt',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
        'x-request-id': 'vector-mcp-0001',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: tool, arguments: input },
      }),
    },
    enabledBindings,
  );
  const raw = await response.text();
  const rpc = JSON.parse(raw) as {
    result?: { structuredContent?: unknown };
    error?: unknown;
  };
  return { envelope: rpc.result?.structuredContent ?? rpc, raw };
}

describe('P0 REST and private MCP contract vectors', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(vectors)('$name has REST/MCP semantic parity', async (vector) => {
    const executions = { value: 0 };
    const app = createCoreApp(dependencies(vector, executions));
    const input = vector.arguments ?? validArguments[vector.tool];

    const rest = await callRest(app, vector.tool, input);
    const mcp = await callMcp(app, vector.tool, input);

    expect(normalizedEnvelope(mcp.envelope)).toEqual(normalizedEnvelope(rest.envelope));
    if (vector.expectedCode !== undefined) {
      expect(ApiErrorEnvelopeSchema.parse(rest.envelope).error.code).toBe(vector.expectedCode);
    }
    if (vector.throws) {
      expect(rest.raw).not.toContain('opaque-vector-secret');
      expect(mcp.raw).not.toContain('opaque-vector-secret');
    }
    if (vector.replay) expect(executions.value).toBe(1);
  });

  it('keeps get_run recovery and settlement identical and safe across REST and private MCP', async () => {
    const result = {
      status: 'ok' as const,
      run: {
        runId: 'run-1',
        projectId: 'project-1',
        canvasId: 'canvas-1',
        canvasRevisionId: 'revision-1',
        quoteId: 'quote-1',
        status: 'reconciliation_required',
        reservationId: 'reservation-1',
      },
      nodes: [
        {
          runNodeId: 'run-node-kept',
          nodeKey: 'copy-1',
          modelRouteId: 'copy-route',
          status: 'succeeded',
          dispatchWave: 0,
        },
        {
          runNodeId: 'run-node-unknown',
          nodeKey: 'master-2',
          modelRouteId: 'image-route',
          status: 'reconciliation_required',
          dispatchWave: 1,
          providerErrorCode: 'ambiguous_submit',
        },
      ],
      recovery: {
        kind: 'ambiguous',
        affectedNodeKeys: ['master-2'],
        title: 'This branch needs reconciliation',
        message:
          'Provider status is unconfirmed. Blind retry is blocked. 1 completed branch was kept and remains reviewable.',
        nextAction: 'Wait for operator reconciliation. Do not submit the same prompt again.',
      },
      spend: {
        currency: 'USD',
        authorizedMicros: 4_550_000n,
        capturedMicros: 150_000n,
        releasedMicros: 3_000_000n,
        refundedMicros: 0n,
        netMicros: 150_000n,
        settlementStatus: 'partially_captured',
      },
    };
    const vector: ParityVector = {
      name: 'safe get run recovery',
      tool: 'get_run',
      result: result as unknown as P0HandlerResult,
    };
    const app = createCoreApp(dependencies(vector, { value: 0 }));
    const rest = await callRest(app, 'get_run', validArguments.get_run);
    const mcp = await callMcp(app, 'get_run', validArguments.get_run);

    expect(normalizedEnvelope(mcp.envelope)).toEqual(normalizedEnvelope(rest.envelope));
    expect(rest.envelope).toMatchObject({
      data: {
        recovery: {
          kind: 'ambiguous',
          affectedNodeKeys: ['master-2'],
          nextAction: 'Wait for operator reconciliation. Do not submit the same prompt again.',
        },
        spend: {
          capturedMicros: '150000',
          netMicros: '150000',
          settlementStatus: 'partially_captured',
        },
      },
    });
    expect(`${rest.raw}${mcp.raw}`).not.toMatch(
      /provider payload|normalized_evidence|signed\.example|token=|customer prompt/iu,
    );
  });

  it('keeps discovery private and lists exactly five tools after authentication', async () => {
    const vector = vectors[0];
    if (vector === undefined) throw new Error('Missing vector fixture');
    const app = createCoreApp(dependencies(vector, { value: 0 }));
    const request = {
      method: 'POST',
      headers: {
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'mcp-protocol-version': '2025-11-25',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    } as const;

    const privateResponse = await app.request('/mcp', request, enabledBindings);
    expect(privateResponse.status).toBe(401);

    const listed = await app.request(
      '/mcp',
      { ...request, headers: { ...request.headers, authorization: 'Bearer valid-jwt' } },
      enabledBindings,
    );
    const body = (await listed.json()) as { result: { tools: readonly { name: string }[] } };
    expect(body.result.tools.map((tool) => tool.name)).toEqual(PRODUCTION_MCP_TOOL_NAMES);
    expect(body.result.tools).toHaveLength(PRODUCTION_MCP_TOOL_NAMES.length);
    expect(
      P0_MCP_TOOL_NAMES.every((name) => body.result.tools.some((tool) => tool.name === name)),
    ).toBe(true);
  });

  it('negotiates the private stateless Streamable HTTP lifecycle', async () => {
    const vector = vectors[0];
    if (vector === undefined) throw new Error('Missing vector fixture');
    const app = createCoreApp(dependencies(vector, { value: 0 }));
    const initialized = await app.request(
      '/mcp',
      {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          authorization: 'Bearer valid-jwt',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'initialize-1',
          method: 'initialize',
          params: {
            protocolVersion: '2025-11-25',
            capabilities: {},
            clientInfo: { name: 'contract-vector', version: '1' },
          },
        }),
      },
      enabledBindings,
    );
    const body = (await initialized.json()) as {
      result: { protocolVersion: string; capabilities: Record<string, unknown> };
    };
    expect(initialized.status).toBe(200);
    expect(initialized.headers.get('content-type')).toContain('application/json');
    expect(body.result).toEqual({
      protocolVersion: '2025-11-25',
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'mustbeviral-core', version: 'p1b' },
    });

    const getResponse = await app.request(
      '/mcp',
      { headers: { authorization: 'Bearer valid-jwt' } },
      enabledBindings,
    );
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get('allow')).toBe('POST');
  });

  it('fails closed for start_run before calling a handler when provider credentials are absent', async () => {
    const handler = vi.fn(async () => ({ status: 'ok' as const }));
    const vector = vectors[0];
    if (vector === undefined) throw new Error('Missing vector fixture');
    const deps = dependencies(vector, { value: 0 });
    const app = createCoreApp({
      ...deps,
      handlers: { ...deps.handlers, start_run: handler },
    });
    const response = await app.request(
      '/mcp',
      {
        method: 'POST',
        headers: {
          accept: 'application/json, text/event-stream',
          authorization: 'Bearer valid-jwt',
          'content-type': 'application/json',
          'mcp-protocol-version': '2025-11-25',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 'start_run', arguments: validArguments.start_run },
        }),
      },
      { PROVIDER_RUNS_ENABLED: 'false' } as unknown as PlatformBindings,
    );
    const rpc = (await response.json()) as { result: { structuredContent: unknown } };
    expect(ApiErrorEnvelopeSchema.parse(rpc.result.structuredContent).error.code).toBe(
      'MODEL_UNAVAILABLE',
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
