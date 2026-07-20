import type { Database, Json } from './database.generated';
import type { DatabaseExecutor } from './executor';
import type { IntegerMicros, TenantContext } from './invariants';
import { integerMicros } from './invariants';

type Tables = Database['public']['Tables'];
type Row<TableName extends keyof Tables> = Tables[TableName]['Row'];

export interface WorkspaceRepository {
  get(context: TenantContext): Promise<Readonly<Row<'workspaces'>> | null>;
  updateProfile(
    context: TenantContext,
    input: Readonly<{ name?: string; slug?: string }>,
  ): Promise<Readonly<Row<'workspaces'>>>;
}

export interface BriefRepository {
  get(context: TenantContext, briefId: string): Promise<Readonly<Row<'briefs'>> | null>;
  list(context: TenantContext, limit: number): Promise<readonly Readonly<Row<'briefs'>>[]>;
  create(
    context: TenantContext,
    input: Readonly<{ title: string; briefData: Json }>,
  ): Promise<Readonly<Row<'briefs'>>>;
}

export interface ProjectRepository {
  get(context: TenantContext, projectId: string): Promise<Readonly<Row<'projects'>> | null>;
  list(context: TenantContext, limit: number): Promise<readonly Readonly<Row<'projects'>>[]>;
  create(
    context: TenantContext,
    input: Readonly<{
      id?: string;
      name: string;
      briefId: string | null;
      brandKitId: string | null;
    }>,
  ): Promise<Readonly<Row<'projects'>>>;
}

export interface CanvasRepository {
  get(context: TenantContext, canvasId: string): Promise<Readonly<Row<'canvases'>> | null>;
  getRevision(
    context: TenantContext,
    revisionId: string,
  ): Promise<Readonly<Row<'canvas_revisions'>> | null>;
  createWithRevision(
    context: TenantContext,
    input: Readonly<{
      projectId: string;
      name: string;
      graphSchemaVersion: number;
      graphSnapshot: Json;
      reason: string;
      idempotencyKey: string;
    }>,
  ): Promise<Readonly<{ canvasId: string; revisionId: string; canonicalHash: string }>>;
  applyRevision(
    context: TenantContext,
    input: Readonly<{
      canvasId: string;
      expectedRevisionId: string;
      graphSchemaVersion: number;
      graphSnapshot: Json;
      reason: string;
      idempotencyKey: string;
    }>,
  ): Promise<Readonly<{ revisionId: string; canonicalHash: string }>>;
}

export interface RunRepository {
  get(context: TenantContext, runId: string): Promise<Readonly<Row<'runs'>> | null>;
  listNodes(context: TenantContext, runId: string): Promise<readonly Readonly<Row<'run_nodes'>>[]>;
  startBarrier(
    context: TenantContext,
    input: Readonly<{
      canvasId: string;
      expectedRevisionId: string;
      quoteId: string;
      confirmed: true;
      idempotencyKey: string;
    }>,
  ): Promise<Readonly<{ runId: string; reservationId: string; status: 'queued' }>>;
}

export interface ArtifactRepository {
  get(context: TenantContext, artifactId: string): Promise<Readonly<Row<'artifacts'>> | null>;
  listForRun(
    context: TenantContext,
    runId: string,
    limit: number,
  ): Promise<readonly Readonly<Row<'artifacts'>>[]>;
  listLineage(
    context: TenantContext,
    artifactId: string,
  ): Promise<readonly Readonly<Row<'artifact_lineage'>>[]>;
}

export interface BillingRepository {
  getQuote(context: TenantContext, quoteId: string): Promise<Readonly<Row<'quotes'>> | null>;
  getReservationForRun(
    context: TenantContext,
    runId: string,
  ): Promise<Readonly<Row<'cost_reservations'>> | null>;
  listLedger(
    context: TenantContext,
    limit: number,
  ): Promise<readonly Readonly<Row<'ledger_transactions'>>[]>;
  availableBalance(context: TenantContext): Promise<IntegerMicros>;
}

export interface DatabaseRepositories {
  readonly workspaces: WorkspaceRepository;
  readonly briefs: BriefRepository;
  readonly projects: ProjectRepository;
  readonly canvases: CanvasRepository;
  readonly runs: RunRepository;
  readonly artifacts: ArtifactRepository;
  readonly billing: BillingRepository;
}

function equals(value: string): string {
  return `eq.${value}`;
}

function limit(value: number): string {
  return String(Math.max(1, Math.min(100, Math.trunc(value))));
}

function rpcObject(value: Json): Readonly<Record<string, Json | undefined>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError('Database RPC returned an invalid result');
  }
  return value;
}

function requiredString(value: Json | undefined, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`Database RPC result is missing ${field}`);
  }
  return value;
}

export function createDatabaseRepositories(executor: DatabaseExecutor): DatabaseRepositories {
  return {
    workspaces: {
      get: (context) =>
        executor.selectOne('workspaces', {
          id: equals(context.workspaceId),
          select: '*',
        }),
      updateProfile: (context, input) =>
        executor.update('workspaces', { id: equals(context.workspaceId), select: '*' }, input),
    },
    briefs: {
      get: (context, briefId) =>
        executor.selectOne('briefs', {
          id: equals(briefId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      list: (context, requestedLimit) =>
        executor.select('briefs', {
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.desc,id.desc',
          limit: limit(requestedLimit),
        }),
      create: (context, input) =>
        executor.insert('briefs', {
          workspace_id: context.workspaceId,
          title: input.title,
          brief_data: input.briefData,
          created_by: context.actorId,
        }),
    },
    projects: {
      get: (context, projectId) =>
        executor.selectOne('projects', {
          id: equals(projectId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      list: (context, requestedLimit) =>
        executor.select('projects', {
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.desc,id.desc',
          limit: limit(requestedLimit),
        }),
      create: (context, input) =>
        executor.insert('projects', {
          ...(input.id === undefined ? {} : { id: input.id }),
          workspace_id: context.workspaceId,
          name: input.name,
          brief_id: input.briefId,
          brand_kit_id: input.brandKitId,
          created_by: context.actorId,
        }),
    },
    canvases: {
      get: (context, canvasId) =>
        executor.selectOne('canvases', {
          id: equals(canvasId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      getRevision: (context, revisionId) =>
        executor.selectOne('canvas_revisions', {
          id: equals(revisionId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      async createWithRevision(context, input) {
        const result = rpcObject(
          await executor.rpc('create_canvas_with_revision', {
            p_workspace_id: context.workspaceId,
            p_project_id: input.projectId,
            p_name: input.name,
            p_graph_schema_version: input.graphSchemaVersion,
            p_graph_snapshot: input.graphSnapshot,
            p_reason: input.reason,
            p_idempotency_key: input.idempotencyKey,
            p_request_id: context.requestId,
          }),
        );
        return {
          canvasId: requiredString(result.canvas_id, 'canvas_id'),
          revisionId: requiredString(result.revision_id, 'revision_id'),
          canonicalHash: requiredString(result.canonical_hash, 'canonical_hash'),
        };
      },
      async applyRevision(context, input) {
        const result = rpcObject(
          await executor.rpc('apply_canvas_revision', {
            p_workspace_id: context.workspaceId,
            p_canvas_id: input.canvasId,
            p_expected_revision_id: input.expectedRevisionId,
            p_graph_schema_version: input.graphSchemaVersion,
            p_graph_snapshot: input.graphSnapshot,
            p_reason: input.reason,
            p_idempotency_key: input.idempotencyKey,
            p_request_id: context.requestId,
          }),
        );
        return {
          revisionId: requiredString(result.revision_id, 'revision_id'),
          canonicalHash: requiredString(result.canonical_hash, 'canonical_hash'),
        };
      },
    },
    runs: {
      get: (context, runId) =>
        executor.selectOne('runs', {
          id: equals(runId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      listNodes: (context, runId) =>
        executor.select('run_nodes', {
          run_id: equals(runId),
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.asc,id.asc',
        }),
      async startBarrier(context, input) {
        const result = rpcObject(
          await executor.rpc('start_run_barrier', {
            p_workspace_id: context.workspaceId,
            p_canvas_id: input.canvasId,
            p_expected_revision_id: input.expectedRevisionId,
            p_quote_id: input.quoteId,
            p_confirmed: input.confirmed,
            p_idempotency_key: input.idempotencyKey,
            p_request_id: context.requestId,
          }),
        );
        return {
          runId: requiredString(result.run_id, 'run_id'),
          reservationId: requiredString(result.reservation_id, 'reservation_id'),
          status: 'queued',
        };
      },
    },
    artifacts: {
      get: (context, artifactId) =>
        executor.selectOne('artifacts', {
          id: equals(artifactId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      listForRun: (context, runId, requestedLimit) =>
        executor.select('artifacts', {
          run_id: equals(runId),
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.asc,id.asc',
          limit: limit(requestedLimit),
        }),
      listLineage: (context, artifactId) =>
        executor.select('artifact_lineage', {
          child_artifact_id: equals(artifactId),
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.asc,id.asc',
        }),
    },
    billing: {
      getQuote: (context, quoteId) =>
        executor.selectOne('quotes', {
          id: equals(quoteId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      getReservationForRun: (context, runId) =>
        executor.selectOne('cost_reservations', {
          run_id: equals(runId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      listLedger: (context, requestedLimit) =>
        executor.select('ledger_transactions', {
          workspace_id: equals(context.workspaceId),
          select: '*',
          order: 'created_at.desc,id.desc',
          limit: limit(requestedLimit),
        }),
      async availableBalance(context) {
        const pageSize = 100;
        let offset = 0;
        let balance = 0;
        while (true) {
          const rows = await executor.select('ledger_transactions', {
            workspace_id: equals(context.workspaceId),
            account_code: equals('wallet_available'),
            select: 'direction,amount_micros',
            order: 'created_at.asc,id.asc',
            limit: String(pageSize),
            offset: String(offset),
          });
          balance += rows.reduce(
            (total, row) =>
              total + (row.direction === 'credit' ? row.amount_micros : -row.amount_micros),
            0,
          );
          if (rows.length < pageSize) break;
          offset += rows.length;
        }
        return integerMicros(balance);
      },
    },
  };
}
