import { positiveUsdMicros, usdMicros, usdMicrosToSafeInteger, type UsdMicros } from './money';

export const ledgerEntryTypes = ['credit', 'reserve', 'capture', 'release', 'refund'] as const;
export type LedgerEntryType = (typeof ledgerEntryTypes)[number];

export type LedgerAccountCode =
  'funding_clearing' | 'wallet_available' | 'wallet_reserved' | 'usage_expense';

export type LedgerDirection = 'debit' | 'credit';

export interface LedgerEntry {
  readonly entryType: LedgerEntryType;
  readonly accountCode: LedgerAccountCode;
  readonly direction: LedgerDirection;
  readonly amountMicros: UsdMicros;
}

export interface LedgerMovementDraft {
  readonly entryType: LedgerEntryType;
  readonly amountMicros: UsdMicros;
  readonly causativeKey: string;
  readonly requestId: string;
  readonly reservationId: string | null;
  readonly runId: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly entries: readonly [LedgerEntry, LedgerEntry];
}

export interface LedgerMovementInput {
  readonly amountMicros: UsdMicros;
  readonly causativeKey: string;
  readonly requestId: string;
  readonly reservationId?: string;
  readonly runId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface DatabaseLedgerDraftEntry {
  readonly accountCode: LedgerAccountCode;
  readonly direction: LedgerDirection;
  readonly amountMicros: number;
}

export interface DatabaseLedgerInvariants {
  integerMicros(value: number): number;
  assertBalancedLedgerEntries(entries: readonly DatabaseLedgerDraftEntry[]): void;
}

export interface ReservationAmounts {
  readonly amountMicros: UsdMicros;
  readonly capturedMicros: UsdMicros;
  readonly releasedMicros: UsdMicros;
  readonly refundedMicros: UsdMicros;
}

export type ReservationStatus =
  'active' | 'partially_captured' | 'captured' | 'released' | 'refunded';

export interface ReservationMovementResult extends ReservationAmounts {
  readonly status: ReservationStatus;
}

const accountPairs: Readonly<
  Record<LedgerEntryType, readonly [LedgerAccountCode, LedgerAccountCode]>
> = Object.freeze({
  credit: ['funding_clearing', 'wallet_available'],
  reserve: ['wallet_available', 'wallet_reserved'],
  capture: ['wallet_reserved', 'usage_expense'],
  release: ['wallet_reserved', 'wallet_available'],
  refund: ['usage_expense', 'wallet_available'],
});

function requireBoundedText(value: string, field: string, maximumLength: number): void {
  if (value.length < 1 || value.length > maximumLength) {
    throw new TypeError(`${field} must be between 1 and ${maximumLength} characters`);
  }
}

function constructLedgerMovement(
  entryType: LedgerEntryType,
  input: LedgerMovementInput,
): LedgerMovementDraft {
  const amountMicros = positiveUsdMicros(input.amountMicros);
  requireBoundedText(input.causativeKey, 'causativeKey', 240);
  requireBoundedText(input.requestId, 'requestId', 200);

  const reservationId = input.reservationId ?? null;
  const runId = input.runId ?? null;
  if (entryType === 'credit') {
    if (reservationId !== null || runId !== null) {
      throw new TypeError('Credit movements cannot reference a reservation or run');
    }
  } else if (reservationId === null || runId === null) {
    throw new TypeError(`${entryType} movements require reservationId and runId`);
  }

  const [debitAccount, creditAccount] = accountPairs[entryType];
  const entries = Object.freeze([
    Object.freeze({
      entryType,
      accountCode: debitAccount,
      direction: 'debit' as const,
      amountMicros,
    }),
    Object.freeze({
      entryType,
      accountCode: creditAccount,
      direction: 'credit' as const,
      amountMicros,
    }),
  ]) as unknown as readonly [LedgerEntry, LedgerEntry];

  const movement = Object.freeze({
    entryType,
    amountMicros,
    causativeKey: input.causativeKey,
    requestId: input.requestId,
    reservationId,
    runId,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    entries,
  });
  validateLedgerMovement(movement);
  return movement;
}

export function creditLedgerMovement(input: LedgerMovementInput): LedgerMovementDraft {
  return constructLedgerMovement('credit', input);
}

export function reserveLedgerMovement(input: LedgerMovementInput): LedgerMovementDraft {
  return constructLedgerMovement('reserve', input);
}

export function captureLedgerMovement(input: LedgerMovementInput): LedgerMovementDraft {
  return constructLedgerMovement('capture', input);
}

export function releaseLedgerMovement(input: LedgerMovementInput): LedgerMovementDraft {
  return constructLedgerMovement('release', input);
}

export function refundLedgerMovement(input: LedgerMovementInput): LedgerMovementDraft {
  return constructLedgerMovement('refund', input);
}

export function validateLedgerMovement(
  movement: LedgerMovementDraft,
  databaseInvariants?: DatabaseLedgerInvariants,
): void {
  positiveUsdMicros(movement.amountMicros);
  requireBoundedText(movement.causativeKey, 'causativeKey', 240);
  requireBoundedText(movement.requestId, 'requestId', 200);
  if (movement.entries.length !== 2) {
    throw new RangeError('Ledger movements require exactly two entries');
  }

  const [expectedDebit, expectedCredit] = accountPairs[movement.entryType];
  const [debit, credit] = movement.entries;
  if (
    debit.direction !== 'debit' ||
    debit.accountCode !== expectedDebit ||
    debit.entryType !== movement.entryType ||
    debit.amountMicros !== movement.amountMicros ||
    credit.direction !== 'credit' ||
    credit.accountCode !== expectedCredit ||
    credit.entryType !== movement.entryType ||
    credit.amountMicros !== movement.amountMicros
  ) {
    throw new RangeError('Ledger entries do not match the semantic balanced account pair');
  }

  if (movement.entryType === 'credit') {
    if (movement.reservationId !== null || movement.runId !== null) {
      throw new TypeError('Credit movements cannot reference a reservation or run');
    }
  } else if (movement.reservationId === null || movement.runId === null) {
    throw new TypeError('Non-credit movements require a reservation and run');
  }

  if (databaseInvariants !== undefined) {
    const entries = movement.entries.map((entry): DatabaseLedgerDraftEntry => ({
      accountCode: entry.accountCode,
      direction: entry.direction,
      amountMicros: databaseInvariants.integerMicros(usdMicrosToSafeInteger(entry.amountMicros)),
    }));
    databaseInvariants.assertBalancedLedgerEntries(entries);
  }
}

export function applyLedgerMovementToReservation(
  reservation: ReservationAmounts,
  entryType: Exclude<LedgerEntryType, 'credit'>,
  movementMicros: UsdMicros,
): ReservationMovementResult {
  usdMicros(reservation.amountMicros);
  usdMicros(reservation.capturedMicros);
  usdMicros(reservation.releasedMicros);
  usdMicros(reservation.refundedMicros);
  const amount = positiveUsdMicros(movementMicros);
  if (reservation.capturedMicros + reservation.releasedMicros > reservation.amountMicros) {
    throw new RangeError('Reservation capture plus release exceeds its amount');
  }
  if (reservation.refundedMicros > reservation.capturedMicros) {
    throw new RangeError('Reservation refund exceeds captured value');
  }

  let capturedMicros = reservation.capturedMicros;
  let releasedMicros = reservation.releasedMicros;
  let refundedMicros = reservation.refundedMicros;
  let status: ReservationStatus = 'active';

  if (entryType === 'reserve') {
    if (amount !== reservation.amountMicros) {
      throw new RangeError('Reserve movement must equal the reservation amount');
    }
  } else if (entryType === 'capture') {
    capturedMicros = usdMicros(capturedMicros + amount);
    if (capturedMicros + releasedMicros > reservation.amountMicros) {
      throw new RangeError('Capture exceeds the remaining reservation');
    }
    status = capturedMicros === reservation.amountMicros ? 'captured' : 'partially_captured';
  } else if (entryType === 'release') {
    releasedMicros = usdMicros(releasedMicros + amount);
    if (capturedMicros + releasedMicros > reservation.amountMicros) {
      throw new RangeError('Release exceeds the remaining reservation');
    }
    status =
      capturedMicros === 0n && releasedMicros === reservation.amountMicros
        ? 'released'
        : 'partially_captured';
  } else {
    refundedMicros = usdMicros(refundedMicros + amount);
    if (refundedMicros > capturedMicros) {
      throw new RangeError('Refund exceeds captured value');
    }
    status = 'refunded';
  }

  return Object.freeze({
    amountMicros: reservation.amountMicros,
    capturedMicros,
    releasedMicros,
    refundedMicros,
    status,
  });
}
