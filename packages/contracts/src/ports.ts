import type {
  IdempotencyIdentity,
  ImmutableRunQuote,
  ModelCatalogPrice,
  QuoteNodeRequest,
  SpendCaps,
  UsdMicros,
} from '@mustbeviral/billing';
import type { RunState } from '@mustbeviral/domain';
import type { GraphSnapshot, GraphValidationIssue } from '@mustbeviral/graph';
import type { HandlerContext } from './commands';

export type OperationName =
  | 'apply_canvas_patch'
  | 'validate_graph'
  | 'quote_run'
  | 'start_run'
  | 'get_run'
  | 'get_canvas_context'
  | 'cancel_run'
  | 'register_artifact'
  | 'register_artifact_lineage';

export interface CanvasContextRecord {
  readonly canvasId: string;
  readonly projectId: string;
  readonly headRevisionId: string;
  readonly graphSchemaVersion: number;
  readonly graphSnapshot: GraphSnapshot;
  readonly canonicalHash: string;
}

export interface RunRecord {
  readonly runId: string;
  readonly projectId: string;
  readonly canvasId: string;
  readonly canvasRevisionId: string;
  readonly quoteId: string;
  readonly status: RunState;
  readonly reservationId: string;
}

export interface ArtifactRecord {
  readonly artifactId: string;
  readonly projectId: string;
  readonly runId: string;
  readonly runNodeId: string | null;
  readonly canvasRevisionId: string;
  readonly artifactKind: 'input' | 'provider_output' | 'approved_output' | 'export';
  readonly status: 'available' | 'quarantined';
  readonly objectKey: string;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly contentHash: string;
}

export interface AuditEvent {
  readonly operation: OperationName;
  readonly outcome: string;
  readonly workspaceId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface AuthorizationPort {
  authorize(
    context: HandlerContext,
    operation: OperationName,
    resourceId: string,
  ): Promise<boolean>;
}

export interface CanvasPort {
  get(context: HandlerContext, canvasId: string): Promise<CanvasContextRecord | null>;
  compareAndSwapRevision(
    context: HandlerContext,
    input: Readonly<{
      canvasId: string;
      expectedRevisionId: string;
      nextRevisionId: string;
      graphSchemaVersion: number;
      graphSnapshot: GraphSnapshot;
      canonicalHash: string;
      reason: string;
      idempotencyKey: string;
    }>,
  ): Promise<
    | {
        readonly status: 'ok';
        readonly revisionId?: string;
        readonly canonicalHash?: string;
      }
    | { readonly status: 'conflict'; readonly actualHead: string }
  >;
}

export interface CatalogQuotePlan {
  readonly priceCatalogVersionId: string;
  readonly prices: readonly ModelCatalogPrice[];
  readonly nodes: readonly QuoteNodeRequest[];
}

export interface CatalogPort {
  quotePlan(context: HandlerContext, snapshot: GraphSnapshot): Promise<CatalogQuotePlan>;
}

export interface StoredQuote {
  readonly canvasId: string;
  readonly projectId: string;
  readonly quote: ImmutableRunQuote;
  readonly snapshot: GraphSnapshot;
}

export interface QuotePort {
  get(context: HandlerContext, quoteId: string): Promise<StoredQuote | null>;
  save(context: HandlerContext, input: StoredQuote, idempotencyKey: string): Promise<StoredQuote>;
}

export interface BillingExposurePort {
  get(context: HandlerContext): Promise<
    Readonly<{
      availableBalanceMicros: UsdMicros;
      workspaceDayExposureMicros: UsdMicros;
      globalDayExposureMicros: UsdMicros;
      caps: SpendCaps;
    }>
  >;
}

export interface ConfirmationPort {
  /**
   * Mints the token a caller must present to start_run. The token is proof the server showed this
   * actor this quote - not a formality: without it, any client holding a quote id could satisfy
   * the human-consent gate on real money by inventing a string, which is exactly what the previous
   * length-only check permitted.
   */
  mint(
    context: HandlerContext,
    input: Readonly<{ quoteId: string; maximumChargeMicros: UsdMicros }>,
  ): Promise<string>;
  verify(
    context: HandlerContext,
    input: Readonly<{ token: string; quoteId: string; maximumChargeMicros: UsdMicros }>,
  ): Promise<boolean>;
}

export interface StartRunBarrierInput {
  readonly canvasId: string;
  readonly expectedRevisionId: string;
  readonly quoteId: string;
  readonly confirmed: true;
  readonly idempotencyKey: string;
}

export interface StartRunBarrierResult {
  readonly runId: string;
  readonly reservationId: string;
  readonly status: 'queued';
}

export interface RunPort {
  get(context: HandlerContext, runId: string): Promise<RunRecord | null>;
  startBarrier(
    context: HandlerContext,
    input: StartRunBarrierInput,
  ): Promise<StartRunBarrierResult>;
  requestCancellation(
    context: HandlerContext,
    input: Readonly<{
      runId: string;
      expectedState: RunState;
      nextState: 'cancel_requested';
      reason: string;
      idempotencyKey: string;
      outboxEventId: string;
    }>,
  ): Promise<
    { readonly status: 'ok' } | { readonly status: 'conflict'; readonly actualState: RunState }
  >;
}

export interface ArtifactPort {
  register(
    context: HandlerContext,
    artifact: ArtifactRecord,
    idempotencyKey: string,
  ): Promise<void>;
  registerLineage(
    context: HandlerContext,
    lineage: Readonly<{
      lineageId: string;
      parentArtifactId: string;
      childArtifactId: string;
      relationship:
        'input_to_output' | 'adaptation' | 'motion_source' | 'export_member' | 'revision_source';
    }>,
    idempotencyKey: string,
  ): Promise<void>;
}

export interface AuditPort {
  emit(event: AuditEvent): Promise<void>;
}

export interface IdempotencyPort {
  /**
   * Structured identity rather than a flat key: a durable implementation must store workspace,
   * actor, operation and key as separate columns, and the flat advisory-lock string cannot be
   * split apart safely because the idempotency key itself may contain the delimiter.
   */
  execute<Result>(
    identity: IdempotencyIdentity,
    inputFingerprint: string,
    work: () => Promise<Result>,
  ): Promise<
    | { readonly status: 'created'; readonly result: Result }
    | { readonly status: 'replay'; readonly result: Result }
    | { readonly status: 'conflict' }
  >;
}

export interface ClockPort {
  now(): string;
}

export interface IdPort {
  next(kind: 'revision' | 'quote' | 'run' | 'reservation' | 'outbox' | 'artifact_lineage'): string;
}

export interface HandlerPorts {
  readonly authorization: AuthorizationPort;
  readonly canvases: CanvasPort;
  readonly catalog: CatalogPort;
  readonly quotes: QuotePort;
  readonly billing: BillingExposurePort;
  readonly confirmations: ConfirmationPort;
  readonly runs: RunPort;
  readonly artifacts: ArtifactPort;
  readonly audit: AuditPort;
  readonly idempotency: IdempotencyPort;
  readonly clock: ClockPort;
  readonly ids: IdPort;
}

export interface GraphInvalidDetails {
  readonly issues: readonly GraphValidationIssue[];
  readonly affectedDescendants: readonly string[];
}
