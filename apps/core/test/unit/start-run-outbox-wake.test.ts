import { describe, expect, it, vi } from 'vitest';

import {
  createDatabaseRepositories,
  type DatabaseExecutor,
} from '../../../../packages/db/src/index';
import { createSupabaseHandlerPorts } from '../../src/composition/supabase';
import { SupabaseDataApiExecutor } from '../../src/data/supabase-data-api';

const workspaceId = '10000000-0000-4000-8000-000000000001';
const runId = '20000000-0000-4000-8000-000000000001';
const reservationId = '30000000-0000-4000-8000-000000000001';
const eventId = '70000000-0000-4000-8000-000000000001';
const handlerContext = {
  workspace_id: workspaceId,
  actor_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  request_id: 'request-start-wake',
};
const startInput = {
  canvasId: '40000000-0000-4000-8000-000000000001',
  expectedRevisionId: '50000000-0000-4000-8000-000000000001',
  quoteId: '60000000-0000-4000-8000-000000000001',
  confirmed: true as const,
  idempotencyKey: 'start-wake-1',
};

function barrierPorts(input: {
  readonly send?: (message: unknown) => Promise<unknown>;
  readonly queuesEnabled?: 'true' | 'false';
  readonly includeQueue?: boolean;
  readonly rpcResult?: Readonly<Record<string, unknown>>;
}) {
  const rpc = vi.fn().mockResolvedValue(
    input.rpcResult ?? {
      run_id: runId,
      reservation_id: reservationId,
      status: 'queued',
      event_id: eventId,
    },
  );
  const executor = { rpc } as unknown as DatabaseExecutor;
  const send = input.send ?? vi.fn();
  const ports = createSupabaseHandlerPorts(
    new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-fixture-key',
      callerJwt: 'verified-caller-jwt',
    }),
    createDatabaseRepositories(executor),
    {
      CONFIRMATION_SIGNING_KEY: 'start-wake-fixture-signing-key-32-chars',
      ...(input.queuesEnabled === undefined ? {} : { QUEUES_ENABLED: input.queuesEnabled }),
      ...(input.includeQueue === false ? {} : { OUTBOX_DISPATCH_QUEUE: { send } }),
    },
  );
  return { ports, send, rpc };
}

describe('start_run barrier outbox wake', () => {
  it('returns only the handler barrier shape and no-ops enqueue while QUEUES_ENABLED is false', async () => {
    const sent: unknown[] = [];
    const { ports } = barrierPorts({
      queuesEnabled: 'false',
      send: async (message) => {
        sent.push(message);
      },
    });

    await expect(ports.runs.startBarrier(handlerContext, startInput)).resolves.toEqual({
      runId,
      reservationId,
      status: 'queued',
    });
    expect(sent).toEqual([]);
  });

  it('enqueues only { type: outbox.wake, event_id } after commit when enabled', async () => {
    const sent: unknown[] = [];
    const { ports, rpc } = barrierPorts({
      queuesEnabled: 'true',
      send: async (message) => {
        sent.push(message);
      },
    });

    await expect(ports.runs.startBarrier(handlerContext, startInput)).resolves.toEqual({
      runId,
      reservationId,
      status: 'queued',
    });
    expect(rpc).toHaveBeenCalledWith('start_run_barrier', {
      p_workspace_id: workspaceId,
      p_canvas_id: startInput.canvasId,
      p_expected_revision_id: startInput.expectedRevisionId,
      p_quote_id: startInput.quoteId,
      p_confirmed: true,
      p_idempotency_key: startInput.idempotencyKey,
      p_request_id: handlerContext.request_id,
    });
    expect(sent).toEqual([{ type: 'outbox.wake', event_id: eventId }]);
    expect(Object.keys(sent[0] as object)).toEqual(['type', 'event_id']);
  });

  it('skips send when the producer binding is missing even if the kill switch is on', async () => {
    const { ports } = barrierPorts({
      queuesEnabled: 'true',
      includeQueue: false,
    });

    await expect(ports.runs.startBarrier(handlerContext, startInput)).resolves.toEqual({
      runId,
      reservationId,
      status: 'queued',
    });
  });

  it('does not invent event_id from run_id when the RPC omits it', async () => {
    const send = vi.fn();
    const { ports } = barrierPorts({
      queuesEnabled: 'true',
      send,
      rpcResult: {
        run_id: runId,
        reservation_id: reservationId,
        status: 'queued',
      },
    });

    await expect(ports.runs.startBarrier(handlerContext, startInput)).rejects.toThrow(
      'missing event_id',
    );
    expect(send).not.toHaveBeenCalled();
  });
});
