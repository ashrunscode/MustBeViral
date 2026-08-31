import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ApiErrorEnvelopeSchema,
  P0_REST_OPERATIONS,
  PRODUCTION_MCP_TOOL_NAMES,
  type P0HandlerResult,
  type P0RestHandlers,
  type ProductionMcpToolName,
} from '@mustbeviral/contracts';

import { createCoreApp } from '../../src/app';
import type { V1Dependencies } from '../../src/routes/v1';

const enabledBindings = {
  PROVIDER_RUNS_ENABLED: 'true',
  FAL_KEY: 'fixture-provider-key',
} as unknown as PlatformBindings;

const restPaths: Readonly<Record<ProductionMcpToolName, string>> = {
  get_canvas_context: '/v1/canvases/canvas-1',
  apply_canvas_patch: '/v1/canvases/canvas-1/patches',
  quote_run: '/v1/canvases/canvas-1/quotes',
  start_run: '/v1/quotes/quote-1/runs',
  get_run: '/v1/runs/run-1',
  validate_graph: '/v1/canvases/canvas-1/validate',
  cancel_run: '/v1/runs/run-1/cancel',
  get_artifact: '/v1/artifacts/artifact-1',
  create_export: '/v1/runs/run-1/exports',
  explain_model: '/v1/models/model-1',
  get_receipt: '/v1/runs/run-1/receipt',
};

const validArguments: Readonly<Record<ProductionMcpToolName, Readonly<Record<string, unknown>>>> = {
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
  validate_graph: { canvas_id: 'canvas-1' },
  cancel_run: { run_id: 'run-1', reason: 'Operator cancel', idempotency_key: 'vector-idem-1' },
  get_artifact: { artifact_id: 'artifact-1' },
  create_export: {
    run_id: 'run-1',
    artifact_ids: ['artifact-1'],
    format: 'zip',
    idempotency_key: 'vector-idem-1',
  },
  explain_model: { model_id: 'model-1' },
  get_receipt: { run_id: 'run-1' },
};

type VectorKind = 'success' | 'validation' | 'authorization' | 'conflict' | 'expiry' | 'rate_limit';

interface ProductionVector {
  readonly name: string;
  readonly tool: ProductionMcpToolName;
  readonly kind: VectorKind;
  readonly result?: P0HandlerResult;
  readonly arguments?: Readonly<Record<string, unknown>>;
  readonly forbiddenWorkspace?: boolean;
  readonly expectedCode?: string;
}

const productionVectors: readonly ProductionVector[] = [
  ...PRODUCTION_MCP_TOOL_NAMES.map((tool) => ({
    name: `${tool} success`,
    tool,
    kind: 'success' as const,
    result: { status: 'ok' as const, fixture: tool },
  })),
  {
    name: 'apply_canvas_patch validation failure',
    tool: 'apply_canvas_patch',
    kind: 'validation',
    arguments: { canvas_id: 'canvas-1', idempotency_key: 'vector-idem-1' },
    expectedCode: 'VALIDATION_FAILED',
  },
  {
    name: 'start_run explicit confirmation missing',
    tool: 'start_run',
    kind: 'validation',
    arguments: {
      quote_id: 'quote-1',
      confirmation_token: 'confirmation-token-1',
      idempotency_key: 'vector-idem-1',
    },
    expectedCode: 'VALIDATION_FAILED',
  },
  {
    name: 'create_export validation failure',
    tool: 'create_export',
    kind: 'validation',
    arguments: { run_id: 'run-1', idempotency_key: 'vector-idem-1' },
    expectedCode: 'VALIDATION_FAILED',
  },
  ...(['get_run', 'get_artifact', 'get_receipt', 'explain_model'] as const).map((tool) => ({
    name: `${tool} authorization failure`,
    tool,
    kind: 'authorization' as const,
    forbiddenWorkspace: true,
    expectedCode: 'FORBIDDEN',
  })),
  {
    name: 'apply_canvas_patch revision conflict',
    tool: 'apply_canvas_patch',
    kind: 'conflict',
    result: { status: 'conflict', reason: 'revision' },
    expectedCode: 'REVISION_CONFLICT',
  },
  {
    name: 'cancel_run conflict',
    tool: 'cancel_run',
    kind: 'conflict',
    result: { status: 'conflict', reason: 'run_state' },
    expectedCode: 'RUN_NOT_CANCELABLE',
  },
  {
    name: 'start_run quote expiry',
    tool: 'start_run',
    kind: 'expiry',
    result: { status: 'expired_quote' },
    expectedCode: 'QUOTE_EXPIRED',
  },
  {
    name: 'get_run rate limit shape',
    tool: 'get_run',
    kind: 'rate_limit',
    result: { status: 'rate_limited', retry_after_seconds: 30 },
    expectedCode: 'RATE_LIMITED',
  },
  {
    name: 'validate_graph rate limit shape',
    tool: 'validate_graph',
    kind: 'rate_limit',
    result: { status: 'rate_limited', retry_after_seconds: 15 },
    expectedCode: 'RATE_LIMITED',
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

function createHandlers(vector: ProductionVector): P0RestHandlers {
  return Object.fromEntries(
    P0_REST_OPERATIONS.map((operation) => [
      operation,
      async () => {
        if (operation !== vector.tool) return { status: 'ok' as const };
        return vector.result ?? { status: 'ok' as const, fixture: vector.name };
      },
    ]),
  ) as unknown as P0RestHandlers;
}

function dependencies(vector: ProductionVector): V1Dependencies {
  return {
    handlers: createHandlers(vector),
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

function restBody(tool: ProductionMcpToolName, input: Readonly<Record<string, unknown>>) {
  const body = Object.fromEntries(
    Object.entries(input).filter(
      ([key]) =>
        !['canvas_id', 'quote_id', 'run_id', 'artifact_id', 'model_id', 'idempotency_key'].includes(
          key,
        ),
    ),
  );
  const readOnly =
    tool === 'get_canvas_context' ||
    tool === 'get_run' ||
    tool === 'get_artifact' ||
    tool === 'explain_model' ||
    tool === 'get_receipt' ||
    tool === 'validate_graph';
  return readOnly ? undefined : body;
}

async function callRest(
  app: ReturnType<typeof createCoreApp>,
  tool: ProductionMcpToolName,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
  const body = restBody(tool, input);
  const method =
    tool === 'get_canvas_context' ||
    tool === 'get_run' ||
    tool === 'get_artifact' ||
    tool === 'explain_model' ||
    tool === 'get_receipt'
      ? 'GET'
      : 'POST';
  const response = await app.request(
    restPaths[tool],
    {
      method,
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
  return JSON.parse(await response.text()) as unknown;
}

async function callMcp(
  app: ReturnType<typeof createCoreApp>,
  tool: ProductionMcpToolName,
  input: Readonly<Record<string, unknown>>,
): Promise<unknown> {
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
  const rpc = JSON.parse(await response.text()) as {
    result?: { structuredContent?: unknown };
    error?: unknown;
  };
  return rpc.result?.structuredContent ?? rpc;
}

describe('production MCP and REST parity for all shipped tools', () => {
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

  it.each(productionVectors)('$name keeps REST/MCP semantic parity', async (vector) => {
    const app = createCoreApp(dependencies(vector));
    const input = vector.arguments ?? validArguments[vector.tool];
    const rest = await callRest(app, vector.tool, input);
    const mcp = await callMcp(app, vector.tool, input);
    expect(normalizedEnvelope(mcp)).toEqual(normalizedEnvelope(rest));
    if (vector.expectedCode !== undefined) {
      expect(ApiErrorEnvelopeSchema.parse(rest).error.code).toBe(vector.expectedCode);
    }
  });

  it('lists exactly eleven production tools after authentication', async () => {
    const vector = productionVectors[0];
    if (vector === undefined) throw new Error('Missing vector fixture');
    const app = createCoreApp(dependencies(vector));
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
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      },
      enabledBindings,
    );
    const body = (await response.json()) as { result: { tools: readonly { name: string }[] } };
    expect(body.result.tools.map((tool) => tool.name)).toEqual(PRODUCTION_MCP_TOOL_NAMES);
  });
});
