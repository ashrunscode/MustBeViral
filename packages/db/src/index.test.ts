import { describe, expect, it } from 'vitest';

import {
  assertBalancedLedgerEntries,
  assertQuoteWindow,
  integerMicros,
  isAllowedUserDatabasePath,
  isBalancedLedgerEntries,
  tenantContext,
} from './index';

describe('database access boundary', () => {
  it('does not treat service or Hyperdrive paths as default user authority', () => {
    expect(isAllowedUserDatabasePath('supabase-data-api-rpc')).toBe(true);
    expect(isAllowedUserDatabasePath('service-role')).toBe(false);
    expect(isAllowedUserDatabasePath('hyperdrive')).toBe(false);
  });
});

describe('tenant-safe repository invariants', () => {
  it('requires explicit workspace, actor, and request context', () => {
    expect(
      tenantContext({
        workspaceId: '10000000-0000-4000-8000-000000000001',
        actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        requestId: 'request-1',
      }),
    ).toEqual({
      workspaceId: '10000000-0000-4000-8000-000000000001',
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      requestId: 'request-1',
    });
    expect(() => tenantContext({ workspaceId: 'nope', actorId: 'nope', requestId: 'x' })).toThrow(
      TypeError,
    );
  });

  it('accepts only non-negative safe integer micros', () => {
    expect(integerMicros(1_250_000)).toBe(1_250_000);
    expect(() => integerMicros(-1)).toThrow(RangeError);
    expect(() => integerMicros(1.5)).toThrow(RangeError);
    expect(() => integerMicros(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });

  it('requires balanced double-entry ledger drafts', () => {
    const balanced = [
      {
        accountCode: 'wallet_available',
        direction: 'debit',
        amountMicros: integerMicros(2_000_000),
      },
      {
        accountCode: 'wallet_reserved',
        direction: 'credit',
        amountMicros: integerMicros(2_000_000),
      },
    ] as const;
    const unbalanced = [
      { accountCode: 'wallet_available', direction: 'debit', amountMicros: integerMicros(1) },
      { accountCode: 'wallet_reserved', direction: 'credit', amountMicros: integerMicros(2) },
    ] as const;

    expect(isBalancedLedgerEntries(balanced)).toBe(true);
    expect(isBalancedLedgerEntries(unbalanced)).toBe(false);
    expect(() => assertBalancedLedgerEntries(unbalanced)).toThrow(RangeError);
    expect(() => assertBalancedLedgerEntries([])).toThrow(RangeError);
  });

  it('enforces the immutable fifteen-minute quote window', () => {
    const createdAt = new Date('2026-07-19T12:00:00.000Z');
    expect(() => assertQuoteWindow(createdAt, new Date('2026-07-19T12:15:00.000Z'))).not.toThrow();
    expect(() => assertQuoteWindow(createdAt, new Date('2026-07-19T12:14:59.999Z'))).toThrow(
      RangeError,
    );
  });
});
