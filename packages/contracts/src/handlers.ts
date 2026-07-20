import {
  checkReservationCaps,
  deriveIdempotencyKey,
  quoteExpiryState,
  reserveLedgerMovement,
  assembleQuote,
  type ImmutableRunQuote,
  type ReservationCapExceeded,
} from '@mustbeviral/billing';
import { transitionRun } from '@mustbeviral/domain';
import {
  affectedDescendants,
  hashCanonicalGraph,
  validateGraph as validateGraphSnapshot,
  type GraphSnapshot,
} from '@mustbeviral/graph';
import {
  ApplyCanvasPatchInputSchema,
  CancelRunInputSchema,
  GetCanvasContextInputSchema,
  GetRunInputSchema,
  QuoteRunInputSchema,
  RegisterArtifactInputSchema,
  RegisterArtifactLineageInputSchema,
  StartRunInputSchema,
  ValidateGraphInputSchema,
  type HandlerContext,
} from './commands';
import type {
  ArtifactRecord,
  AuditEvent,
  CanvasContextRecord,
  HandlerPorts,
  OperationName,
  RunRecord,
} from './ports';

export interface ForbiddenResult {
  readonly status: 'forbidden';
}
export interface NotFoundResult {
  readonly status: 'not_found';
}
export interface ConflictResult {
  readonly status: 'conflict';
  readonly reason: 'revision' | 'run_state' | 'quote_stale' | 'idempotency';
  readonly actual?: string;
}
export interface ExpiredQuoteResult {
  readonly status: 'expired_quote';
  readonly quoteId: string;
  readonly expiredAt: string;
}
export interface CapExceededResult extends ReservationCapExceeded {
  readonly status: 'cap_exceeded';
}
export interface InsufficientBalanceResult {
  readonly status: 'cap_exceeded';
  readonly tier: 'available_balance';
  readonly availableMicros: bigint;
  readonly requestedMicros: bigint;
}
export interface GraphInvalidResult {
  readonly status: 'graph_invalid';
  readonly issues: ReturnType<typeof validateGraphSnapshot>['issues'];
}

export type AccessFailure = ForbiddenResult | NotFoundResult;

export type ApplyCanvasPatchResult =
  | Readonly<{
      status: 'ok';
      canvasId: string;
      revisionId: string;
      canonicalHash: string;
      affectedDescendants: readonly string[];
    }>
  | ForbiddenResult
  | NotFoundResult
  | ConflictResult
  | GraphInvalidResult;

export type ValidateGraphResult =
  | Readonly<{
      status: 'ok';
      canvasId: string;
      revisionId: string;
      valid: boolean;
      issues: ReturnType<typeof validateGraphSnapshot>['issues'];
    }>
  | AccessFailure;

export type QuoteRunResult =
  | Readonly<{ status: 'ok'; quote: ImmutableRunQuote }>
  | ForbiddenResult
  | NotFoundResult
  | ConflictResult
  | GraphInvalidResult;

export type StartRunResult =
  | Readonly<{ status: 'ok'; run: RunRecord }>
  | ForbiddenResult
  | NotFoundResult
  | ConflictResult
  | ExpiredQuoteResult
  | CapExceededResult
  | InsufficientBalanceResult;

export type GetRunResult = Readonly<{ status: 'ok'; run: RunRecord }> | AccessFailure;
export type GetCanvasContextResult =
  Readonly<{ status: 'ok'; canvas: CanvasContextRecord }> | AccessFailure;
export type CancelRunResult =
  | Readonly<{ status: 'ok'; runId: string; cancellation: 'accepted' }>
  | ForbiddenResult
  | NotFoundResult
  | ConflictResult;
export type RegisterArtifactResult =
  Readonly<{ status: 'ok'; artifact: ArtifactRecord }> | AccessFailure | ConflictResult;
export type RegisterArtifactLineageResult =
  Readonly<{ status: 'ok'; lineageId: string }> | AccessFailure | ConflictResult;

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
    .join(',')}}`;
}

function idempotencyFingerprintInput(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;
  const record = input as Readonly<Record<string, unknown>>;
  const context = record.context;
  if (typeof context !== 'object' || context === null || Array.isArray(context)) return input;
  const contextRecord = context as Readonly<Record<string, unknown>>;
  const stableContext = Object.fromEntries(
    Object.entries(contextRecord).filter(([key]) => key !== 'request_id'),
  );
  return { ...record, context: stableContext };
}

function applyPatch(
  current: GraphSnapshot,
  patch: {
    readonly upsert_nodes: readonly GraphSnapshot['nodes'][number][];
    readonly remove_node_ids: readonly string[];
    readonly upsert_edges: readonly GraphSnapshot['edges'][number][];
    readonly remove_edge_ids: readonly string[];
  },
): GraphSnapshot {
  const removedNodes = new Set(patch.remove_node_ids);
  const nodes = new Map(
    current.nodes.filter((node) => !removedNodes.has(node.id)).map((node) => [node.id, node]),
  );
  for (const node of patch.upsert_nodes) nodes.set(node.id, node);

  const removedEdges = new Set(patch.remove_edge_ids);
  const edges = new Map(
    current.edges
      .filter(
        (edge) =>
          !removedEdges.has(edge.id) &&
          !removedNodes.has(edge.source_node_id) &&
          !removedNodes.has(edge.target_node_id),
      )
      .map((edge) => [edge.id, edge]),
  );
  for (const edge of patch.upsert_edges) edges.set(edge.id, edge);
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function freezeGraphSnapshot(snapshot: GraphSnapshot): GraphSnapshot {
  return deepFreeze(structuredClone(snapshot));
}

async function permitted(
  ports: HandlerPorts,
  context: HandlerContext,
  operation: OperationName,
  resourceId: string,
): Promise<boolean> {
  return ports.authorization.authorize(context, operation, resourceId);
}

async function audit(
  ports: HandlerPorts,
  context: HandlerContext,
  operation: OperationName,
  outcome: string,
  entityType: string,
  entityId: string,
  details: Readonly<Record<string, unknown>> = {},
): Promise<void> {
  const event: AuditEvent = {
    operation,
    outcome,
    workspaceId: context.workspace_id,
    actorId: context.actor_id,
    requestId: context.request_id,
    entityType,
    entityId,
    details,
  };
  await ports.audit.emit(event);
}

function idempotencyIdentity(
  context: HandlerContext,
  operation: OperationName,
  idempotencyKey: string,
): string {
  return deriveIdempotencyKey({
    actorId: context.actor_id,
    workspaceId: context.workspace_id,
    operation,
    idempotencyKey,
  }).advisoryLockKey;
}

async function idempotent<Result extends { readonly status: string }>(
  ports: HandlerPorts,
  context: HandlerContext,
  operation: OperationName,
  idempotencyKey: string,
  input: unknown,
  entityType: string,
  entityId: string,
  work: () => Promise<Result>,
): Promise<Result | ConflictResult> {
  const executed = await ports.idempotency.execute<Result>(
    idempotencyIdentity(context, operation, idempotencyKey),
    canonical(idempotencyFingerprintInput(input)),
    work,
  );
  if (executed.status === 'conflict') {
    await audit(ports, context, operation, 'idempotency_conflict', entityType, entityId);
    return { status: 'conflict', reason: 'idempotency' };
  }
  if (executed.status === 'replay') {
    await audit(ports, context, operation, 'idempotent_replay', entityType, entityId);
  } else if (executed.result.status !== 'ok') {
    await audit(ports, context, operation, executed.result.status, entityType, entityId);
  }
  return executed.result;
}

export function createCommandHandlers(ports: HandlerPorts) {
  return {
    async applyCanvasPatch(input: unknown): Promise<ApplyCanvasPatchResult> {
      const command = ApplyCanvasPatchInputSchema.parse(input);
      const { context } = command;
      if (!(await permitted(ports, context, 'apply_canvas_patch', command.canvas_id))) {
        await audit(ports, context, 'apply_canvas_patch', 'forbidden', 'canvas', command.canvas_id);
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        context,
        'apply_canvas_patch',
        command.idempotency_key,
        command,
        'canvas',
        command.canvas_id,
        async (): Promise<ApplyCanvasPatchResult> => {
          const canvas = await ports.canvases.get(context, command.canvas_id);
          if (canvas === null) return { status: 'not_found' };
          if (canvas.headRevisionId !== command.expected_revision_id) {
            return { status: 'conflict', reason: 'revision', actual: canvas.headRevisionId };
          }
          const snapshot = applyPatch(
            canvas.graphSnapshot,
            command.patch as Parameters<typeof applyPatch>[1],
          );
          const validation = validateGraphSnapshot(snapshot);
          if (!validation.valid) return { status: 'graph_invalid', issues: validation.issues };
          const changed = [
            ...command.patch.upsert_nodes.map((node) => node.id),
            ...command.patch.remove_node_ids,
          ].filter((nodeId) => snapshot.nodes.some((node) => node.id === nodeId));
          const descendants = affectedDescendants(snapshot, changed);
          const canonicalHash = await hashCanonicalGraph(snapshot);
          const revisionId = ports.ids.next('revision');
          const persisted = await ports.canvases.compareAndSwapRevision(context, {
            canvasId: command.canvas_id,
            expectedRevisionId: command.expected_revision_id,
            nextRevisionId: revisionId,
            graphSchemaVersion: canvas.graphSchemaVersion,
            graphSnapshot: snapshot,
            canonicalHash,
            reason: command.reason,
            idempotencyKey: command.idempotency_key,
          });
          if (persisted.status === 'conflict') {
            return { status: 'conflict', reason: 'revision', actual: persisted.actualHead };
          }
          const persistedRevisionId = persisted.revisionId ?? revisionId;
          const persistedCanonicalHash = persisted.canonicalHash ?? canonicalHash;
          const result = {
            status: 'ok' as const,
            canvasId: command.canvas_id,
            revisionId: persistedRevisionId,
            canonicalHash: persistedCanonicalHash,
            affectedDescendants: descendants,
          };
          await audit(
            ports,
            context,
            'apply_canvas_patch',
            'ok',
            'canvas_revision',
            persistedRevisionId,
            {
              canvas_id: command.canvas_id,
              affected_descendants: descendants,
            },
          );
          return result;
        },
      );
    },

    async validateGraph(input: unknown): Promise<ValidateGraphResult> {
      const query = ValidateGraphInputSchema.parse(input);
      if (!(await permitted(ports, query.context, 'validate_graph', query.canvas_id))) {
        await audit(ports, query.context, 'validate_graph', 'forbidden', 'canvas', query.canvas_id);
        return { status: 'forbidden' };
      }
      const canvas = await ports.canvases.get(query.context, query.canvas_id);
      if (canvas === null) {
        await audit(ports, query.context, 'validate_graph', 'not_found', 'canvas', query.canvas_id);
        return { status: 'not_found' };
      }
      const validation = validateGraphSnapshot(canvas.graphSnapshot);
      await audit(
        ports,
        query.context,
        'validate_graph',
        validation.valid ? 'ok' : 'graph_invalid',
        'canvas',
        query.canvas_id,
      );
      return {
        status: 'ok',
        canvasId: query.canvas_id,
        revisionId: canvas.headRevisionId,
        valid: validation.valid,
        issues: validation.issues,
      };
    },

    async quoteRun(input: unknown): Promise<QuoteRunResult> {
      const command = QuoteRunInputSchema.parse(input);
      if (!(await permitted(ports, command.context, 'quote_run', command.canvas_id))) {
        await audit(ports, command.context, 'quote_run', 'forbidden', 'canvas', command.canvas_id);
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        command.context,
        'quote_run',
        command.idempotency_key,
        command,
        'canvas',
        command.canvas_id,
        async (): Promise<QuoteRunResult> => {
          const canvas = await ports.canvases.get(command.context, command.canvas_id);
          if (canvas === null) return { status: 'not_found' };
          if (canvas.headRevisionId !== command.expected_revision_id) {
            return { status: 'conflict', reason: 'revision', actual: canvas.headRevisionId };
          }
          const validation = validateGraphSnapshot(canvas.graphSnapshot);
          if (!validation.valid) return { status: 'graph_invalid', issues: validation.issues };
          const snapshot = freezeGraphSnapshot(canvas.graphSnapshot);
          const plan = await ports.catalog.quotePlan(command.context, snapshot);
          const quote = assembleQuote({
            quoteId: ports.ids.next('quote'),
            workspaceId: command.context.workspace_id,
            canvasRevisionId: canvas.headRevisionId,
            priceCatalogVersionId: plan.priceCatalogVersionId,
            createdAt: ports.clock.now(),
            catalogPrices: plan.prices,
            nodes: plan.nodes,
          });
          await ports.quotes.save(command.context, {
            canvasId: command.canvas_id,
            quote,
            snapshot,
          });
          await audit(ports, command.context, 'quote_run', 'ok', 'quote', quote.quoteId, {
            canvas_revision_id: quote.canvasRevisionId,
            price_catalog_version_id: quote.priceCatalogVersionId,
            maximum_charge_micros: quote.maximumChargeMicros,
          });
          return { status: 'ok', quote };
        },
      );
    },

    async startRun(input: unknown): Promise<StartRunResult> {
      const command = StartRunInputSchema.parse(input);
      if (!(await permitted(ports, command.context, 'start_run', command.quote_id))) {
        await audit(ports, command.context, 'start_run', 'forbidden', 'quote', command.quote_id);
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        command.context,
        'start_run',
        command.idempotency_key,
        command,
        'quote',
        command.quote_id,
        async (): Promise<StartRunResult> => {
          const storedQuote = await ports.quotes.get(command.context, command.quote_id);
          if (storedQuote === null) return { status: 'not_found' };
          const { quote } = storedQuote;
          if (quoteExpiryState(quote, ports.clock.now()) === 'expired') {
            return { status: 'expired_quote', quoteId: quote.quoteId, expiredAt: quote.expiresAt };
          }
          const confirmed = await ports.confirmations.verify(command.context, {
            token: command.confirmation_token,
            quoteId: quote.quoteId,
            maximumChargeMicros: quote.maximumChargeMicros,
          });
          if (!confirmed) return { status: 'forbidden' };
          const canvas = await ports.canvases.get(command.context, storedQuote.canvasId);
          if (canvas === null) return { status: 'not_found' };
          if (canvas.headRevisionId !== quote.canvasRevisionId) {
            return { status: 'conflict', reason: 'quote_stale', actual: canvas.headRevisionId };
          }
          const exposure = await ports.billing.get(command.context);
          if (quote.maximumChargeMicros > exposure.availableBalanceMicros) {
            return {
              status: 'cap_exceeded',
              tier: 'available_balance',
              availableMicros: exposure.availableBalanceMicros,
              requestedMicros: quote.maximumChargeMicros,
            };
          }
          const caps = checkReservationCaps({
            reservationMicros: quote.maximumChargeMicros,
            workspaceDayExposureMicros: exposure.workspaceDayExposureMicros,
            globalDayExposureMicros: exposure.globalDayExposureMicros,
            caps: exposure.caps,
          });
          if (caps.status === 'cap_exceeded') return caps;
          const runId = ports.ids.next('run');
          const reservationId = ports.ids.next('reservation');
          const causativeKey = `start_run:${command.idempotency_key}`;
          const run: RunRecord = {
            runId,
            canvasId: storedQuote.canvasId,
            canvasRevisionId: quote.canvasRevisionId,
            quoteId: quote.quoteId,
            status: 'queued',
            reservationId,
          };
          await ports.runs.startBarrier(command.context, {
            run,
            quote,
            reservation: { reservationId, amountMicros: quote.maximumChargeMicros },
            ledgerMovement: reserveLedgerMovement({
              amountMicros: quote.maximumChargeMicros,
              causativeKey,
              requestId: command.context.request_id,
              reservationId,
              runId,
              metadata: { quote_id: quote.quoteId },
            }),
            outbox: {
              eventId: ports.ids.next('outbox'),
              topic: 'run.dispatch_requested',
              causativeKey,
            },
            idempotencyKey: command.idempotency_key,
          });
          await audit(ports, command.context, 'start_run', 'ok', 'run', runId, {
            quote_id: quote.quoteId,
            reservation_id: reservationId,
          });
          return { status: 'ok', run };
        },
      );
    },

    async getRun(input: unknown): Promise<GetRunResult> {
      const query = GetRunInputSchema.parse(input);
      if (!(await permitted(ports, query.context, 'get_run', query.run_id))) {
        await audit(ports, query.context, 'get_run', 'forbidden', 'run', query.run_id);
        return { status: 'forbidden' };
      }
      const run = await ports.runs.get(query.context, query.run_id);
      if (run === null) {
        await audit(ports, query.context, 'get_run', 'not_found', 'run', query.run_id);
        return { status: 'not_found' };
      }
      await audit(ports, query.context, 'get_run', 'ok', 'run', query.run_id);
      return { status: 'ok', run };
    },

    async getCanvasContext(input: unknown): Promise<GetCanvasContextResult> {
      const query = GetCanvasContextInputSchema.parse(input);
      if (!(await permitted(ports, query.context, 'get_canvas_context', query.canvas_id))) {
        await audit(
          ports,
          query.context,
          'get_canvas_context',
          'forbidden',
          'canvas',
          query.canvas_id,
        );
        return { status: 'forbidden' };
      }
      const canvas = await ports.canvases.get(query.context, query.canvas_id);
      if (canvas === null) {
        await audit(
          ports,
          query.context,
          'get_canvas_context',
          'not_found',
          'canvas',
          query.canvas_id,
        );
        return { status: 'not_found' };
      }
      await audit(ports, query.context, 'get_canvas_context', 'ok', 'canvas', query.canvas_id);
      return { status: 'ok', canvas };
    },

    async cancelRun(input: unknown): Promise<CancelRunResult> {
      const command = CancelRunInputSchema.parse(input);
      if (!(await permitted(ports, command.context, 'cancel_run', command.run_id))) {
        await audit(ports, command.context, 'cancel_run', 'forbidden', 'run', command.run_id);
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        command.context,
        'cancel_run',
        command.idempotency_key,
        command,
        'run',
        command.run_id,
        async (): Promise<CancelRunResult> => {
          const run = await ports.runs.get(command.context, command.run_id);
          if (run === null) return { status: 'not_found' };
          try {
            if (transitionRun(run.status, 'request_cancel') !== 'cancel_requested') {
              return { status: 'conflict', reason: 'run_state', actual: run.status };
            }
          } catch {
            return { status: 'conflict', reason: 'run_state', actual: run.status };
          }
          const persisted = await ports.runs.requestCancellation(command.context, {
            runId: run.runId,
            expectedState: run.status,
            nextState: 'cancel_requested',
            reason: command.reason,
            idempotencyKey: command.idempotency_key,
            outboxEventId: ports.ids.next('outbox'),
          });
          if (persisted.status === 'conflict') {
            return { status: 'conflict', reason: 'run_state', actual: persisted.actualState };
          }
          await audit(ports, command.context, 'cancel_run', 'ok', 'run', run.runId);
          return { status: 'ok', runId: run.runId, cancellation: 'accepted' };
        },
      );
    },

    async registerArtifact(input: unknown): Promise<RegisterArtifactResult> {
      const command = RegisterArtifactInputSchema.parse(input);
      if (!(await permitted(ports, command.context, 'register_artifact', command.run_id))) {
        await audit(
          ports,
          command.context,
          'register_artifact',
          'forbidden',
          'run',
          command.run_id,
        );
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        command.context,
        'register_artifact',
        command.idempotency_key,
        command,
        'artifact',
        command.artifact_id,
        async (): Promise<RegisterArtifactResult> => {
          const run = await ports.runs.get(command.context, command.run_id);
          if (run === null) return { status: 'not_found' };
          const artifact: ArtifactRecord = {
            artifactId: command.artifact_id,
            runId: command.run_id,
            runNodeId: command.run_node_id,
            kind: command.kind,
            objectKey: command.object_key,
            contentType: command.content_type,
            byteSize: command.byte_size,
            sha256: command.sha256,
          };
          await ports.artifacts.register(command.context, artifact, command.idempotency_key);
          await audit(
            ports,
            command.context,
            'register_artifact',
            'ok',
            'artifact',
            artifact.artifactId,
          );
          return { status: 'ok', artifact };
        },
      );
    },

    async registerArtifactLineage(input: unknown): Promise<RegisterArtifactLineageResult> {
      const command = RegisterArtifactLineageInputSchema.parse(input);
      if (
        !(await permitted(
          ports,
          command.context,
          'register_artifact_lineage',
          command.child_artifact_id,
        ))
      ) {
        await audit(
          ports,
          command.context,
          'register_artifact_lineage',
          'forbidden',
          'artifact',
          command.child_artifact_id,
        );
        return { status: 'forbidden' };
      }
      return idempotent(
        ports,
        command.context,
        'register_artifact_lineage',
        command.idempotency_key,
        command,
        'artifact_lineage',
        command.child_artifact_id,
        async (): Promise<RegisterArtifactLineageResult> => {
          const lineageId = ports.ids.next('artifact_lineage');
          await ports.artifacts.registerLineage(
            command.context,
            {
              lineageId,
              parentArtifactId: command.parent_artifact_id,
              childArtifactId: command.child_artifact_id,
              relation: command.relation,
            },
            command.idempotency_key,
          );
          await audit(
            ports,
            command.context,
            'register_artifact_lineage',
            'ok',
            'artifact_lineage',
            lineageId,
          );
          return { status: 'ok', lineageId };
        },
      );
    },
  };
}

export type CommandHandlers = ReturnType<typeof createCommandHandlers>;
