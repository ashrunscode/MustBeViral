import { describe, expect, it, vi } from 'vitest';

import {
  assertBalancedLedgerEntries,
  assertQuoteWindow,
  createDatabaseRepositories,
  integerMicros,
  isAllowedUserDatabasePath,
  isBalancedLedgerEntries,
  tenantContext,
} from './index';
import type { DatabaseExecutor } from './index';

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

  it('paginates the complete wallet ledger before calculating available balance', async () => {
    const firstPage = Array.from({ length: 100 }, () => ({
      direction: 'credit' as const,
      amount_micros: 1,
    }));
    const select = vi
      .fn()
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce([
        {
          direction: 'credit' as const,
          amount_micros: 2,
        },
      ]);
    const executor = { select } as unknown as DatabaseExecutor;
    const repositories = createDatabaseRepositories(executor);
    const context = tenantContext({
      workspaceId: '10000000-0000-4000-8000-000000000001',
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      requestId: 'request-ledger',
    });

    await expect(repositories.billing.availableBalance(context)).resolves.toBe(102);
    expect(select).toHaveBeenNthCalledWith(
      2,
      'ledger_transactions',
      expect.objectContaining({ limit: '100', offset: '100' }),
    );
  });

  it('paginates every tenant-scoped artifact for a receipt run', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `artifact-${String(index).padStart(3, '0')}`,
    }));
    const finalArtifact = { id: 'artifact-100' };
    const select = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce([finalArtifact]);
    const executor = { select } as unknown as DatabaseExecutor;
    const repositories = createDatabaseRepositories(executor);
    const context = tenantContext({
      workspaceId: '10000000-0000-4000-8000-000000000001',
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      requestId: 'request-artifacts',
    });

    await expect(
      repositories.artifacts.listForRun(context, '20000000-0000-4000-8000-000000000001'),
    ).resolves.toHaveLength(101);
    expect(select).toHaveBeenNthCalledWith(
      2,
      'artifacts',
      expect.objectContaining({
        workspace_id: 'eq.10000000-0000-4000-8000-000000000001',
        run_id: 'eq.20000000-0000-4000-8000-000000000001',
        limit: '100',
        offset: '100',
      }),
    );
  });

  it('paginates a receipt ledger by run instead of truncating workspace history', async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      id: `ledger-${String(index).padStart(3, '0')}`,
    }));
    const finalEntry = { id: 'ledger-100' };
    const select = vi.fn().mockResolvedValueOnce(firstPage).mockResolvedValueOnce([finalEntry]);
    const executor = { select } as unknown as DatabaseExecutor;
    const repositories = createDatabaseRepositories(executor);
    const context = tenantContext({
      workspaceId: '10000000-0000-4000-8000-000000000001',
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      requestId: 'request-run-ledger',
    });

    await expect(
      repositories.billing.listLedgerForRun(context, '20000000-0000-4000-8000-000000000001'),
    ).resolves.toHaveLength(101);
    expect(select).toHaveBeenNthCalledWith(
      1,
      'ledger_transactions',
      expect.objectContaining({
        workspace_id: 'eq.10000000-0000-4000-8000-000000000001',
        run_id: 'eq.20000000-0000-4000-8000-000000000001',
        order: 'created_at.asc,id.asc',
      }),
    );
    expect(select).toHaveBeenNthCalledWith(
      2,
      'ledger_transactions',
      expect.objectContaining({ limit: '100', offset: '100' }),
    );
  });

  it('returns the existing outbox event_id from the start barrier RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      run_id: '20000000-0000-4000-8000-000000000001',
      reservation_id: '30000000-0000-4000-8000-000000000001',
      status: 'queued',
      event_id: '70000000-0000-4000-8000-000000000001',
    });
    const executor = { rpc } as unknown as DatabaseExecutor;
    const repositories = createDatabaseRepositories(executor);
    const context = tenantContext({
      workspaceId: '10000000-0000-4000-8000-000000000001',
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      requestId: 'request-start',
    });

    await expect(
      repositories.runs.startBarrier(context, {
        canvasId: '40000000-0000-4000-8000-000000000001',
        expectedRevisionId: '50000000-0000-4000-8000-000000000001',
        quoteId: '60000000-0000-4000-8000-000000000001',
        confirmed: true,
        idempotencyKey: 'start-idempotency-1',
      }),
    ).resolves.toEqual({
      runId: '20000000-0000-4000-8000-000000000001',
      reservationId: '30000000-0000-4000-8000-000000000001',
      status: 'queued',
      eventId: '70000000-0000-4000-8000-000000000001',
    });
    expect(rpc).toHaveBeenCalledWith('start_run_barrier', {
      p_workspace_id: '10000000-0000-4000-8000-000000000001',
      p_canvas_id: '40000000-0000-4000-8000-000000000001',
      p_expected_revision_id: '50000000-0000-4000-8000-000000000001',
      p_quote_id: '60000000-0000-4000-8000-000000000001',
      p_confirmed: true,
      p_idempotency_key: 'start-idempotency-1',
      p_request_id: 'request-start',
    });
  });

  it('rejects a barrier payload that copies run_id into event_id', async () => {
    const runId = '20000000-0000-4000-8000-000000000001';
    const rpc = vi.fn().mockResolvedValue({
      run_id: runId,
      reservation_id: '30000000-0000-4000-8000-000000000001',
      status: 'queued',
      event_id: runId,
    });
    const repositories = createDatabaseRepositories({
      rpc,
    } as unknown as DatabaseExecutor);

    await expect(
      repositories.runs.startBarrier(
        tenantContext({
          workspaceId: '10000000-0000-4000-8000-000000000001',
          actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
          requestId: 'request-start-derived',
        }),
        {
          canvasId: '40000000-0000-4000-8000-000000000001',
          expectedRevisionId: '50000000-0000-4000-8000-000000000001',
          quoteId: '60000000-0000-4000-8000-000000000001',
          confirmed: true,
          idempotencyKey: 'start-idempotency-derived',
        },
      ),
    ).rejects.toThrow('existing outbox id');
  });
});
