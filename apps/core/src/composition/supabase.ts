import {
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
import type { CoreBindings } from '../bindings';
import { SupabaseDataApiError, SupabaseDataApiExecutor } from '../data/supabase-data-api';
import type {
  RequestDependencyFactory,
  RequestScopedDependencies,
  WorkspaceResolutionPort,
} from '../routes/v1';
import type { V1Operation } from '../routes/v1-table';
import { buildLaunchCatalogQuotePlan } from './launch-catalog';
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

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
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

function resourceWorkspaceTable(operation: V1Operation): string | null {
  if (operation === 'get_project' || operation === 'create_canvas') return 'projects';
  if (
    operation === 'get_canvas_context' ||
    operation === 'apply_canvas_patch' ||
    operation === 'validate_graph' ||
    operation === 'quote_run'
  ) {
    return 'canvases';
  }
  if (operation === 'start_run') return 'quotes';
  if (operation === 'get_run' || operation === 'cancel_run' || operation === 'create_export') {
    return 'runs';
  }
  if (operation === 'get_artifact') return 'artifacts';
  return null;
}

function createWorkspaceResolver(
  executor: SupabaseDataApiExecutor,
  actor: AuthenticatedActor,
): WorkspaceResolutionPort {
  return {
    async resolve({ operation, pathId }) {
      if (operation === 'create_workspace') return BOOTSTRAP_WORKSPACE_ID;
      if (operation === 'get_workspace' || operation === 'create_project') {
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
      const table = resourceWorkspaceTable(operation);
      if (table === null || pathId === undefined) return null;
      try {
        const row = await executor.request<Readonly<{ workspace_id: string }>>({
          path: `${table}?id=eq.${encodeURIComponent(pathId)}&select=workspace_id`,
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
      return artifact === null ? { status: 'not_found' } : { status: 'ok', artifact };
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
      async verify(context, input) {
        if (input.token.length < 16) return false;
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
        const row = await repositories.runs.get(asTenantContext(context), input.runId);
        if (row === null) return { status: 'conflict', actualState: 'failed' };
        return { status: 'conflict', actualState: runRecord(row).status };
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
      async execute(_identityKey, _inputFingerprint, work) {
        return { status: 'created', result: await work() };
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
  const commands = createCommandHandlers(createSupabaseHandlerPorts(executor, repositories));
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
