import { describe, expect, it } from 'vitest';

import { assertBalancedLedgerEntries, integerMicros } from '../../db/src/invariants';
import {
  applyLedgerMovementToReservation,
  captureLedgerMovement,
  creditLedgerMovement,
  refundLedgerMovement,
  releaseLedgerMovement,
  reserveLedgerMovement,
  validateLedgerMovement,
  type LedgerMovementDraft,
} from './ledger';
import { usdMicros } from './money';

const base = {
  amountMicros: usdMicros(500_000n),
  causativeKey: 'run:run-1:movement',
  requestId: 'request-1',
  reservationId: 'reservation-1',
  runId: 'run-1',
};

describe('balanced ledger movement contracts', () => {
  it.each([
    ['credit', creditLedgerMovement, 'funding_clearing', 'wallet_available'],
    ['reserve', reserveLedgerMovement, 'wallet_available', 'wallet_reserved'],
    ['capture', captureLedgerMovement, 'wallet_reserved', 'usage_expense'],
    ['release', releaseLedgerMovement, 'wallet_reserved', 'wallet_available'],
    ['refund', refundLedgerMovement, 'usage_expense', 'wallet_available'],
  ] as const)('constructs the %s RPC account pair', (entryType, constructor, debit, credit) => {
    const input =
      entryType === 'credit'
        ? {
            amountMicros: base.amountMicros,
            causativeKey: base.causativeKey,
            requestId: base.requestId,
          }
        : base;
    const movement = constructor(input);
    expect(movement.entries).toEqual([
      {
        entryType,
        accountCode: debit,
        direction: 'debit',
        amountMicros: 500_000n,
      },
      {
        entryType,
        accountCode: credit,
        direction: 'credit',
        amountMicros: 500_000n,
      },
    ]);
    expect(Object.isFrozen(movement)).toBe(true);
    expect(Object.isFrozen(movement.entries)).toBe(true);
  });

  it('composes the actual packages/db integer and balance invariants', () => {
    const movement = reserveLedgerMovement(base);
    expect(() =>
      validateLedgerMovement(movement, {
        integerMicros,
        assertBalancedLedgerEntries,
      }),
    ).not.toThrow();
  });

  it('rejects zero movements and invalid reference shapes', () => {
    expect(() =>
      creditLedgerMovement({
        amountMicros: usdMicros(0n),
        causativeKey: 'funding:1',
        requestId: 'request-1',
      }),
    ).toThrow('greater than zero');
    expect(() => creditLedgerMovement(base)).toThrow('cannot reference');
    expect(() =>
      reserveLedgerMovement({
        amountMicros: base.amountMicros,
        causativeKey: base.causativeKey,
        requestId: base.requestId,
      }),
    ).toThrow('require reservationId and runId');
  });

  it('rejects an unbalanced or semantically wrong pair', () => {
    const valid = reserveLedgerMovement(base);
    const invalid = {
      ...valid,
      entries: [valid.entries[0], { ...valid.entries[1], amountMicros: usdMicros(1n) }],
    } as unknown as LedgerMovementDraft;
    expect(() => validateLedgerMovement(invalid)).toThrow('balanced account pair');
  });
});

describe('reservation accounting invariants', () => {
  const emptyReservation = {
    amountMicros: usdMicros(1_000_000n),
    capturedMicros: usdMicros(0n),
    releasedMicros: usdMicros(0n),
    refundedMicros: usdMicros(0n),
  };

  it('requires reserve to match the authoritative reservation', () => {
    expect(
      applyLedgerMovementToReservation(emptyReservation, 'reserve', usdMicros(1_000_000n)),
    ).toMatchObject({ status: 'active' });
    expect(() =>
      applyLedgerMovementToReservation(emptyReservation, 'reserve', usdMicros(999_999n)),
    ).toThrow('must equal');
  });

  it('supports partial then full capture without exceeding the reservation', () => {
    const partial = applyLedgerMovementToReservation(
      emptyReservation,
      'capture',
      usdMicros(400_000n),
    );
    expect(partial).toMatchObject({
      capturedMicros: 400_000n,
      status: 'partially_captured',
    });
    expect(applyLedgerMovementToReservation(partial, 'capture', usdMicros(600_000n))).toMatchObject(
      { capturedMicros: 1_000_000n, status: 'captured' },
    );
    expect(() => applyLedgerMovementToReservation(partial, 'capture', usdMicros(600_001n))).toThrow(
      'exceeds',
    );
  });

  it('supports partial-success capture plus release', () => {
    const captured = applyLedgerMovementToReservation(
      emptyReservation,
      'capture',
      usdMicros(400_000n),
    );
    expect(
      applyLedgerMovementToReservation(captured, 'release', usdMicros(600_000n)),
    ).toMatchObject({
      capturedMicros: 400_000n,
      releasedMicros: 600_000n,
      status: 'partially_captured',
    });
  });

  it('marks a full uncaptured release as released', () => {
    expect(
      applyLedgerMovementToReservation(emptyReservation, 'release', usdMicros(1_000_000n)),
    ).toMatchObject({ releasedMicros: 1_000_000n, status: 'released' });
  });

  it('allows refunds only up to captured value', () => {
    const captured = applyLedgerMovementToReservation(
      emptyReservation,
      'capture',
      usdMicros(400_000n),
    );
    expect(applyLedgerMovementToReservation(captured, 'refund', usdMicros(400_000n))).toMatchObject(
      { refundedMicros: 400_000n, status: 'refunded' },
    );
    expect(() => applyLedgerMovementToReservation(captured, 'refund', usdMicros(400_001n))).toThrow(
      'exceeds captured',
    );
  });
});
