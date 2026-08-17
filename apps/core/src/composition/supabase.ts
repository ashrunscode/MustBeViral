import {
  parseLaunchPackCopy,
  GraphSnapshotSchema,
  P0_REST_OPERATIONS,
  createCommandHandlers,
  createP0ResourceHandlers,
  createP0RestHandlers,
  type ArtifactRecord,
  type CanvasContextRecord,
  type HandlerContext,
  type HandlerPorts,
  type P0HandlerResult,
  type P0RestHandlers,
  type P0ResourcePort,
  type RunRecord,
  type RunNodeRecord,
  type StoredQuote,
} from '@mustbeviral/contracts';
import {
  DEFAULT_GLOBAL_DAY_CAP_MICROS,
  modelPriceUnits,
  quoteExpiryState,
  usdMicros,
  type ImmutableRunQuote,
  type ModelPriceUnit,
  type QuoteNodeLine,
} from '../../../../packages/billing/src/index';
import {
  createDatabaseRepositories,
  tenantContext,
  type DatabaseRow,
  type DatabaseRepositories,
  type Json,
  type TenantContext,
} from '../../../../packages/db/src/index';

import type { AuthenticatedActor } from '../auth/supabase-jwt';
import {
  CUSTOMER_DOWNLOAD_TTL_SECONDS,
  REVIEW_PREVIEW_TTL_SECONDS,
} from '../../../../packages/artifacts/src/index';

import { mintArtifactAccessUrl } from './artifact-access';
import type { CoreBindings } from '../bindings';
import { SupabaseDataApiError, SupabaseDataApiExecutor } from '../data/supabase-data-api';
import type {
  RequestDependencyFactory,
  RequestScopedDependencies,
  WorkspaceResolutionPort,
} from '../routes/v1';
import type { V1Operation } from '../routes/v1-table';
import { buildLaunchCatalogQuotePlan } from './launch-catalog';
import { mintConfirmationToken, verifyConfirmationToken } from './confirmation-token';
import { createPrivateRunExport } from './export';
import { createFalWebhookIngestHandler } from './fal-ingest';
import type { VerifiedFalWebhook } from '../../../../packages/provider/src/webhook';

const BOOTSTRAP_WORKSPACE_ID = '00000000-0000-4000-8000-000000000000';
const RUN_STATES = new Set([
  'queued',
  'dispatching',
  'running',
  'partial_succeeded',
  'succeeded',
  'cancel_requested',
  'canceled',
  'failed',
  'reconciliation_required',
]);

class ProviderUnavailableError extends Error {
  override readonly name = 'ProviderUnavailableError';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} is required`);
  return value;
}

function asTenantContext(context: HandlerContext): TenantContext {
  return tenantContext({
    workspaceId: context.workspace_id,
    actorId: context.actor_id,
    requestId: context.request_id,
  });
}

function requestInput(value: unknown): Readonly<Record<string, unknown>> {
  if (!isRecord(value)) throw new TypeError('Handler input must be an object');
  return value;
}

/**
 * Operations recorded durably by the app-tier idempotency port. Exactly the operations whose RPCs
 * do NOT write their own idempotency_records row - the RPC-owned five insert into the same unique
 * tuple with their own request-hash format, so recording them here would collide or mask.
 */
const APP_TIER_IDEMPOTENT_OPERATIONS: ReadonlySet<string> = new Set([
  'create_project',
  'cancel_run',
  'create_export',
  'create_artifact_upload',
  'approve_artifacts',
]);

async function sha256HexOf(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Reversible result storage. Handler results can carry bigint money values, and plain JSON
 * stringification would silently turn them into strings - a replayed response would then differ in
 * type from the original, which is exactly the kind of drift idempotency exists to prevent.
 */
const BIGINT_MARKER = '$mbv_bigint';

function serializeStoredResult(result: unknown): Json {
  // Round-tripped through JSON.stringify, so the value is JSON-safe by construction.
  return JSON.parse(
    JSON.stringify({ result: result ?? null }, (_key, value: unknown) =>
      typeof value === 'bigint' ? { [BIGINT_MARKER]: value.toString(10) } : value,
    ),
  ) as Json;
}

function reviveBigints(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reviveBigints);
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>);
    const [first] = entries;
    if (entries.length === 1 && first !== undefined && first[0] === BIGINT_MARKER) {
      const digits = first[1];
      if (typeof digits === 'string' && /^-?\d+$/u.test(digits)) return BigInt(digits);
    }
    return Object.fromEntries(entries.map(([key, entry]) => [key, reviveBigints(entry)]));
  }
  return value;
}

function reviveStoredResult<Result>(payload: unknown): Result {
  const record = requestInput(payload);
  return reviveBigints(record.result) as Result;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80)
    .replace(/-+$/gu, '');
  return slug.length > 0 ? slug : 'workspace';
}

async function deterministicUuid(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)),
  ).slice(0, 16);
  digest[6] = ((digest[6] ?? 0) & 0x0f) | 0x50;
  digest[8] = ((digest[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function initialGraph(): Json {
  return {
    nodes: [
      {
        id: 'brief',
        kind: 'brief',
        parameter_schema_version: 1,
        parameters: {},
      },
    ],
    edges: [],
  };
}

type GraphJsonValue = CanvasContextRecord['graphSnapshot']['nodes'][number]['parameters'][string];

function graphJsonValue(value: unknown): GraphJsonValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(graphJsonValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, graphJsonValue(entry)]),
    );
  }
  throw new TypeError('Graph snapshot contains a non-JSON value');
}

function graphSnapshot(value: unknown): CanvasContextRecord['graphSnapshot'] {
  const parsed = GraphSnapshotSchema.parse(value);
  return {
    nodes: parsed.nodes.map((node) => ({
      ...node,
      parameters: Object.fromEntries(
        Object.entries(node.parameters).map(([key, entry]) => [key, graphJsonValue(entry)]),
      ),
    })),
    edges: parsed.edges,
  };
}

function databaseJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(databaseJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, databaseJson(entry)]),
    );
  }
  throw new TypeError('Value is not JSON serializable');
}

function jsonMicros(value: unknown, field: string): ReturnType<typeof usdMicros> {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
    return usdMicros(BigInt(value));
  }
  if (typeof value === 'string' && /^\d+$/u.test(value)) return usdMicros(BigInt(value));
  throw new TypeError(`${field} must be an integer-micros value`);
}

function priceUnit(value: unknown): ModelPriceUnit {
  if (typeof value !== 'string' || !modelPriceUnits.includes(value as ModelPriceUnit)) {
    throw new TypeError('Quote plan has an invalid price unit');
  }
  return value as ModelPriceUnit;
}

function quoteNodeLine(value: unknown): QuoteNodeLine {
  const line = requestInput(value);
  if (!Array.isArray(line.price_components) || line.price_components.length === 0) {
    throw new TypeError('Quote plan line requires price components');
  }
  return {
    nodeId: requiredString(line.node_id, 'quote.node_id'),
    modelRouteId: requiredString(line.model_route_id, 'quote.model_route_id'),
    providerModelId: requiredString(line.provider_model_id, 'quote.provider_model_id'),
    priceComponents: line.price_components.map((value) => {
      const component = requestInput(value);
      const quantity = requiredString(component.quantity, 'quote.quantity');
      if (!/^\d+$/u.test(quantity)) throw new TypeError('quote.quantity must be an integer');
      return {
        unit: priceUnit(component.unit),
        quantity: BigInt(quantity),
        unitPriceMicros: jsonMicros(component.unit_price_micros, 'quote.unit_price_micros'),
        totalMicros: jsonMicros(component.total_micros, 'quote.total_micros'),
      };
    }),
    totalMicros: jsonMicros(line.total_micros, 'quote.line_total_micros'),
  };
}

function quoteFromRow(row: Readonly<DatabaseRow<'quotes'>>): ImmutableRunQuote {
  if (row.currency !== 'USD' || !Array.isArray(row.execution_plan)) {
    throw new TypeError('Database returned an invalid quote');
  }
  return {
    quoteId: row.id,
    workspaceId: row.workspace_id,
    canvasRevisionId: row.canvas_revision_id,
    priceCatalogVersionId: row.price_catalog_version_id,
    currency: 'USD',
    nodeLines: row.execution_plan.map(quoteNodeLine),
    maximumChargeMicros: usdMicros(BigInt(row.maximum_charge_micros)),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

async function storedQuoteFromRow(
  repositories: DatabaseRepositories,
  context: TenantContext,
  row: Readonly<DatabaseRow<'quotes'>>,
): Promise<StoredQuote> {
  const revision = await repositories.canvases.getRevision(context, row.canvas_revision_id);
  if (revision === null || revision.canvas_id !== row.canvas_id) {
    throw new SupabaseDataApiError('not_found');
  }
  return {
    canvasId: row.canvas_id,
    projectId: row.project_id,
    quote: quoteFromRow(row),
    snapshot: graphSnapshot(revision.graph_snapshot),
  };
}

function utcDayWindow(now: string): Readonly<{ start: string; end: string }> {
  const instant = new Date(now);
  if (!Number.isFinite(instant.getTime())) throw new TypeError('Clock returned an invalid time');
  const start = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function runStateFrom(value: unknown): RunRecord['status'] {
  const state = requiredString(value, 'run.status');
  if (!RUN_STATES.has(state)) throw new TypeError('Database returned an unsupported run state');
  return state as RunRecord['status'];
}

function runRecord(row: Readonly<Record<string, unknown>>, reservationId = ''): RunRecord {
  const status = requiredString(row.status, 'run.status');
  if (!RUN_STATES.has(status)) throw new TypeError('Database returned an unsupported run state');
  return {
    runId: requiredString(row.id, 'run.id'),
    projectId: requiredString(row.project_id, 'run.project_id'),
    canvasId: requiredString(row.canvas_id, 'run.canvas_id'),
    canvasRevisionId: requiredString(row.canvas_revision_id, 'run.canvas_revision_id'),
    quoteId: requiredString(row.quote_id, 'run.quote_id'),
    status: status as RunRecord['status'],
    reservationId,
  };
}

const RUN_NODE_STATES = new Set([
  'pending',
  'ready',
  'queued',
  'running',
  'succeeded',
  'failed',
  'canceled',
  'skipped',
  'reconciliation_required',
]);

function runNodeRecord(row: Readonly<DatabaseRow<'run_nodes'>>): RunNodeRecord {
  const status = requiredString(row.status, 'run_node.status');
  if (!RUN_NODE_STATES.has(status)) {
    throw new TypeError('Database returned an unsupported run-node state');
  }
  return {
    runNodeId: row.id,
    nodeKey: row.node_key,
    modelRouteId: row.model_route_id,
    status: status as RunNodeRecord['status'],
    dispatchWave: row.dispatch_wave,
  };
}

function failureResult(error: SupabaseDataApiError): P0HandlerResult | null {
  if (error.kind === 'forbidden') return { status: 'forbidden' };
  if (error.kind === 'not_found') return { status: 'not_found' };
  if (error.kind === 'conflict') {
    const reason =
      error.safeDetails.conflictReason === 'quote_stale'
        ? 'quote_stale'
        : error.safeDetails.conflictReason === 'revision'
          ? 'revision'
          : 'idempotency';
    return {
      status: 'conflict',
      reason,
    };
  }
  if (error.kind === 'expired_quote') return { status: 'expired_quote' };
  if (error.kind === 'cap_exceeded') return { status: 'cap_exceeded' };
  if (error.kind === 'graph_invalid') return { status: 'graph_invalid' };
  return null;
}

function withDatabaseFailures(handlers: P0RestHandlers): P0RestHandlers {
  return Object.fromEntries(
    P0_REST_OPERATIONS.map((operation) => [
      operation,
      async (input: unknown): Promise<P0HandlerResult> => {
        try {
          return await handlers[operation](input);
        } catch (error) {
          if (error instanceof ProviderUnavailableError) return { status: 'provider_unavailable' };
          if (error instanceof SupabaseDataApiError) {
            const result = failureResult(error);
            if (result !== null) return result;
            if (error.kind === 'validation') throw new TypeError('Database rejected the request');
          }
          throw error;
        }
      },
    ]),
  ) as P0RestHandlers;
}

type WorkspaceResourceTable = 'projects' | 'canvases' | 'quotes' | 'runs' | 'artifacts';

type WorkspaceResolutionStrategy =
  | Readonly<{ kind: 'bootstrap' }>
  | Readonly<{ kind: 'path_membership' }>
  | Readonly<{ kind: 'path_resource'; table: WorkspaceResourceTable }>
  | Readonly<{
      kind: 'body_resource';
      table: WorkspaceResourceTable;
      bodyField: 'project_id';
    }>
  | Readonly<{ kind: 'actor_membership' }>
  | Readonly<{ kind: 'webhook' }>;

const WORKSPACE_RESOLUTION_BY_OPERATION = {
  create_workspace: { kind: 'bootstrap' },
  get_workspace: { kind: 'path_membership' },
  create_project: { kind: 'path_membership' },
  get_project: { kind: 'path_resource', table: 'projects' },
  create_canvas: { kind: 'path_resource', table: 'projects' },
  get_canvas_context: { kind: 'path_resource', table: 'canvases' },
  apply_canvas_patch: { kind: 'path_resource', table: 'canvases' },
  validate_graph: { kind: 'path_resource', table: 'canvases' },
  quote_run: { kind: 'path_resource', table: 'canvases' },
  start_run: { kind: 'path_resource', table: 'quotes' },
  get_run: { kind: 'path_resource', table: 'runs' },
  cancel_run: { kind: 'path_resource', table: 'runs' },
  create_artifact_upload: {
    kind: 'body_resource',
    table: 'projects',
    bodyField: 'project_id',
  },
  get_artifact: { kind: 'path_resource', table: 'artifacts' },
  approve_artifacts: { kind: 'path_resource', table: 'runs' },
  create_export: { kind: 'path_resource', table: 'runs' },
  explain_model: { kind: 'actor_membership' },
  get_receipt: { kind: 'path_resource', table: 'runs' },
  ingest_fal_webhook: { kind: 'webhook' },
} as const satisfies Readonly<Record<V1Operation, WorkspaceResolutionStrategy>>;

function createWorkspaceResolver(
  executor: SupabaseDataApiExecutor,
  actor: AuthenticatedActor,
): WorkspaceResolutionPort {
  return {
    async resolve({ operation, pathId, body }) {
      const strategy = WORKSPACE_RESOLUTION_BY_OPERATION[operation];
      if (strategy.kind === 'bootstrap') return BOOTSTRAP_WORKSPACE_ID;
      if (strategy.kind === 'path_membership') {
        if (pathId === undefined) return null;
        const membership = await executor.selectOne('workspace_memberships', {
          workspace_id: `eq.${pathId}`,
          user_id: `eq.${actor.actorId}`,
          status: 'eq.active',
          revoked_at: 'is.null',
          select: 'workspace_id',
        });
        return membership?.workspace_id ?? null;
      }
      if (strategy.kind === 'actor_membership') {
        const membership = await executor.selectOne('workspace_memberships', {
          user_id: `eq.${actor.actorId}`,
          status: 'eq.active',
          revoked_at: 'is.null',
          select: 'workspace_id',
          order: 'created_at.asc',
          limit: '1',
        });
        return membership?.workspace_id ?? null;
      }
      if (strategy.kind === 'webhook') return null;
      const resourceId = strategy.kind === 'path_resource' ? pathId : body[strategy.bodyField];
      if (typeof resourceId !== 'string' || resourceId.length === 0) return null;
      try {
        const row = await executor.request<Readonly<{ workspace_id: string }>>({
          path: `${strategy.table}?id=eq.${encodeURIComponent(resourceId)}&select=workspace_id`,
          single: true,
        });
        return row.workspace_id;
      } catch (error) {
        if (
          error instanceof SupabaseDataApiError &&
          (error.kind === 'not_found' || error.kind === 'forbidden')
        ) {
          return null;
        }
        throw error;
      }
    },
  };
}

async function readReviewCopy(
  bindings: CoreBindings,
  objectKey: string,
  mimeType: string,
): Promise<{ primary_text: string; headline: string; description: string } | null> {
  if (!mimeType.includes('json')) return null;
  try {
    const object = await bindings.MEDIA_BUCKET.get(objectKey);
    if (object === null) return null;
    return parseLaunchPackCopy(await object.text());
  } catch {
    return null;
  }
}

function createResourcePort(
  executor: SupabaseDataApiExecutor,
  repositories: DatabaseRepositories,
  bindings: CoreBindings,
  fetchImplementation?: typeof fetch,
): P0ResourcePort {
  return {
    async createWorkspace(input) {
      const result = await executor.rpc('create_workspace', {
        p_name: input.name,
        p_slug: slugify(input.name),
        p_idempotency_key: input.idempotency_key,
        p_request_id: input.context.request_id,
      });
      return { status: 'ok', ...requestInput(result) };
    },
    async getWorkspace(input) {
      const context = asTenantContext(input.context);
      const row = await repositories.workspaces.get(context);
      return row === null ? { status: 'not_found' } : { status: 'ok', workspace: row };
    },
    async createProject(input) {
      const context = asTenantContext(input.context);
      const idempotencyKey = input.idempotency_key;
      const projectId = await deterministicUuid(
        `create_project\u0000${context.actorId}\u0000${context.workspaceId}\u0000${idempotencyKey}`,
      );
      try {
        const project = await repositories.projects.create(context, {
          id: projectId,
          name: input.name,
          briefId: null,
          brandKitId: null,
        });
        return { status: 'ok', project };
      } catch (error) {
        if (!(error instanceof SupabaseDataApiError) || error.kind !== 'conflict') throw error;
        const existing = await repositories.projects.get(context, projectId);
        if (existing === null || existing.name !== input.name) {
          return { status: 'conflict', reason: 'idempotency' };
        }
        return { status: 'ok', project: existing };
      }
    },
    async getProject(input) {
      const context = asTenantContext(input.context);
      const project = await repositories.projects.get(context, input.project_id);
      return project === null ? { status: 'not_found' } : { status: 'ok', project };
    },
    async createCanvas(input) {
      const context = asTenantContext(input.context);
      const canvas = await repositories.canvases.createWithRevision(context, {
        projectId: input.project_id,
        name: input.name ?? 'Untitled canvas',
        graphSchemaVersion: 1,
        graphSnapshot: initialGraph(),
        reason: 'Initial canvas revision',
        idempotencyKey: input.idempotency_key,
      });
      return { status: 'ok', ...canvas };
    },
    async createArtifactUpload() {
      throw new ProviderUnavailableError('Private upload signing is not configured');
    },
    async getArtifact(input) {
      const context = asTenantContext(input.context);
      const artifact = await repositories.artifacts.get(context, input.artifact_id);
      if (artifact === null) return { status: 'not_found' };
      const copy = await readReviewCopy(bindings, artifact.object_key, artifact.mime_type);
      if (artifact.content_hash === null || artifact.status !== 'available') {
        return { status: 'ok', artifact, access: null, copy };
      }
      try {
        const nowEpochSeconds = Math.floor(Date.now() / 1000);
        const purpose =
          artifact.artifact_kind === 'export' ? 'customer_download' : 'review_preview';
        const ttlSeconds =
          purpose === 'customer_download'
            ? CUSTOMER_DOWNLOAD_TTL_SECONDS
            : REVIEW_PREVIEW_TTL_SECONDS;
        const url = await mintArtifactAccessUrl(bindings, {
          purpose,
          artifactId: artifact.id,
          objectKey: artifact.object_key,
          contentHash: artifact.content_hash,
          byteSize: artifact.byte_size,
          mimeType: artifact.mime_type,
          nowEpochSeconds,
        });
        return {
          status: 'ok',
          artifact,
          access: {
            url,
            expires_at: new Date((nowEpochSeconds + ttlSeconds) * 1000).toISOString(),
            purpose,
          },
          copy,
        };
      } catch {
        return { status: 'ok', artifact, access: null, copy };
      }
    },
    async approveArtifacts(input) {
      // Caller-scoped on purpose: the RPC runs as the authenticated user through PostgREST, so
      // auth.uid() and the workspace-owner check inside approve_run_artifacts are the authority.
      // The machine never approves on a customer's behalf, and register_artifact refuses to mint
      // approved_output directly - promotion through this RPC is the only path.
      try {
        const result = requestInput(
          await executor.rpc('approve_run_artifacts', {
            p_run_id: input.run_id,
            p_approvals: input.approvals,
            p_request_id: input.context.request_id,
          }),
        );
        return { status: 'ok', ...result };
      } catch (error) {
        if (error instanceof SupabaseDataApiError && error.kind === 'conflict') {
          // RUN_NOT_APPROVABLE / ARTIFACT_NOT_APPROVABLE: the run's money is still moving, or the
          // artifact is not an available provider_output. A state conflict, not a validation fault.
          return { status: 'conflict', reason: 'approval' };
        }
        throw error;
      }
    },
    async createExport(input) {
      return await createPrivateRunExport(
        bindings,
        {
          runId: input.run_id,
          artifactIds: input.artifact_ids,
          format: input.format,
        },
        fetchImplementation,
      );
    },
    async explainModel(input) {
      const model = await executor.selectOne('model_routes', {
        id: `eq.${input.model_id}`,
        select: '*',
      });
      return model === null ? { status: 'not_found' } : { status: 'ok', model };
    },
    async getReceipt(input) {
      const context = asTenantContext(input.context);
      const runId = input.run_id;
      const run = await repositories.runs.get(context, runId);
      if (run === null) return { status: 'not_found' };
      const [reservation, ledger, artifacts] = await Promise.all([
        repositories.billing.getReservationForRun(context, runId),
        repositories.billing.listLedger(context, 100),
        repositories.artifacts.listForRun(context, runId, 100),
      ]);
      const lineage = (
        await Promise.all(
          artifacts.map((artifact) => repositories.artifacts.listLineage(context, artifact.id)),
        )
      ).flat();
      return {
        status: 'ok',
        receipt: {
          run,
          reservation,
          ledger: ledger.filter((entry) => entry.run_id === runId),
          artifacts,
          lineage,
        },
      };
    },
    async ingestFalWebhook(input) {
      return await createFalWebhookIngestHandler(
        bindings,
        requiredString(input.identity.event_id, 'identity.event_id'),
        fetchImplementation,
      )(input.event as VerifiedFalWebhook);
    },
  };
}

export function createSupabaseHandlerPorts(
  executor: SupabaseDataApiExecutor,
  repositories: DatabaseRepositories,
  // Only the signing key, not the whole binding set: the handler ports must not grow ambient
  // access to provider credentials through this seam.
  bindings: Pick<CoreBindings, 'CONFIRMATION_SIGNING_KEY'>,
): HandlerPorts {
  return {
    authorization: {
      async authorize(context) {
        const membership = await executor.selectOne('workspace_memberships', {
          workspace_id: `eq.${context.workspace_id}`,
          user_id: `eq.${context.actor_id}`,
          status: 'eq.active',
          revoked_at: 'is.null',
          select: 'id',
        });
        return membership !== null;
      },
    },
    canvases: {
      async get(context, canvasId): Promise<CanvasContextRecord | null> {
        const tenant = asTenantContext(context);
        const canvas = await repositories.canvases.get(tenant, canvasId);
        if (canvas?.head_revision_id === null || canvas === null) return null;
        const revision = await repositories.canvases.getRevision(tenant, canvas.head_revision_id);
        if (revision === null) return null;
        return {
          canvasId: canvas.id,
          projectId: canvas.project_id,
          headRevisionId: revision.id,
          graphSchemaVersion: revision.graph_schema_version,
          graphSnapshot: graphSnapshot(revision.graph_snapshot),
          canonicalHash: revision.canonical_hash,
        };
      },
      async compareAndSwapRevision(context, input) {
        try {
          const result = await repositories.canvases.applyRevision(asTenantContext(context), {
            canvasId: input.canvasId,
            expectedRevisionId: input.expectedRevisionId,
            graphSchemaVersion: input.graphSchemaVersion,
            graphSnapshot: databaseJson(input.graphSnapshot),
            reason: input.reason,
            idempotencyKey: input.idempotencyKey,
          });
          return {
            status: 'ok',
            revisionId: result.revisionId,
            canonicalHash: result.canonicalHash,
          };
        } catch (error) {
          if (error instanceof SupabaseDataApiError && error.kind === 'conflict') {
            const current = await repositories.canvases.get(
              asTenantContext(context),
              input.canvasId,
            );
            return { status: 'conflict', actualHead: current?.head_revision_id ?? '' };
          }
          throw error;
        }
      },
    },
    catalog: {
      async quotePlan(_context, snapshot) {
        const [versions, routes, prices] = await Promise.all([
          repositories.catalog.listActiveVersions(),
          repositories.catalog.listRoutes(),
          repositories.catalog.listPrices(),
        ]);
        try {
          return buildLaunchCatalogQuotePlan(snapshot, { versions, routes, prices });
        } catch (error) {
          if (error instanceof RangeError) {
            throw new SupabaseDataApiError('conflict', { conflictReason: 'quote_stale' });
          }
          throw error;
        }
      },
    },
    quotes: {
      async get(context, quoteId) {
        const tenant = asTenantContext(context);
        const row = await repositories.billing.getQuote(tenant, quoteId);
        return row === null ? null : storedQuoteFromRow(repositories, tenant, row);
      },
      async save(context, input, idempotencyKey) {
        const tenant = asTenantContext(context);
        if (input.quote.workspaceId !== context.workspace_id) {
          throw new SupabaseDataApiError('forbidden');
        }
        const canvas = await repositories.canvases.get(tenant, input.canvasId);
        if (canvas === null) throw new SupabaseDataApiError('not_found');
        if (canvas.head_revision_id !== input.quote.canvasRevisionId) {
          throw new SupabaseDataApiError('conflict');
        }
        const result = requestInput(
          await executor.rpc('create_quote', {
            p_workspace_id: context.workspace_id,
            p_canvas_id: input.canvasId,
            p_expected_revision_id: input.quote.canvasRevisionId,
            p_idempotency_key: idempotencyKey,
            p_request_id: context.request_id,
          }),
        );
        const quoteId = requiredString(result.quote_id, 'quote_id');
        const row = await repositories.billing.getQuote(tenant, quoteId);
        if (row === null) throw new SupabaseDataApiError('not_found');
        return storedQuoteFromRow(repositories, tenant, row);
      },
    },
    billing: {
      async get(context) {
        const tenant = asTenantContext(context);
        const workspace = await repositories.workspaces.get(tenant);
        if (workspace === null) throw new SupabaseDataApiError('not_found');
        const day = utcDayWindow(new Date().toISOString());
        const [availableBalance, workspaceDayExposure] = await Promise.all([
          repositories.billing.availableBalance(tenant),
          repositories.billing.dailyExposure(tenant, day.start, day.end),
        ]);
        return {
          availableBalanceMicros: usdMicros(BigInt(availableBalance)),
          workspaceDayExposureMicros: usdMicros(BigInt(workspaceDayExposure)),
          // Caller-scoped RLS cannot observe other tenants; start_run_barrier remains global authority.
          globalDayExposureMicros: usdMicros(BigInt(workspaceDayExposure)),
          caps: {
            run: usdMicros(BigInt(workspace.per_run_spend_cap_micros)),
            workspaceDay: usdMicros(BigInt(workspace.daily_spend_cap_micros)),
            globalDay: DEFAULT_GLOBAL_DAY_CAP_MICROS,
          },
        };
      },
    },
    confirmations: {
      async mint(context, input) {
        return mintConfirmationToken(bindings, {
          quoteId: input.quoteId,
          workspaceId: context.workspace_id,
          actorId: context.actor_id,
          maximumChargeMicros: input.maximumChargeMicros,
        });
      },
      async verify(context, input) {
        // The cryptographic check is the consent proof: only the server can mint a token, and it
        // binds the quote, workspace, actor and exact amount. The previous check accepted any
        // string of 16+ characters, which let an agent holding a quote id self-confirm real spend.
        const tokenValid = await verifyConfirmationToken(bindings, input.token, {
          quoteId: input.quoteId,
          workspaceId: context.workspace_id,
          actorId: context.actor_id,
          maximumChargeMicros: input.maximumChargeMicros,
        });
        if (!tokenValid) return false;
        // The database checks stay: the token proves consent was granted, the row proves the quote
        // is still the active, unexpired one for this workspace at this amount.
        const row = await repositories.billing.getQuote(asTenantContext(context), input.quoteId);
        if (row === null) return false;
        const quote = quoteFromRow(row);
        return (
          quote.quoteId === input.quoteId &&
          quote.workspaceId === context.workspace_id &&
          quote.maximumChargeMicros === input.maximumChargeMicros &&
          quoteExpiryState(quote, new Date().toISOString()) === 'active'
        );
      },
    },
    runs: {
      async get(context, runId) {
        const tenant = asTenantContext(context);
        const row = await repositories.runs.get(tenant, runId);
        if (row === null) return null;
        const reservation = await repositories.billing.getReservationForRun(tenant, runId);
        return runRecord(row, reservation?.id);
      },
      async listNodes(context, runId) {
        return (await repositories.runs.listNodes(asTenantContext(context), runId)).map(
          runNodeRecord,
        );
      },
      async startBarrier(context, input) {
        return repositories.runs.startBarrier(asTenantContext(context), {
          canvasId: input.canvasId,
          expectedRevisionId: input.expectedRevisionId,
          quoteId: input.quoteId,
          confirmed: input.confirmed,
          idempotencyKey: input.idempotencyKey,
        });
      },
      async requestCancellation(context, input) {
        // The RPC re-checks state under a row lock, cancels attempts that never reached a
        // provider, leaves in-flight work to the webhook/reconciler, and either terminalizes the
        // run with a remainder release or parks it at cancel_requested for the finalizer. The
        // handler's expectedState is not forwarded: the lock-time check is authoritative, and an
        // equality check against a stale read would conflict legitimate cancels whose runs moved
        // queued -> dispatching in between.
        const result = requestInput(
          await executor.rpc('request_run_cancellation', {
            p_run_id: input.runId,
            p_reason: input.reason,
            p_request_id: context.request_id,
          }),
        );
        if (result.status === 'conflict') {
          return {
            status: 'conflict',
            actualState: runStateFrom(result.actual_state),
          };
        }
        return { status: 'ok' };
      },
    },
    artifacts: {
      async register(_context, artifact: ArtifactRecord) {
        void artifact;
        throw new ProviderUnavailableError('Artifact registration is not configured');
      },
      async registerLineage() {
        throw new ProviderUnavailableError('Artifact lineage registration is not configured');
      },
    },
    audit: { emit: async () => undefined },
    idempotency: {
      async execute(identity, inputFingerprint, work) {
        // Only the operations whose RPCs do NOT record their own idempotency. The five RPC-owned
        // operations insert into the same unique tuple with their own request-hash format; an
        // app-tier record for one of them would collide with or mask the RPC's record. The SQL
        // side enforces the same allowlist, so drift here fails loudly rather than silently.
        if (
          !APP_TIER_IDEMPOTENT_OPERATIONS.has(identity.operation) ||
          identity.workspaceId === null
        ) {
          return { status: 'created', result: await work() };
        }
        const requestHash = await sha256HexOf(inputFingerprint);
        const rpcInput = {
          p_workspace_id: identity.workspaceId,
          p_operation: identity.operation,
          p_idempotency_key: identity.idempotencyKey,
          p_request_hash: requestHash,
        };
        const existing = requestInput(await executor.rpc('find_app_idempotency', rpcInput));
        if (existing.status === 'replay') {
          return { status: 'replay', result: reviveStoredResult(existing.response) };
        }
        if (existing.status === 'conflict') return { status: 'conflict' };
        const result = await work();
        // Record after the work: a crash in between means the retry re-runs the work, which every
        // operation on the allowlist tolerates (deterministic ids, state-machine guards,
        // content-addressed keys). Recording before would replay a response that never happened.
        const recorded = requestInput(
          await executor.rpc('record_app_idempotency', {
            ...rpcInput,
            p_response: serializeStoredResult(result),
          }),
        );
        if (recorded.status === 'replay') {
          // Lost a concurrent race; the stored row is the authoritative outcome.
          return { status: 'replay', result: reviveStoredResult(recorded.response) };
        }
        if (recorded.status === 'conflict') return { status: 'conflict' };
        return { status: 'created', result };
      },
    },
    clock: { now: () => new Date().toISOString() },
    ids: { next: () => crypto.randomUUID() },
  };
}

export function createSupabaseRequestDependencies(
  bindings: CoreBindings,
  callerJwt: string,
  actor: AuthenticatedActor,
  fetchImplementation?: typeof fetch,
): RequestScopedDependencies | null {
  const baseUrl = bindings.SUPABASE_URL;
  const publishableKey = bindings.SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey) return null;
  const executor = new SupabaseDataApiExecutor({
    baseUrl,
    publishableKey,
    callerJwt,
    ...(fetchImplementation === undefined ? {} : { fetch: fetchImplementation }),
  });
  const repositories = createDatabaseRepositories(executor);
  const commands = createCommandHandlers(
    createSupabaseHandlerPorts(executor, repositories, bindings),
  );
  const resources = createP0ResourceHandlers(
    createResourcePort(executor, repositories, bindings, fetchImplementation),
  );
  return {
    handlers: withDatabaseFailures(createP0RestHandlers(commands, resources)),
    workspaces: createWorkspaceResolver(executor, actor),
  };
}

export const supabaseRequestDependencyFactory: RequestDependencyFactory = {
  create({ bindings, callerJwt, actor }) {
    return Promise.resolve(createSupabaseRequestDependencies(bindings, callerJwt, actor));
  },
};
