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
} from '@mustbeviral/contracts';
import {
  createDatabaseRepositories,
  tenantContext,
  type DatabaseRepositories,
  type Json,
  type TenantContext,
} from '../../../../packages/db/src/index';

import type { AuthenticatedActor } from '../auth/supabase-jwt';
import type { CoreBindings } from '../bindings';
import {
  SupabaseDataApiError,
  SupabaseDataApiExecutor,
  type SupabaseFailureKind,
} from '../data/supabase-data-api';
import type {
  RequestDependencyFactory,
  RequestScopedDependencies,
  WorkspaceResolutionPort,
} from '../routes/v1';
import type { V1Operation } from '../routes/v1-table';

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

function handlerContext(value: unknown): HandlerContext {
  if (!isRecord(value) || !isRecord(value.context))
    throw new TypeError('Handler context is required');
  return {
    workspace_id: requiredString(value.context.workspace_id, 'workspace_id'),
    actor_id: requiredString(value.context.actor_id, 'actor_id'),
    request_id: requiredString(value.context.request_id, 'request_id'),
  };
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

function runRecord(row: Readonly<Record<string, unknown>>, reservationId = ''): RunRecord {
  const status = requiredString(row.status, 'run.status');
  if (!RUN_STATES.has(status)) throw new TypeError('Database returned an unsupported run state');
  return {
    runId: requiredString(row.id, 'run.id'),
    canvasId: requiredString(row.canvas_id, 'run.canvas_id'),
    canvasRevisionId: requiredString(row.canvas_revision_id, 'run.canvas_revision_id'),
    quoteId: requiredString(row.quote_id, 'run.quote_id'),
    status: status as RunRecord['status'],
    reservationId,
  };
}

function failureResult(kind: SupabaseFailureKind): P0HandlerResult | null {
  if (kind === 'forbidden') return { status: 'forbidden' };
  if (kind === 'not_found') return { status: 'not_found' };
  if (kind === 'conflict') return { status: 'conflict', reason: 'idempotency' };
  if (kind === 'expired_quote') return { status: 'expired_quote' };
  if (kind === 'cap_exceeded') return { status: 'cap_exceeded' };
  if (kind === 'graph_invalid') return { status: 'graph_invalid' };
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
            const result = failureResult(error.kind);
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
): P0ResourcePort {
  return {
    async createWorkspace(value) {
      const input = requestInput(value);
      const context = handlerContext(input);
      const name = requiredString(input.name, 'name');
      const result = await executor.rpc('create_workspace', {
        p_name: name,
        p_slug: slugify(name),
        p_idempotency_key: requiredString(input.idempotency_key, 'idempotency_key'),
        p_request_id: context.request_id,
      });
      return { status: 'ok', ...requestInput(result) };
    },
    async getWorkspace(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const row = await repositories.workspaces.get(context);
      return row === null ? { status: 'not_found' } : { status: 'ok', workspace: row };
    },
    async createProject(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const name = requiredString(input.name, 'name');
      const idempotencyKey = requiredString(input.idempotency_key, 'idempotency_key');
      const projectId = await deterministicUuid(
        `create_project\u0000${context.actorId}\u0000${context.workspaceId}\u0000${idempotencyKey}`,
      );
      try {
        const project = await repositories.projects.create(context, {
          id: projectId,
          name,
          briefId: null,
          brandKitId: null,
        });
        return { status: 'ok', project };
      } catch (error) {
        if (!(error instanceof SupabaseDataApiError) || error.kind !== 'conflict') throw error;
        const existing = await repositories.projects.get(context, projectId);
        if (existing === null || existing.name !== name) {
          return { status: 'conflict', reason: 'idempotency' };
        }
        return { status: 'ok', project: existing };
      }
    },
    async getProject(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const project = await repositories.projects.get(
        context,
        requiredString(input.project_id, 'project_id'),
      );
      return project === null ? { status: 'not_found' } : { status: 'ok', project };
    },
    async createCanvas(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const canvas = await repositories.canvases.createWithRevision(context, {
        projectId: requiredString(input.project_id, 'project_id'),
        name: typeof input.name === 'string' ? input.name : 'Untitled canvas',
        graphSchemaVersion: 1,
        graphSnapshot: initialGraph(),
        reason: 'Initial canvas revision',
        idempotencyKey: requiredString(input.idempotency_key, 'idempotency_key'),
      });
      return { status: 'ok', ...canvas };
    },
    async createArtifactUpload() {
      throw new ProviderUnavailableError('Private upload signing is not configured');
    },
    async getArtifact(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const artifact = await repositories.artifacts.get(
        context,
        requiredString(input.artifact_id, 'artifact_id'),
      );
      return artifact === null ? { status: 'not_found' } : { status: 'ok', artifact };
    },
    async createExport() {
      throw new ProviderUnavailableError('Export generation is not configured');
    },
    async explainModel(value) {
      const input = requestInput(value);
      const model = await executor.selectOne('model_routes', {
        id: `eq.${requiredString(input.model_id, 'model_id')}`,
        select: '*',
      });
      return model === null ? { status: 'not_found' } : { status: 'ok', model };
    },
    async getReceipt(value) {
      const input = requestInput(value);
      const context = asTenantContext(handlerContext(input));
      const runId = requiredString(input.run_id, 'run_id');
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
    async ingestFalWebhook() {
      throw new ProviderUnavailableError('Provider webhook processing is not configured');
    },
  };
}

function createHandlerPorts(
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
      async quotePlan() {
        throw new ProviderUnavailableError('Provider-backed quoting is not configured');
      },
    },
    quotes: {
      async get() {
        throw new ProviderUnavailableError('Provider-backed quoting is not configured');
      },
      async save() {
        throw new ProviderUnavailableError('Provider-backed quoting is not configured');
      },
    },
    billing: {
      async get() {
        throw new ProviderUnavailableError('Provider-backed billing is not configured');
      },
    },
    confirmations: { verify: async () => false },
    runs: {
      async get(context, runId) {
        const tenant = asTenantContext(context);
        const row = await repositories.runs.get(tenant, runId);
        if (row === null) return null;
        const reservation = await repositories.billing.getReservationForRun(tenant, runId);
        return runRecord(row, reservation?.id);
      },
      async startBarrier() {
        throw new ProviderUnavailableError('Provider-backed run start is not configured');
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
  const commands = createCommandHandlers(createHandlerPorts(executor, repositories));
  const resources = createP0ResourceHandlers(createResourcePort(executor, repositories));
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
