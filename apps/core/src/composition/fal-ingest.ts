import {
  providerArtifactObjectKey,
  type VerifiedProviderArtifact,
} from '../../../../packages/artifacts/src/index';
import {
  attemptReleaseCausativeKey,
  deriveFalCaptureAmount,
  planRunSettlement,
  usdMicros,
  usdMicrosToSafeInteger,
  type AttemptSettlementOutcome,
  type UsdMicros,
} from '../../../../packages/billing/src/index';
import {
  providerErrorCodeFromFailure,
  type VerifiedFalWebhook,
} from '../../../../packages/provider/src/webhook';
import type { P0HandlerResult } from '../../../../packages/contracts/src/rest';

import type { CoreBindings } from '../bindings';
import {
  PrivilegedArtifactMachinePort,
  type FalArtifactContext,
  type FalAttemptAdvance,
} from './artifact-machine';
import { copyFalDeliveryToPrivateR2 } from './artifact-storage';
import { createPrivilegedSettlementPort, type PrivilegedSettlementPort } from './settlement';

export interface FalIngestDependencies {
  readonly getContext: (providerRequestId: string) => Promise<FalArtifactContext>;
  readonly storeDelivery: (
    input: Readonly<{
      context: FalArtifactContext;
      deliveryUrl: Extract<
        VerifiedFalWebhook['attempt']['status'],
        { state: 'succeeded' }
      >['delivery']['transientDeliveryUrl'];
      objectKey: string;
    }>,
  ) => Promise<VerifiedProviderArtifact>;
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
      status: 'running' | 'succeeded' | 'failed';
      eventId: string;
      artifactId?: string;
      captureMicros?: UsdMicros;
    }>,
  ) => Promise<FalAttemptAdvance>;
  readonly settlement: PrivilegedSettlementPort;
  readonly requestId: string;
  readonly recordProviderErrorCode?: (
    input: Readonly<{ providerRequestId: string; providerErrorCode: string }>,
  ) => Promise<void>;
}

export type FalIngestResult = P0HandlerResult & Readonly<Record<string, unknown>>;

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
  dependencies: FalIngestDependencies,
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
  if (advance.reservation.releasedMicros > plan.releaseRemainderMicros) {
    throw new RangeError('Terminal run releases exceed the settlement plan');
  }
  const releaseMicros = usdMicros(plan.releaseRemainderMicros - advance.reservation.releasedMicros);
  if (releaseMicros === 0n) return;
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

function captureFor(
  context: FalArtifactContext,
  artifact: VerifiedProviderArtifact,
): ReturnType<typeof deriveFalCaptureAmount> {
  if (context.priceUnit === 'image') {
    if (artifact.measurement.kind !== 'image') {
      throw new TypeError('Pinned image price received a non-image artifact');
    }
    return deriveFalCaptureAmount(
      { unit: 'image', unitPriceMicros: context.unitPriceMicros },
      {
        kind: 'images',
        artifacts: [
          {
            widthPixels: artifact.measurement.widthPixels,
            heightPixels: artifact.measurement.heightPixels,
          },
        ],
      },
    );
  }
  if (artifact.measurement.kind !== 'video') {
    throw new TypeError('Pinned video price received a non-video artifact');
  }
  return deriveFalCaptureAmount(
    { unit: 'video_second', unitPriceMicros: context.unitPriceMicros },
    {
      kind: 'video',
      durationMilliseconds: artifact.measurement.durationMilliseconds,
    },
  );
}

async function replayTerminal(
  event: VerifiedFalWebhook,
  context: FalArtifactContext,
  dependencies: FalIngestDependencies,
): Promise<FalIngestResult> {
  const advance = await dependencies.advanceAttempt({
    providerRequestId: event.attempt.providerJobId,
    status: 'running',
    eventId: event.eventId,
  });
  await finishTerminalSettlement(advance, context, dependencies);
  return {
    status: 'ok',
    accepted: true,
    idempotent: true,
    run_status: advance.runStatus,
  };
}

export async function ingestVerifiedFalWebhook(
  event: VerifiedFalWebhook,
  dependencies: FalIngestDependencies,
): Promise<FalIngestResult> {
  const context = await dependencies.getContext(event.attempt.providerJobId);
  if (['succeeded', 'failed', 'canceled'].includes(context.attemptStatus)) {
    return replayTerminal(event, context, dependencies);
  }

  const status = event.attempt.status;
  if (status.state === 'failed') {
    await dependencies.settlement.release({
      workspaceId: context.workspaceId,
      runId: context.runId,
      reservationId: context.reservation.id,
      amountMicros: context.quotedTotalMicros,
      causativeKey: attemptReleaseCausativeKey(context.runId, context.attemptId),
      requestId: dependencies.requestId,
      metadata: {
        attempt_id: context.attemptId,
        reason: 'provider_failed',
      },
    });
    if (dependencies.recordProviderErrorCode) {
      try {
        await dependencies.recordProviderErrorCode({
          providerRequestId: event.attempt.providerJobId,
          providerErrorCode: providerErrorCodeFromFailure(status.error),
        });
      } catch {
        // Evidence-only. A missing staging RPC must not block release or attempt settlement.
      }
    }
    const advance = await dependencies.advanceAttempt({
      providerRequestId: event.attempt.providerJobId,
      status: 'failed',
      eventId: event.eventId,
    });
    await finishTerminalSettlement(advance, context, dependencies);
    return { status: 'ok', accepted: true, run_status: advance.runStatus };
  }

  if (status.state !== 'succeeded') {
    const advance = await dependencies.advanceAttempt({
      providerRequestId: event.attempt.providerJobId,
      status: 'running',
      eventId: event.eventId,
    });
    return { status: 'ok', accepted: true, run_status: advance.runStatus };
  }

  const objectKey = providerArtifactObjectKey({
    workspaceId: context.workspaceId,
    runId: context.runId,
    attemptId: context.attemptId,
  });
  const stored = await dependencies.storeDelivery({
    context,
    deliveryUrl: status.delivery.transientDeliveryUrl,
    objectKey,
  });
  const capture = captureFor(context, stored);
  // Clamp to the quote instead of throwing. A video provider that returns 8.04 seconds against an
  // 8-second request ceilings to 9 billable units, and the derived amount then exceeds the pinned
  // quote by one unit. Throwing here turned that rounding into a permanent trap: the artifact was
  // already stored and paid for, the throw produced a retryable 503, fal redelivered, and the same
  // throw repeated forever while the reservation never settled. The customer is never charged above
  // what they confirmed; the measured overage is recorded as evidence for margin telemetry instead.
  const captureMicros =
    capture.amountMicros > context.quotedTotalMicros
      ? context.quotedTotalMicros
      : capture.amountMicros;
  const clampedVarianceMicros = capture.amountMicros - captureMicros;
  const singleAttemptPlan = planRunSettlement({
    runId: context.runId,
    reservationMicros: context.reservation.amountMicros,
    outcomes: [
      {
        attemptId: context.attemptId,
        status: 'succeeded',
        captureMicros,
      },
    ],
  });
  const captureMovement = singleAttemptPlan.captures[0];
  if (captureMovement === undefined) {
    throw new RangeError('A successful measured artifact did not produce a capture movement');
  }
  const registered = await dependencies.registerArtifact({
    runId: context.runId,
    runNodeId: context.runNodeId,
    objectKey,
    contentHash: stored.contentHash,
    mimeType: stored.mimeType,
    byteSize: stored.byteSize,
  });
  await dependencies.settlement.capture({
    workspaceId: context.workspaceId,
    runId: context.runId,
    reservationId: context.reservation.id,
    amountMicros: captureMicros,
    reservationRemainingMicros: remainingReservation(context),
    causativeKey: captureMovement.causativeKey,
    requestId: dependencies.requestId,
    metadata: {
      attempt_id: context.attemptId,
      artifact_id: registered.artifactId,
      measured_units: capture.measuredUnits.toString(),
      // Non-zero only when the measured output exceeded the quote and the charge was clamped.
      // This is the margin-telemetry record of what the provider delivered versus what was billed.
      ...(clampedVarianceMicros > 0n
        ? { clamped_variance_micros: clampedVarianceMicros.toString() }
        : {}),
    },
  });
  const advance = await dependencies.advanceAttempt({
    providerRequestId: event.attempt.providerJobId,
    status: 'succeeded',
    eventId: event.eventId,
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
    capture_micros: usdMicrosToSafeInteger(capture.amountMicros),
  };
}

export function createFalWebhookIngestHandler(
  bindings: CoreBindings,
  requestId: string,
  fetchImplementation?: typeof fetch,
): (event: VerifiedFalWebhook) => Promise<FalIngestResult> {
  const machine = new PrivilegedArtifactMachinePort(bindings, fetchImplementation);
  const settlement = createPrivilegedSettlementPort(bindings, fetchImplementation);
  const dependencies: FalIngestDependencies = {
    getContext: (providerRequestId) => machine.getFalContext(providerRequestId),
    storeDelivery: async ({ context, deliveryUrl, objectKey }) =>
      copyFalDeliveryToPrivateR2({
        bindings,
        deliveryUrl,
        objectKey,
        workspaceId: context.workspaceId,
        runId: context.runId,
        attemptId: context.attemptId,
        ...(fetchImplementation === undefined ? {} : { fetchImplementation }),
      }),
    registerArtifact: async (input) => {
      const result = await machine.registerArtifact({
        ...input,
        artifactKind: 'provider_output',
        status: 'available',
      });
      return { artifactId: result.artifact.id, replayed: result.replayed };
    },
    advanceAttempt: (input) => machine.advanceFalAttempt(input),
    recordProviderErrorCode: (input) => machine.recordProviderJobErrorCode(input),
    settlement,
    requestId,
  };
  return (event) => ingestVerifiedFalWebhook(event, dependencies);
}
