import { describe, expect, it } from 'vitest';

import { billingAuditEvent, ledgerAuditEvent } from './audit';
import { usdMicros } from './money';

describe('billing audit event shapes', () => {
  it('constructs the record_ledger_movement audit shape', () => {
    expect(
      ledgerAuditEvent({
        workspaceId: 'workspace-1',
        transactionId: 'transaction-1',
        entryType: 'capture',
        amountMicros: usdMicros(250_000n),
        causativeKey: 'provider:event-1:capture',
        reservationId: 'reservation-1',
        runId: 'run-1',
        requestId: 'request-1',
      }),
    ).toEqual({
      workspaceId: 'workspace-1',
      actorType: 'system',
      actorId: null,
      action: 'ledger.capture',
      entityType: 'ledger_transaction',
      entityId: 'transaction-1',
      requestId: 'request-1',
      details: {
        causative_key: 'provider:event-1:capture',
        amount_micros: 250_000n,
        reservation_id: 'reservation-1',
        run_id: 'run-1',
      },
    });
  });

  it('enforces user actor identity and database-safe names', () => {
    expect(() =>
      billingAuditEvent({
        workspaceId: 'workspace-1',
        actorType: 'user',
        actorId: null,
        action: 'billing.quote_created',
        entityType: 'quote',
        entityId: 'quote-1',
        requestId: 'request-1',
        details: {},
      }),
    ).toThrow('require actorId');
    expect(() =>
      billingAuditEvent({
        workspaceId: 'workspace-1',
        actorType: 'system',
        actorId: null,
        action: 'billing.INVALID' as `billing.${string}`,
        entityType: 'quote',
        entityId: 'quote-1',
        requestId: 'request-1',
        details: {},
      }),
    ).toThrow('database-safe');
  });

  it('returns immutable top-level and detail records', () => {
    const event = billingAuditEvent({
      workspaceId: 'workspace-1',
      actorType: 'operator',
      actorId: null,
      action: 'billing.quote_created',
      entityType: 'quote',
      entityId: 'quote-1',
      requestId: 'request-1',
      details: { price_catalog_version_id: 'catalog-v1' },
    });
    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.details)).toBe(true);
  });
});
