import { describe, expect, it, vi } from 'vitest';

import { usdMicros } from '../../../../packages/billing/src/index';
import type { CoreBindings } from '../../src/bindings';
import { createPrivilegedSettlementPort } from '../../src/composition/settlement';
import type { SettlementPortError } from '../../src/composition/settlement';

const common = {
  workspaceId: 'workspace-1',
  runId: 'run-1',
  reservationId: 'reservation-1',
  causativeKey: 'run:run-1:attempt:attempt-1:capture',
  requestId: 'request-settlement-1',
  metadata: { attempt_id: 'attempt-1' },
};

function bindings(): CoreBindings {
  const secretBindingName = ['SUPABASE', 'SECRET', 'KEY'].join('_');
  return {
    SUPABASE_URL: 'https://project.supabase.co',
    [secretBindingName]: 'fixture-privileged-settlement-key',
  } as unknown as CoreBindings;
}

describe('privileged settlement composition', () => {
  it('persists capture, release, and refund through only the semantic-ledger RPC', async () => {
    const calls: Array<Readonly<{ url: string; headers: Headers; body: unknown }>> = [];
    const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Readonly<Record<string, unknown>>;
      calls.push({ url: String(input), headers: new Headers(init?.headers), body });
      return Response.json({
        transaction_id: `transaction-${String(body.p_entry_type)}`,
        replayed: false,
      });
    }) as unknown as typeof fetch;
    const port = createPrivilegedSettlementPort(bindings(), fetchImplementation);

    await expect(
      port.capture({
        ...common,
        amountMicros: usdMicros(250_000n),
        reservationRemainingMicros: usdMicros(1_000_000n),
      }),
    ).resolves.toEqual({ transactionId: 'transaction-capture', replayed: false });
    await expect(
      port.release({
        ...common,
        amountMicros: usdMicros(750_000n),
        causativeKey: 'run:run-1:settlement:release',
      }),
    ).resolves.toEqual({ transactionId: 'transaction-release', replayed: false });
    await expect(
      port.refund({
        ...common,
        amountMicros: usdMicros(250_000n),
        causativeKey: 'run:run-1:attempt:attempt-1:refund',
      }),
    ).resolves.toEqual({ transactionId: 'transaction-refund', replayed: false });

    expect(fetchImplementation).toHaveBeenCalledTimes(3);
    for (const call of calls) {
      expect(call.url).toBe('https://project.supabase.co/rest/v1/rpc/record_ledger_movement');
      expect(call.headers.get('apikey')).toBe('fixture-privileged-settlement-key');
      expect(call.headers.get('authorization')).toBeNull();
    }
    expect(calls.map((call) => call.body)).toEqual([
      expect.objectContaining({
        p_entry_type: 'capture',
        p_amount_micros: 250_000,
        p_causative_key: common.causativeKey,
      }),
      expect.objectContaining({
        p_entry_type: 'release',
        p_amount_micros: 750_000,
        p_causative_key: 'run:run-1:settlement:release',
      }),
      expect.objectContaining({
        p_entry_type: 'refund',
        p_amount_micros: 250_000,
        p_causative_key: 'run:run-1:attempt:attempt-1:refund',
      }),
    ]);
  });

  it('rejects capture above the remaining reservation before any RPC call', async () => {
    const fetchImplementation = vi.fn() as unknown as typeof fetch;
    const port = createPrivilegedSettlementPort(bindings(), fetchImplementation);

    await expect(
      port.capture({
        ...common,
        amountMicros: usdMicros(500_001n),
        reservationRemainingMicros: usdMicros(500_000n),
      }),
    ).rejects.toThrow('exceeds the remaining reservation');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('reports rejected privileged credentials as non-retryable', async () => {
    const port = createPrivilegedSettlementPort(
      bindings(),
      vi.fn(async () => new Response(null, { status: 401 })) as unknown as typeof fetch,
    );

    await expect(
      port.release({
        ...common,
        amountMicros: usdMicros(1n),
        causativeKey: 'run:run-1:settlement:release',
      }),
    ).rejects.toMatchObject({
      reason: 'settlement_forbidden',
      retryable: false,
    } satisfies Partial<SettlementPortError>);
  });
});
