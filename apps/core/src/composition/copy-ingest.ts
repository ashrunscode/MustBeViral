import { providerArtifactObjectKey, sha256Hex } from '../../../../packages/artifacts/src/index';
import {
  planRunSettlement,
  usdMicros,
  type AttemptSettlementOutcome,
  type UsdMicros,
} from '../../../../packages/billing/src/index';
import type { P0HandlerResult } from '../../../../packages/contracts/src/rest';

import type { CoreBindings } from '../bindings';
import { putPrivateCanonicalBytes } from './artifact-storage';
import type { PrivilegedSettlementPort } from './settlement';
import type { FalArtifactContext, FalAttemptAdvance } from './artifact-machine';

/**
 * Terminal path for the synchronous OpenRouter copy route.
 *
 * fal delivers by webhook and that webhook drives ingest. OpenRouter answers inside the submit call,
 * has no webhook, and is deliberately excluded from the polling reconciler (its driver has no
 * status(); polling it would flip the attempt to 'ambiguous' and the run to
 * 'reconciliation_required', a state with no exit). So a copy attempt previously had NO route to a
 * terminal state: the generated text was discarded in memory, the node was never captured, the
 * reservation was never released, and - because wave promotion happens inside the settlement tail -
 * the entire run stalled at wave 1, which on the launch pack is all three copy nodes.
 *
 * Deliberately NOT routed through verifyProviderArtifactBytes / copyFalDeliveryToPrivateR2. Those
 * accept png/jpeg/webp/mp4 only, and the wrapper reports a verification failure as retryable, so a
 * JSON body would 503-loop forever against a provider that never stops redelivering. Copy output is
 * canonical JSON we produced ourselves; there is no third-party image to sniff.
 */
export interface CopyIngestDependencies {
  readonly getContext: (providerRequestId: string) => Promise<FalArtifactContext>;
  readonly storeBytes: (
    input: Readonly<{ objectKey: string; bytes: Uint8Array; workspaceId: string; runId: string }>,
  ) => Promise<void>;
  readonly registerArtifact: (
    input: Readonly<{
      runId: string;
      runNodeId: string;
      objectKey: string;
      contentHash: string;
      mimeType: string;
      byteSize: number;
    }>,
  ) => Promise<Readonly<{ artifactId: string; replayed: boolean }>>;
  readonly advanceAttempt: (
    input: Readonly<{
      providerRequestId: string;
      status: 'succeeded' | 'failed';
      eventId: string;
      artifactId?: string;
      captureMicros?: UsdMicros;
    }>,
  ) => Promise<FalAttemptAdvance>;
  readonly settlement: PrivilegedSettlementPort;
  readonly requestId: string;
}

export type CopyIngestResult = P0HandlerResult & Readonly<Record<string, unknown>>;

/**
 * Canonical JSON: keys sorted at every level, no incidental whitespace. The bytes are content-hashed
 * and that hash is the artifact's identity, so two ingests of the same completion must produce
 * byte-identical output or replay protection would not hold.
 */
function canonicalJsonBytes(value: unknown): Uint8Array {
  const canonicalise = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(canonicalise);
    if (input !== null && typeof input === 'object') {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
          .map(([key, entry]) => [key, canonicalise(entry)]),
      );
    }
    return input;
  };
  return new TextEncoder().encode(JSON.stringify(canonicalise(value)));
}

function remainingReservation(context: FalArtifactContext): UsdMicros {
  const remaining =
    context.reservation.amountMicros -
    context.reservation.capturedMicros -
    context.reservation.releasedMicros;
  if (remaining < 0n) throw new RangeError('Reservation accounting has a negative remainder');
  return usdMicros(remaining);
}

async function finishTerminalSettlement(
  advance: FalAttemptAdvance,
  context: FalArtifactContext,
  dependencies: CopyIngestDependencies,
): Promise<void> {
  if (!advance.runTerminal) return;
  const outcomes: AttemptSettlementOutcome[] = advance.outcomes.map((outcome) => {
    if (outcome.status === 'succeeded' && 'captureMicros' in outcome) {
      return {
        attemptId: outcome.attemptId,
        status: 'succeeded',
        captureMicros: outcome.captureMicros,
      };
    }
    if (
      outcome.status === 'failed' ||
      outcome.status === 'canceled' ||
      outcome.status === 'skipped'
    ) {
      return { attemptId: outcome.attemptId, status: outcome.status };
    }
    throw new TypeError('A terminal run returned a non-terminal settlement outcome');
  });
  const plan = planRunSettlement({
    runId: context.runId,
    reservationMicros: advance.reservation.amountMicros,
    outcomes,
  });
  if (plan.captureTotalMicros !== advance.reservation.capturedMicros) {
    throw new RangeError('Terminal run capture total does not match the reservation');
  }
  const releaseMicros = usdMicros(plan.releaseRemainderMicros - advance.reservation.releasedMicros);
  if (releaseMicros <= 0n) return;
  await dependencies.settlement.release({
    workspaceId: context.workspaceId,
    runId: context.runId,
    reservationId: context.reservation.id,
    amountMicros: releaseMicros,
    causativeKey: plan.releaseCausativeKey,
    requestId: dependencies.requestId,
    metadata: { reason: 'terminal_run_remainder' },
  });
}

export async function ingestCopyCompletion(
  input: Readonly<{
    providerRequestId: string;
    eventId: string;
    output: unknown;
    /** OpenRouter's own reported cost. Margin telemetry only; never what the customer is charged. */
    providerCostMicros?: bigint;
  }>,
  dependencies: CopyIngestDependencies,
): Promise<CopyIngestResult> {
  const context = await dependencies.getContext(input.providerRequestId);

  // Already settled by an earlier pass. Return the same shape rather than capturing twice.
  if (
    context.attemptStatus === 'succeeded' ||
    context.attemptStatus === 'failed' ||
    context.attemptStatus === 'canceled'
  ) {
    return { status: 'ok', accepted: true, idempotent: true, run_status: context.attemptStatus };
  }

  const objectKey = providerArtifactObjectKey({
    workspaceId: context.workspaceId,
    runId: context.runId,
    attemptId: context.attemptId,
  });
  const bytes = canonicalJsonBytes(input.output);
  const contentHash = await sha256Hex(bytes);

  // Bytes first, then capture, then advance - the order the fal path already proved and the database
  // enforces. Dying before capture risks at most a fraction of a cent of duplicate OpenRouter spend
  // on retry; dying after advance but before capture would strand the whole reservation.
  await dependencies.storeBytes({
    objectKey,
    bytes,
    workspaceId: context.workspaceId,
    runId: context.runId,
  });
  const registered = await dependencies.registerArtifact({
    runId: context.runId,
    runNodeId: context.runNodeId,
    objectKey,
    contentHash,
    mimeType: 'application/json',
    byteSize: bytes.byteLength,
  });

  // The customer is charged the PINNED CATALOG PRICE for one copy request - the same rule the fal
  // path follows (pinned unit price times verified units), not a copy-specific exception. Capturing
  // OpenRouter's ~17 micros of real cost instead would make the terminal settlement release the
  // remainder and silently turn a confirmed 150,000-micro line into a fraction of it.
  const derived = context.unitPriceMicros;
  const captureMicros =
    derived > context.quotedTotalMicros ? context.quotedTotalMicros : usdMicros(derived);

  await dependencies.settlement.capture({
    workspaceId: context.workspaceId,
    runId: context.runId,
    reservationId: context.reservation.id,
    amountMicros: captureMicros,
    reservationRemainingMicros: remainingReservation(context),
    causativeKey: `run:${context.runId}:attempt:${context.attemptId}:capture`,
    requestId: dependencies.requestId,
    metadata: {
      attempt_id: context.attemptId,
      artifact_id: registered.artifactId,
      price_unit: context.priceUnit,
      // Margin telemetry: what the provider charged us versus what the customer was billed.
      ...(input.providerCostMicros === undefined
        ? {}
        : { provider_cost_micros: input.providerCostMicros.toString() }),
    },
  });

  const advance = await dependencies.advanceAttempt({
    providerRequestId: input.providerRequestId,
    status: 'succeeded',
    eventId: input.eventId,
    artifactId: registered.artifactId,
    captureMicros,
  });
  await finishTerminalSettlement(advance, context, dependencies);

  return {
    status: 'ok',
    accepted: true,
    idempotent: registered.replayed,
    artifact_id: registered.artifactId,
    run_status: advance.runStatus,
    capture_micros: Number(captureMicros),
  };
}

export function createCopyBytesWriter(
  bindings: Pick<CoreBindings, 'MEDIA_BUCKET'>,
): CopyIngestDependencies['storeBytes'] {
  return async (write) =>
    await putPrivateCanonicalBytes(bindings.MEDIA_BUCKET, {
      objectKey: write.objectKey,
      bytes: write.bytes,
      mimeType: 'application/json',
      workspaceId: write.workspaceId,
      runId: write.runId,
    });
}
