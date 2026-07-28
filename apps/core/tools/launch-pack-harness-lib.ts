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
  type RunRecord,
  type StoredQuote,
} from '@mustbeviral/contracts';

import { p0ResultSemantics } from '../src/transport/semantics';
import {
  buildLaunchCatalogQuotePlan,
  fixtureLaunchCatalogRecords,
} from '../src/composition/launch-catalog';

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

export const CANARY_OBSERVATION_OPERATIONS = [
  'get_run',
  'get_receipt',
] as const satisfies readonly P0RestOperation[];

export type HarnessOperation = (typeof HARNESS_OPERATIONS)[number];
export type HarnessTransportOperation =
  HarnessOperation | (typeof CANARY_OBSERVATION_OPERATIONS)[number];

export type HarnessResult =
  | Readonly<{ ok: true; data: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; error: SafeHarnessError }>;

export interface SafeHarnessError {
  readonly code: string;
  readonly message: string;
  readonly operation?: HarnessTransportOperation;
  readonly http_status?: number;
}

export interface HarnessTransport {
  call(
    operation: HarnessTransportOperation,
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
  runId = 'local',
): Promise<BriefRunRecord> {
  const startedAt = now();
  // A per-invocation runId keeps every run independent: it makes the derived
  // workspace slug globally unique and scopes idempotency keys so a re-run never
  // collides with or replays a prior run's state.
  const key = (operation: string): string => idempotency(`${runId}:${brief.briefId}`, operation);
  const bootstrapContext = handlerContext('00000000-0000-4000-8000-000000000000', brief.briefId);
  const workspace = requireOk(
    await transport.call('create_workspace', {
      context: bootstrapContext,
      name: `${brief.briefId} ${brief.product} ${runId}`,
      idempotency_key: key('workspace'),
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
      idempotency_key: key('project'),
    }),
    brief.briefId,
  );
  const projectId = text(record(projectResult.project, 'project').id, 'project.id');
  const canvas = requireOk(
    await transport.call('create_canvas', {
      context,
      project_id: projectId,
      name: `${brief.briefId} launch pack`,
      idempotency_key: key('canvas'),
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
      idempotency_key: key('patch'),
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
      idempotency_key: key('quote'),
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
    idempotency_key: key('start'),
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

type BillingExposure = Awaited<ReturnType<HandlerPorts['billing']['get']>>;

export interface InMemoryHarnessOptions {
  readonly providerResult?: 'unavailable' | 'succeeded';
}

export function createInMemoryHarnessTransport(
  options: InMemoryHarnessOptions = {},
): HarnessTransport {
  const canvases = new Map<string, CanvasContextRecord>();
  const quotes = new Map<string, StoredQuote>();
  const runs = new Map<string, RunRecord>();
  const receipts = new Map<string, Readonly<Record<string, unknown>>>();
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
      quotePlan: async (_context, snapshot) =>
        buildLaunchCatalogQuotePlan(snapshot, fixtureLaunchCatalogRecords()),
    },
    quotes: {
      get: async (_context, quoteId) => quotes.get(quoteId) ?? null,
      save: async (_context, quote) => {
        quotes.set(quote.quote.quoteId, quote);
        return quote;
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
      get: async (_context, runId) => runs.get(runId) ?? null,
      startBarrier: async (context, input) => {
        if (options.providerResult !== 'succeeded') {
          throw new ProviderUnavailableError('Provider-backed execution is not enabled');
        }
        const storedQuote = quotes.get(input.quoteId);
        if (storedQuote === undefined) throw new TypeError('In-memory quote was unavailable');
        const line = storedQuote.quote.nodeLines[0];
        if (line === undefined)
          throw new TypeError('In-memory quote did not contain a priced node');
        const runId = next('run');
        const reservationId = next('reservation');
        const run: RunRecord = {
          runId,
          projectId: storedQuote.projectId,
          canvasId: storedQuote.canvasId,
          canvasRevisionId: storedQuote.quote.canvasRevisionId,
          quoteId: input.quoteId,
          status: 'succeeded',
          reservationId,
        };
        runs.set(runId, run);
        const attemptId = next('attempt');
        const providerJobId = next('provider-job');
        const runNodeId = next('run-node');
        const artifactId = next('artifact');
        const providerRegistrationId = 'provider-fal';
        const captureMicros = storedQuote.quote.maximumChargeMicros.toString(10);
        const captureCausativeKey = `run:${runId}:attempt:${attemptId}:capture`;
        const contentHash = 'a'.repeat(64);
        const artifact = {
          id: artifactId,
          workspace_id: context.workspace_id,
          project_id: storedQuote.projectId,
          run_id: runId,
          canvas_revision_id: storedQuote.quote.canvasRevisionId,
          artifact_kind: 'provider_output',
          status: 'available',
          object_key: `workspaces/${context.workspace_id}/runs/${runId}/artifacts/${artifactId}.png`,
          content_hash: contentHash,
          mime_type: 'image/png',
          byte_size: 1024,
        };
        receipts.set(runId, {
          run: {
            id: runId,
            workspace_id: context.workspace_id,
            project_id: storedQuote.projectId,
            canvas_id: storedQuote.canvasId,
            canvas_revision_id: storedQuote.quote.canvasRevisionId,
            quote_id: input.quoteId,
            status: 'succeeded',
          },
          reservation: {
            id: reservationId,
            workspace_id: context.workspace_id,
            run_id: runId,
            amount_micros: captureMicros,
            captured_micros: captureMicros,
            released_micros: '0',
          },
          ledger: [
            {
              id: 'ledger-capture-debit',
              transaction_id: 'capture-transaction',
              entry_type: 'capture',
              account_code: 'wallet_reserved',
              direction: 'debit',
              amount_micros: captureMicros,
              causative_key: captureCausativeKey,
              run_id: runId,
            },
            {
              id: 'ledger-capture-credit',
              transaction_id: 'capture-transaction',
              entry_type: 'capture',
              account_code: 'usage_expense',
              direction: 'credit',
              amount_micros: captureMicros,
              causative_key: captureCausativeKey,
              run_id: runId,
            },
          ],
          artifacts: [artifact],
          lineage: [],
          attempts: [
            {
              id: attemptId,
              run_id: runId,
              run_node_id: runNodeId,
              provider_registration_id: providerRegistrationId,
              attempt_number: 1,
              status: 'succeeded',
            },
          ],
          provider_jobs: [
            {
              id: providerJobId,
              run_id: runId,
              attempt_id: attemptId,
              provider_registration_id: providerRegistrationId,
              status: 'succeeded',
            },
          ],
          run_nodes: [
            {
              id: runNodeId,
              run_id: runId,
              node_key: line.nodeId,
              model_route_id: line.modelRouteId,
              status: 'succeeded',
            },
          ],
          model_routes: [
            {
              id: line.modelRouteId,
              provider_registration_id: providerRegistrationId,
              route_key: 'fal/flux-2-pro/masters',
              provider_model_id: line.providerModelId,
              status: 'enabled',
            },
          ],
          provider_registrations: [
            { id: providerRegistrationId, provider_key: 'fal', status: 'enabled' },
          ],
        });
        return { runId, reservationId, status: 'queued' };
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
    async createWorkspace(input) {
      void input.context;
      void input.idempotency_key;
      return { status: 'ok', workspace_id: next('workspace') };
    },
    async getWorkspace() {
      return { status: 'not_found' };
    },
    async createProject(input) {
      return { status: 'ok', project: { id: next('project'), name: input.name } };
    },
    async getProject() {
      return { status: 'not_found' };
    },
    async createCanvas(input) {
      const canvasId = next('canvas');
      const revisionId = next('revision');
      const initial: CanvasContextRecord = {
        canvasId,
        projectId: input.project_id,
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
    async getReceipt(input) {
      const receipt = receipts.get(input.run_id);
      return receipt === undefined ? { status: 'not_found' } : { status: 'ok', receipt };
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
    operation: HarnessTransportOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult> {
    try {
      const semantic = p0ResultSemantics(await this.handlers[operation](input));
      return semantic.ok
        ? semantic
        : {
            ok: false,
            error: {
              code: semantic.error.code,
              message: semantic.error.message,
              operation,
              http_status: semantic.error.httpStatus,
            },
          };
    } catch (error) {
      if (error instanceof ProviderUnavailableError) {
        return {
          ok: false,
          error: {
            code: 'MODEL_UNAVAILABLE',
            message: 'Provider-backed execution is not enabled.',
            operation,
            http_status: 503,
          },
        };
      }
      throw error;
    }
  }
}

export interface StagingWireRequest {
  readonly method: 'GET' | 'POST';
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body?: Readonly<Record<string, unknown>>;
}

const MUTATING_HARNESS_OPERATIONS = new Set<HarnessTransportOperation>([
  'create_workspace',
  'create_project',
  'create_canvas',
  'apply_canvas_patch',
  'quote_run',
  'start_run',
]);

export function buildStagingWireRequest(
  operation: HarnessTransportOperation,
  input: Readonly<Record<string, unknown>>,
  accessToken: string,
): StagingWireRequest {
  const id = (field: string): string => text(input[field], field);
  const context = record(input.context, 'context');
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
    'x-request-id': text(context.request_id, 'context.request_id'),
  };
  if (MUTATING_HARNESS_OPERATIONS.has(operation)) {
    headers['idempotency-key'] = text(input.idempotency_key, 'idempotency_key');
  }
  if (operation === 'create_workspace')
    return {
      method: 'POST',
      path: '/v1/workspaces',
      headers,
      body: { name: input.name },
    };
  if (operation === 'create_project')
    return {
      method: 'POST',
      path: `/v1/workspaces/${id('workspace_id')}/projects`,
      headers,
      body: { name: input.name },
    };
  if (operation === 'create_canvas')
    return {
      method: 'POST',
      path: `/v1/projects/${id('project_id')}/canvases`,
      headers,
      body: { name: input.name },
    };
  if (operation === 'apply_canvas_patch')
    return {
      method: 'POST',
      path: `/v1/canvases/${id('canvas_id')}/patches`,
      headers,
      body: {
        expected_revision_id: input.expected_revision_id,
        reason: input.reason,
        patch: input.patch,
      },
    };
  if (operation === 'validate_graph')
    return {
      method: 'POST',
      path: `/v1/canvases/${id('canvas_id')}/validate`,
      headers,
      body: {},
    };
  if (operation === 'quote_run')
    return {
      method: 'POST',
      path: `/v1/canvases/${id('canvas_id')}/quotes`,
      headers,
      body: { expected_revision_id: input.expected_revision_id },
    };
  if (operation === 'start_run')
    return {
      method: 'POST',
      path: `/v1/quotes/${id('quote_id')}/runs`,
      headers,
      body: { confirmed: input.confirmed, confirmation_token: input.confirmation_token },
    };
  if (operation === 'get_run') return { method: 'GET', path: `/v1/runs/${id('run_id')}`, headers };
  return { method: 'GET', path: `/v1/runs/${id('run_id')}/receipt`, headers };
}

export class StagingLaunchPackTransport implements HarnessTransport {
  constructor(
    private readonly baseUrl: string,
    private readonly accessToken: string,
    private readonly fetchImplementation: typeof fetch = fetch,
    private readonly observeResponseBody?: (rawResponseText: string) => void,
  ) {}

  async call(
    operation: HarnessTransportOperation,
    input: Readonly<Record<string, unknown>>,
  ): Promise<HarnessResult> {
    const request = buildStagingWireRequest(operation, input, this.accessToken);
    const response = await this.fetchImplementation(`${this.baseUrl}${request.path}`, {
      method: request.method,
      headers: request.headers,
      ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
    });
    const rawResponseText = await response.text();
    this.observeResponseBody?.(rawResponseText);
    let body: unknown;
    try {
      body = JSON.parse(rawResponseText) as unknown;
    } catch {
      throw new HarnessFlowError({
        code: 'TRANSPORT_ERROR',
        message: 'Staging returned invalid JSON.',
        operation,
        http_status: response.status,
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
        operation,
        http_status: response.status,
      },
    };
  }
}
