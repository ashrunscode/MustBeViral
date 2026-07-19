import type { Database, Json } from './database.generated';
import type { IntegerMicros, TenantContext } from './invariants';

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
