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
  ): Promise<Readonly<{ runId: string; reservationId: string; status: 'queued'; eventId: string }>>;
}

export interface ArtifactRepository {
  get(context: TenantContext, artifactId: string): Promise<Readonly<Row<'artifacts'>> | null>;
  listForRun(context: TenantContext, runId: string): Promise<readonly Readonly<Row<'artifacts'>>[]>;
  listLineage(
    context: TenantContext,
    artifactId: string,
  ): Promise<readonly Readonly<Row<'artifact_lineage'>>[]>;
}

export interface BillingRepository {
  getQuote(context: TenantContext, quoteId: string): Promise<Readonly<Row<'quotes'>> | null>;
  saveQuote(
    context: TenantContext,
    input: Readonly<{
      id: string;
      projectId: string;
      canvasId: string;
      canvasRevisionId: string;
      priceCatalogVersionId: string;
      executionPlan: Json;
      quoteHash: string;
      maximumChargeMicros: IntegerMicros;
      createdAt: string;
      expiresAt: string;
    }>,
  ): Promise<Readonly<Row<'quotes'>>>;
  getReservationForRun(
    context: TenantContext,
    runId: string,
  ): Promise<Readonly<Row<'cost_reservations'>> | null>;
  listLedgerForRun(
    context: TenantContext,
    runId: string,
  ): Promise<readonly Readonly<Row<'ledger_transactions'>>[]>;
  availableBalance(context: TenantContext): Promise<IntegerMicros>;
  dailyExposure(context: TenantContext, dayStart: string, dayEnd: string): Promise<IntegerMicros>;
}

export interface CatalogRepository {
  listActiveVersions(): Promise<readonly Readonly<Row<'price_catalog_versions'>>[]>;
  listRoutes(): Promise<readonly Readonly<Row<'model_routes'>>[]>;
  listPrices(): Promise<readonly Readonly<Row<'model_route_prices'>>[]>;
}

export interface DatabaseRepositories {
  readonly workspaces: WorkspaceRepository;
  readonly briefs: BriefRepository;
  readonly projects: ProjectRepository;
  readonly canvases: CanvasRepository;
  readonly runs: RunRepository;
  readonly artifacts: ArtifactRepository;
  readonly billing: BillingRepository;
  readonly catalog: CatalogRepository;
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
        const runId = requiredString(result.run_id, 'run_id');
        const eventId = requiredString(result.event_id, 'event_id');
        if (eventId === runId) {
          throw new TypeError('event_id must be the existing outbox id, not run_id');
        }
        return {
          runId,
          reservationId: requiredString(result.reservation_id, 'reservation_id'),
          status: 'queued',
          eventId,
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
      async listForRun(context, runId) {
        const pageSize = 100;
        let offset = 0;
        const artifacts: Readonly<Row<'artifacts'>>[] = [];
        while (true) {
          const page = await executor.select('artifacts', {
            run_id: equals(runId),
            workspace_id: equals(context.workspaceId),
            select: '*',
            order: 'created_at.asc,id.asc',
            limit: String(pageSize),
            offset: String(offset),
          });
          artifacts.push(...page);
          if (page.length < pageSize) break;
          offset += page.length;
        }
        return artifacts;
      },
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
      saveQuote: (context, input) =>
        executor.insert('quotes', {
          id: input.id,
          workspace_id: context.workspaceId,
          project_id: input.projectId,
          canvas_id: input.canvasId,
          canvas_revision_id: input.canvasRevisionId,
          price_catalog_version_id: input.priceCatalogVersionId,
          execution_plan: input.executionPlan,
          quote_hash: input.quoteHash,
          maximum_charge_micros: input.maximumChargeMicros,
          currency: 'USD',
          created_by: context.actorId,
          created_at: input.createdAt,
          expires_at: input.expiresAt,
        }),
      getReservationForRun: (context, runId) =>
        executor.selectOne('cost_reservations', {
          run_id: equals(runId),
          workspace_id: equals(context.workspaceId),
          select: '*',
        }),
      async listLedgerForRun(context, runId) {
        const pageSize = 100;
        let offset = 0;
        const ledger: Readonly<Row<'ledger_transactions'>>[] = [];
        while (true) {
          const page = await executor.select('ledger_transactions', {
            run_id: equals(runId),
            workspace_id: equals(context.workspaceId),
            select: '*',
            order: 'created_at.asc,id.asc',
            limit: String(pageSize),
            offset: String(offset),
          });
          ledger.push(...page);
          if (page.length < pageSize) break;
          offset += page.length;
        }
        return ledger;
      },
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
      async dailyExposure(context, dayStart, dayEnd) {
        const pageSize = 100;
        let offset = 0;
        let exposure = 0;
        while (true) {
          const rows = await executor.select('cost_reservations', {
            workspace_id: equals(context.workspaceId),
            created_at: `gte.${dayStart}`,
            and: `(created_at.lt.${dayEnd})`,
            select: 'amount_micros,captured_micros,released_micros,refunded_micros',
            order: 'created_at.asc,id.asc',
            limit: String(pageSize),
            offset: String(offset),
          });
          exposure += rows.reduce(
            (total, row) =>
              total +
              Math.max(
                row.amount_micros - row.released_micros,
                row.captured_micros - row.refunded_micros,
              ),
            0,
          );
          if (rows.length < pageSize) break;
          offset += rows.length;
        }
        return integerMicros(exposure);
      },
    },
    catalog: {
      listActiveVersions: () =>
        executor.select('price_catalog_versions', {
          status: equals('active'),
          currency: equals('USD'),
          select: '*',
          order: 'effective_at.desc,id.desc',
          limit: '100',
        }),
      listRoutes: () =>
        executor.select('model_routes', {
          select: '*',
          order: 'created_at.asc,id.asc',
          limit: '100',
        }),
      listPrices: () =>
        executor.select('model_route_prices', {
          select: '*',
          order: 'created_at.asc,id.asc',
          limit: '100',
        }),
    },
  };
}
