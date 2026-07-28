import {
  ZERO_USD_MICROS,
  addUsdMicros,
  multiplyUsdMicros,
  usdMicros,
  type UsdMicros,
} from './money';

export type FalCatalogCapturePrice =
  | Readonly<{ unit: 'image'; unitPriceMicros: UsdMicros }>
  | Readonly<{ unit: 'video_second'; unitPriceMicros: UsdMicros }>;

export type VerifiedFalOutputMeasurement =
  | Readonly<{
      kind: 'images';
      artifacts: readonly Readonly<{ widthPixels: number; heightPixels: number }>[];
    }>
  | Readonly<{ kind: 'video'; durationMilliseconds: number }>;

export interface FalCaptureDerivation {
  readonly measuredUnits: bigint;
  readonly amountMicros: UsdMicros;
}

export type AttemptSettlementOutcome =
  | Readonly<{ attemptId: string; status: 'succeeded'; captureMicros: UsdMicros }>
  | Readonly<{ attemptId: string; status: 'failed' | 'canceled' | 'skipped' }>;

export interface AttemptCapturePlan {
  readonly attemptId: string;
  readonly amountMicros: UsdMicros;
  readonly causativeKey: string;
}

export interface RunSettlementPlan {
  readonly captures: readonly AttemptCapturePlan[];
  readonly captureTotalMicros: UsdMicros;
  readonly releaseRemainderMicros: UsdMicros;
  readonly releaseCausativeKey: string;
}

function requireBoundedIdentifier(value: string, field: string): void {
  if (value.length < 1 || value.length > 100) {
    throw new TypeError(`${field} must be between 1 and 100 characters`);
  }
}

function requirePositiveSafeInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${field} must be a positive safe integer`);
  }
  return value;
}

function causativeKey(value: string): string {
  if (value.length > 240) throw new RangeError('Settlement causative key exceeds 240 characters');
  return value;
}

/**
 * Derives fal capture from a pinned catalog unit price and verified artifact measurements only.
 * Caller-requested or quoted quantities are intentionally absent from this contract.
 */
export function deriveFalCaptureAmount(
  price: FalCatalogCapturePrice,
  measurement: VerifiedFalOutputMeasurement,
): FalCaptureDerivation {
  usdMicros(price.unitPriceMicros);

  let measuredUnits: bigint;
  if (price.unit === 'image') {
    if (measurement.kind !== 'images' || measurement.artifacts.length === 0) {
      throw new TypeError('An image catalog price requires verified image artifacts');
    }
    for (const artifact of measurement.artifacts) {
      requirePositiveSafeInteger(artifact.widthPixels, 'widthPixels');
      requirePositiveSafeInteger(artifact.heightPixels, 'heightPixels');
    }
    measuredUnits = BigInt(measurement.artifacts.length);
  } else {
    if (measurement.kind !== 'video') {
      throw new TypeError('A video-second catalog price requires a verified video duration');
    }
    const durationMilliseconds = requirePositiveSafeInteger(
      measurement.durationMilliseconds,
      'durationMilliseconds',
    );
    measuredUnits = BigInt(Math.ceil(durationMilliseconds / 1000));
  }

  return Object.freeze({
    measuredUnits,
    amountMicros: multiplyUsdMicros(price.unitPriceMicros, measuredUnits),
  });
}

export function attemptCaptureCausativeKey(runId: string, attemptId: string): string {
  requireBoundedIdentifier(runId, 'runId');
  requireBoundedIdentifier(attemptId, 'attemptId');
  return causativeKey(`run:${runId}:attempt:${attemptId}:capture`);
}

export function attemptReleaseCausativeKey(runId: string, attemptId: string): string {
  requireBoundedIdentifier(runId, 'runId');
  requireBoundedIdentifier(attemptId, 'attemptId');
  return causativeKey(`run:${runId}:attempt:${attemptId}:release`);
}

export function attemptRefundCausativeKey(runId: string, attemptId: string): string {
  requireBoundedIdentifier(runId, 'runId');
  requireBoundedIdentifier(attemptId, 'attemptId');
  return causativeKey(`run:${runId}:attempt:${attemptId}:refund`);
}

export function runReleaseCausativeKey(runId: string): string {
  requireBoundedIdentifier(runId, 'runId');
  return causativeKey(`run:${runId}:settlement:release`);
}

/**
 * Produces per-attempt captures and the exact reservation remainder. Applying every non-zero
 * movement in the returned plan leaves captured + released equal to the reservation.
 */
export function planRunSettlement(
  input: Readonly<{
    runId: string;
    reservationMicros: UsdMicros;
    outcomes: readonly AttemptSettlementOutcome[];
  }>,
): RunSettlementPlan {
  requireBoundedIdentifier(input.runId, 'runId');
  usdMicros(input.reservationMicros);

  const seenAttemptIds = new Set<string>();
  let captureTotalMicros = ZERO_USD_MICROS;
  const captures: AttemptCapturePlan[] = [];

  for (const outcome of input.outcomes) {
    requireBoundedIdentifier(outcome.attemptId, 'attemptId');
    if (seenAttemptIds.has(outcome.attemptId)) {
      throw new RangeError(`Duplicate attempt settlement outcome: ${outcome.attemptId}`);
    }
    seenAttemptIds.add(outcome.attemptId);
    if (outcome.status !== 'succeeded') continue;

    usdMicros(outcome.captureMicros);
    if (outcome.captureMicros === ZERO_USD_MICROS) {
      throw new RangeError('A succeeded attempt capture must be greater than zero');
    }
    captureTotalMicros = addUsdMicros(captureTotalMicros, outcome.captureMicros);
    if (captureTotalMicros > input.reservationMicros) {
      throw new RangeError('Attempt captures exceed the reservation');
    }
    captures.push(
      Object.freeze({
        attemptId: outcome.attemptId,
        amountMicros: outcome.captureMicros,
        causativeKey: attemptCaptureCausativeKey(input.runId, outcome.attemptId),
      }),
    );
  }

  return Object.freeze({
    captures: Object.freeze(captures),
    captureTotalMicros,
    releaseRemainderMicros: usdMicros(input.reservationMicros - captureTotalMicros),
    releaseCausativeKey: runReleaseCausativeKey(input.runId),
  });
}
