import {
  buildGoldenLaunchPackGraph,
  createCommandHandlers,
  createP0ResourceHandlers,
  createP0RestHandlers,
  type CanvasContextRecord,
  type GoldenCampaignBrief,
  type HandlerContext,
  type HandlerPorts,
  type P0RestHandlers,
  type P0RestOperation,
  type StoredQuote,
} from '@mustbeviral/contracts';

import { p0ResultSemantics } from '../src/transport/semantics';

const RUN_CAP_MICROS = 8_000_000n;
export const USABLE_PACK_GATE_MICROS = 5_000_000n;

export const HARNESS_OPERATIONS = [
  'create_workspace',
  'create_project',
  'create_canvas',
  'apply_canvas_patch',
  'validate_graph',
  'quote_run',
  'start_run',
] as const satisfies readonly P0RestOperation[];

export type HarnessOperation = (typeof HARNESS_OPERATIONS)[number];

export type HarnessResult =
  | Readonly<{ ok: true; data: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; error: SafeHarnessError }>;

export interface SafeHarnessError {
  readonly code: string;
  readonly message: string;
}

export interface HarnessTransport {
  call(
    operation: HarnessOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult>;
}

export interface BriefRunRecord {
  readonly brief_id: string;
  readonly workspace_id: string;
  readonly revision_hash: string;
  readonly quote: Readonly<{ total_micros: string; expires_at: string }>;
  readonly confirm_result: 'provider_unavailable' | 'started';
  readonly latency_ms: number;
}

export class HarnessFlowError extends Error {
  override readonly name = 'HarnessFlowError';

  constructor(
    readonly safe: SafeHarnessError,
    readonly briefId?: string,
  ) {
    super(`${safe.code}: ${safe.message}`);
  }
}

class ProviderUnavailableError extends Error {
  override readonly name = 'ProviderUnavailableError';
}

function record(value: unknown, field: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HarnessFlowError({
      code: 'INVALID_RESPONSE',
      message: `${field} was not an object.`,
    });
  }
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new HarnessFlowError({ code: 'INVALID_RESPONSE', message: `${field} was missing.` });
  }
  return value;
}

function integerMicros(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^\d+$/u.test(value)) return BigInt(value);
  throw new HarnessFlowError({
    code: 'INVALID_QUOTE',
    message: 'The quote total was not an integer-micros value.',
  });
}

function requireOk(result: HarnessResult, briefId: string): Readonly<Record<string, unknown>> {
  if (!result.ok) throw new HarnessFlowError(result.error, briefId);
  return result.data;
}

function idempotency(briefId: string, operation: string): string {
  return `golden-brief:${briefId}:${operation}`;
}

function handlerContext(workspaceId: string, briefId: string): HandlerContext {
  return {
    workspace_id: workspaceId,
    actor_id: 'golden-brief-harness',
    request_id: `harness-${briefId}`,
  };
}

export async function executeGoldenBrief(
  brief: GoldenCampaignBrief,
  transport: HarnessTransport,
  expectProviderUnavailable = true,
  now: () => number = Date.now,
): Promise<BriefRunRecord> {
  const startedAt = now();
  const bootstrapContext = handlerContext('00000000-0000-4000-8000-000000000000', brief.briefId);
  const workspace = requireOk(
    await transport.call('create_workspace', {
      context: bootstrapContext,
      name: `${brief.briefId} ${brief.product}`,
      idempotency_key: idempotency(brief.briefId, 'workspace'),
    }),
    brief.briefId,
  );
  const workspaceId = text(workspace.workspace_id, 'workspace_id');
  const context = handlerContext(workspaceId, brief.briefId);
  const projectResult = requireOk(
    await transport.call('create_project', {
      context,
      workspace_id: workspaceId,
      name: `${brief.briefId} launch pack`,
      idempotency_key: idempotency(brief.briefId, 'project'),
    }),
    brief.briefId,
  );
  const projectId = text(record(projectResult.project, 'project').id, 'project.id');
  const canvas = requireOk(
    await transport.call('create_canvas', {
      context,
      project_id: projectId,
      name: `${brief.briefId} launch pack`,
      idempotency_key: idempotency(brief.briefId, 'canvas'),
    }),
    brief.briefId,
  );
  const canvasId = text(canvas.canvasId, 'canvasId');
  const initialRevisionId = text(canvas.revisionId, 'revisionId');
  const graph = buildGoldenLaunchPackGraph(brief);
  const patched = requireOk(
    await transport.call('apply_canvas_patch', {
      context,
      canvas_id: canvasId,
      expected_revision_id: initialRevisionId,
      reason: `Build registered launch-pack graph for ${brief.briefId}`,
      patch: {
        upsert_nodes: graph.nodes,
        remove_node_ids: [],
        upsert_edges: graph.edges,
        remove_edge_ids: [],
      },
      idempotency_key: idempotency(brief.briefId, 'patch'),
    }),
    brief.briefId,
  );
  const revisionId = text(patched.revisionId, 'revisionId');
  const revisionHash = text(patched.canonicalHash, 'canonicalHash');
  const validation = requireOk(
    await transport.call('validate_graph', { context, canvas_id: canvasId }),
    brief.briefId,
  );
  if (validation.valid !== true) {
    throw new HarnessFlowError(
      { code: 'GRAPH_INVALID', message: 'The launch-pack graph failed validation.' },
      brief.briefId,
    );
  }
  const quoted = requireOk(
    await transport.call('quote_run', {
      context,
      canvas_id: canvasId,
      expected_revision_id: revisionId,
      idempotency_key: idempotency(brief.briefId, 'quote'),
    }),
    brief.briefId,
  );
  const quote = record(quoted.quote, 'quote');
  const quoteId = text(quote.quoteId, 'quote.quoteId');
  const expiresAt = text(quote.expiresAt, 'quote.expiresAt');
  const createdAt = text(quote.createdAt, 'quote.createdAt');
  const totalMicros = integerMicros(quote.maximumChargeMicros);
  if (
    quote.currency !== 'USD' ||
    text(quote.priceCatalogVersionId, 'quote.priceCatalogVersionId').length === 0 ||
    !Array.isArray(quote.nodeLines) ||
    quote.nodeLines.length === 0 ||
    Date.parse(expiresAt) - Date.parse(createdAt) !== 15 * 60 * 1000 ||
    totalMicros <= 0n ||
    totalMicros > RUN_CAP_MICROS
  ) {
    throw new HarnessFlowError(
      { code: 'INVALID_QUOTE', message: 'The named-price quote failed its invariants.' },
      brief.briefId,
    );
  }
  const confirmed = await transport.call('start_run', {
    context,
    quote_id: quoteId,
    confirmed: true,
    confirmation_token: `golden-brief-confirmation-${brief.briefId}`,
    idempotency_key: idempotency(brief.briefId, 'start'),
  });
  let confirmResult: BriefRunRecord['confirm_result'];
  if (confirmed.ok) {
    if (expectProviderUnavailable) {
      throw new HarnessFlowError(
        {
          code: 'MOCK_PROVIDER_SUCCESS',
          message: 'Run start succeeded while fail-closed was required.',
        },
        brief.briefId,
      );
    }
    confirmResult = 'started';
  } else {
    if (confirmed.error.code !== 'MODEL_UNAVAILABLE') {
      throw new HarnessFlowError(confirmed.error, brief.briefId);
    }
    if (!expectProviderUnavailable) {
      throw new HarnessFlowError(
        { code: 'PROVIDER_NOT_ENABLED', message: 'Provider-backed execution is still disabled.' },
        brief.briefId,
      );
    }
    confirmResult = 'provider_unavailable';
  }
  return {
    brief_id: brief.briefId,
    workspace_id: workspaceId,
    revision_hash: revisionHash,
    quote: { total_micros: totalMicros.toString(10), expires_at: expiresAt },
    confirm_result: confirmResult,
    latency_ms: Math.max(0, now() - startedAt),
  };
}

type CatalogPlan = Awaited<ReturnType<HandlerPorts['catalog']['quotePlan']>>;
type PriceMicros = CatalogPlan['prices'][number]['unitPriceMicros'];
type BillingExposure = Awaited<ReturnType<HandlerPorts['billing']['get']>>;

function priceMicros(value: bigint): PriceMicros {
  return value as PriceMicros;
}

export function createInMemoryHarnessTransport(): HarnessTransport {
  const canvases = new Map<string, CanvasContextRecord>();
  const quotes = new Map<string, StoredQuote>();
  const idempotencyResults = new Map<string, { fingerprint: string; result: unknown }>();
  const counters = new Map<string, number>();
  const next = (kind: string): string => {
    const value = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, value);
    return `${kind}-${String(value)}`;
  };
  const ports: HandlerPorts = {
    authorization: { authorize: async () => true },
    canvases: {
      get: async (_context, canvasId) => canvases.get(canvasId) ?? null,
      compareAndSwapRevision: async (_context, input) => {
        const current = canvases.get(input.canvasId);
        if (current === undefined || current.headRevisionId !== input.expectedRevisionId) {
          return { status: 'conflict', actualHead: current?.headRevisionId ?? '' };
        }
        canvases.set(input.canvasId, {
          ...current,
          headRevisionId: input.nextRevisionId,
          graphSchemaVersion: input.graphSchemaVersion,
          graphSnapshot: input.graphSnapshot,
          canonicalHash: input.canonicalHash,
        });
        return { status: 'ok' };
      },
    },
    catalog: {
      quotePlan: async (_context, snapshot) => ({
        priceCatalogVersionId: 'golden-launch-pack-v1',
        prices: [
          {
            priceCatalogVersionId: 'golden-launch-pack-v1',
            modelRouteId: 'copy-route',
            providerModelId: 'fixture/copy',
            unit: 'request',
            unitPriceMicros: priceMicros(100_000n),
          },
          {
            priceCatalogVersionId: 'golden-launch-pack-v1',
            modelRouteId: 'master-route',
            providerModelId: 'fixture/master',
            unit: 'image',
            unitPriceMicros: priceMicros(45_000n),
          },
          {
            priceCatalogVersionId: 'golden-launch-pack-v1',
            modelRouteId: 'adaptation-route',
            providerModelId: 'fixture/adaptation',
            unit: 'image',
            unitPriceMicros: priceMicros(40_000n),
          },
          {
            priceCatalogVersionId: 'golden-launch-pack-v1',
            modelRouteId: 'motion-route',
            providerModelId: 'fixture/motion',
            unit: 'video_second',
            unitPriceMicros: priceMicros(100_000n),
          },
        ],
        nodes: snapshot.nodes.flatMap<CatalogPlan['nodes'][number]>((candidate) => {
          const role = candidate.parameters.asset_role;
          if (role === 'copy_set')
            return [
              {
                nodeId: candidate.id,
                modelRouteId: 'copy-route',
                pricingUnits: [{ unit: 'request', quantity: 1n }],
              },
            ];
          if (role === 'master_static')
            return [
              {
                nodeId: candidate.id,
                modelRouteId: 'master-route',
                pricingUnits: [{ unit: 'image', quantity: 1n }],
              },
            ];
          if (role === 'adaptation')
            return [
              {
                nodeId: candidate.id,
                modelRouteId: 'adaptation-route',
                pricingUnits: [{ unit: 'image', quantity: 1n }],
              },
            ];
          if (role === 'motion_branch')
            return [
              {
                nodeId: candidate.id,
                modelRouteId: 'motion-route',
                pricingUnits: [{ unit: 'video_second', quantity: 8n }],
              },
            ];
          return [];
        }),
      }),
    },
    quotes: {
      get: async (_context, quoteId) => quotes.get(quoteId) ?? null,
      save: async (_context, quote) => {
        quotes.set(quote.quote.quoteId, quote);
      },
    },
    billing: {
      get: async () =>
        ({
          availableBalanceMicros: 100_000_000n,
          workspaceDayExposureMicros: 0n,
          globalDayExposureMicros: 0n,
          caps: { run: RUN_CAP_MICROS, workspaceDay: 25_000_000n, globalDay: 100_000_000n },
        }) as BillingExposure,
    },
    confirmations: { verify: async () => true },
    runs: {
      get: async () => null,
      startBarrier: async () => {
        throw new ProviderUnavailableError('Provider-backed execution is not enabled');
      },
      requestCancellation: async () => ({ status: 'conflict', actualState: 'failed' }),
    },
    artifacts: {
      register: async () => undefined,
      registerLineage: async () => undefined,
    },
    audit: { emit: async () => undefined },
    idempotency: {
      async execute<Result>(identityKey: string, fingerprint: string, work: () => Promise<Result>) {
        const existing = idempotencyResults.get(identityKey);
        if (existing !== undefined) {
          return existing.fingerprint === fingerprint
            ? { status: 'replay', result: existing.result as Result }
            : { status: 'conflict' };
        }
        const result = await work();
        idempotencyResults.set(identityKey, { fingerprint, result });
        return { status: 'created', result };
      },
    },
    clock: { now: () => '2026-07-20T12:00:00.000Z' },
    ids: { next },
  };
  const resources = createP0ResourceHandlers({
    async createWorkspace(inputValue) {
      const input = record(inputValue, 'create_workspace input');
      text(input.name, 'name');
      return { status: 'ok', workspace_id: next('workspace') };
    },
    async getWorkspace() {
      return { status: 'not_found' };
    },
    async createProject(inputValue) {
      const input = record(inputValue, 'create_project input');
      return { status: 'ok', project: { id: next('project'), name: input.name } };
    },
    async getProject() {
      return { status: 'not_found' };
    },
    async createCanvas(inputValue) {
      const input = record(inputValue, 'create_canvas input');
      const canvasId = next('canvas');
      const revisionId = next('revision');
      const initial: CanvasContextRecord = {
        canvasId,
        projectId: text(input.project_id, 'project_id'),
        headRevisionId: revisionId,
        graphSchemaVersion: 1,
        graphSnapshot: {
          nodes: [{ id: 'brief', kind: 'brief', parameter_schema_version: 1, parameters: {} }],
          edges: [],
        },
        canonicalHash: 'initial',
      };
      canvases.set(canvasId, initial);
      return { status: 'ok', canvasId, revisionId, canonicalHash: initial.canonicalHash };
    },
    async createArtifactUpload() {
      return { status: 'provider_unavailable' };
    },
    async getArtifact() {
      return { status: 'not_found' };
    },
    async createExport() {
      return { status: 'provider_unavailable' };
    },
    async explainModel() {
      return { status: 'not_found' };
    },
    async getReceipt() {
      return { status: 'not_found' };
    },
    async ingestFalWebhook() {
      return { status: 'provider_unavailable' };
    },
  });
  const handlers = createP0RestHandlers(createCommandHandlers(ports), resources);
  return new DirectHandlerTransport(handlers);
}

export class DirectHandlerTransport implements HarnessTransport {
  constructor(private readonly handlers: P0RestHandlers) {}

  async call(
    operation: HarnessOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult> {
    try {
      const semantic = p0ResultSemantics(await this.handlers[operation](input));
      return semantic.ok
        ? semantic
        : { ok: false, error: { code: semantic.error.code, message: semantic.error.message } };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        return {
          ok: false,
          error: {
            code: 'MODEL_UNAVAILABLE',
            message: 'Provider-backed execution is not enabled.',
          },
        };
      }
      throw error;
    }
  }
}

function stagingRequest(operation: HarnessOperation, input: Readonly<Record<string, unknown>>) {
  const id = (field: string): string => text(input[field], field);
  if (operation === 'create_workspace')
    return { method: 'POST', path: '/v1/workspaces', body: { name: input.name } } as const;
  if (operation === 'create_project')
    return {
      method: 'POST',
      path: `/v1/workspaces/${id('workspace_id')}/projects`,
      body: { name: input.name },
    } as const;
  if (operation === 'create_canvas')
    return {
      method: 'POST',
      path: `/v1/projects/${id('project_id')}/canvases`,
      body: { name: input.name },
    } as const;
  if (operation === 'apply_canvas_patch')
    return {
      method: 'POST',
      path: `/v1/canvases/${id('canvas_id')}/patches`,
      body: {
        expected_revision_id: input.expected_revision_id,
        reason: input.reason,
        patch: input.patch,
      },
    } as const;
  if (operation === 'validate_graph')
    return { method: 'POST', path: `/v1/canvases/${id('canvas_id')}/validate`, body: {} } as const;
  if (operation === 'quote_run')
    return {
      method: 'POST',
      path: `/v1/canvases/${id('canvas_id')}/quotes`,
      body: { expected_revision_id: input.expected_revision_id },
    } as const;
  return {
    method: 'POST',
    path: `/v1/quotes/${id('quote_id')}/runs`,
    body: { confirmed: input.confirmed, confirmation_token: input.confirmation_token },
  } as const;
}

export class StagingLaunchPackTransport implements HarnessTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async call(
    operation: HarnessOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult> {
    const request = stagingRequest(operation, input);
    const response = await this.fetchImplementation(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers: {
        authorization: `Bearer ${this.accessToken}`,
        'content-type': 'application/json',
        'idempotency-key': text(input.idempotency_key ?? `query-${operation}`, 'idempotency_key'),
      },
      body: JSON.stringify(request.body),
    });
    let body: unknown;
    try {
      body = (await response.json()) as unknown;
    } catch {
      throw new HarnessFlowError({
        code: 'TRANSPORT_ERROR',
        message: 'Staging returned invalid JSON.',
      });
    }
    const envelope = record(body, 'response');
    if (response.ok) return { ok: true, data: record(envelope.data, 'response.data') };
    const error = record(envelope.error, 'response.error');
    return {
      ok: false,
      error: {
        code: text(error.code, 'error.code'),
        message: text(error.message, 'error.message'),
      },
    };
  }
}
