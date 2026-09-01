import { describe, expect, it, vi } from 'vitest';

import {
  consumeOutboxWakeBatch,
  enqueueOutboxWake,
  parseOutboxWakeMessage,
  queuesEnabled,
} from '../../src/composition/outbox-queue';

describe('outbox queue', () => {
  it('stays disabled unless QUEUES_ENABLED is the string true', () => {
    expect(queuesEnabled({})).toBe(false);
    expect(queuesEnabled({ QUEUES_ENABLED: 'false' })).toBe(false);
    expect(queuesEnabled({ QUEUES_ENABLED: 'true' })).toBe(true);
  });

  it('accepts event-id wake messages only', () => {
    expect(parseOutboxWakeMessage({ type: 'outbox.wake', event_id: 'evt_1' })).toEqual({
      type: 'outbox.wake',
      event_id: 'evt_1',
    });
  });

  it('rejects ledger, reservation, revision, membership, and canvas-head fields', () => {
    const forbidden = [
      'ledger',
      'reservation_id',
      'wallet_balance_micros',
      'revision_id',
      'expected_revision_id',
      'canvas_head',
      'membership',
    ] as const;
    for (const key of forbidden) {
      expect(() =>
        parseOutboxWakeMessage({
          type: 'outbox.wake',
          event_id: 'evt_1',
          [key]: 'must-not-travel-on-the-queue',
        }),
      ).toThrow(new RegExp(key));
    }
  });

  it('does not send when the queue is disabled', async () => {
    const send = vi.fn();
    await expect(enqueueOutboxWake({ send }, false, 'evt_1')).resolves.toBe('skipped');
    expect(send).not.toHaveBeenCalled();
  });

  it('sends only an event id when enabled', async () => {
    const sent: unknown[] = [];
    const send = async (message: unknown) => {
      sent.push(message);
    };
    await expect(enqueueOutboxWake({ send }, true, 'evt_1')).resolves.toBe('sent');
    expect(sent).toEqual([{ type: 'outbox.wake', event_id: 'evt_1' }]);
    expect(Object.keys(sent[0] as object)).toEqual(['type', 'event_id']);
  });

  it('does not send when the producer binding is absent even if the kill switch is on', async () => {
    await expect(enqueueOutboxWake(undefined, true, 'evt_1')).resolves.toBe('skipped');
  });

  it('rejects an empty event_id before send when enabled', async () => {
    const send = vi.fn();
    await expect(enqueueOutboxWake({ send }, true, '')).rejects.toThrow('event_id is required');
    expect(send).not.toHaveBeenCalled();
  });

  it('drains through the existing scheduled outbox path, not a second ledger writer', async () => {
    const drain = vi.fn(async () => undefined);
    await expect(
      consumeOutboxWakeBatch({
        messages: [{ type: 'outbox.wake', event_id: 'evt_1' }],
        drain,
      }),
    ).resolves.toBe(1);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('accepts a scheduled drain that returns a status instead of void', async () => {
    const drain = vi.fn(async () => ({ status: 'disabled' as const }));
    await expect(
      consumeOutboxWakeBatch({
        messages: [{ type: 'outbox.wake', event_id: 'evt_1' }],
        drain,
      }),
    ).resolves.toBe(1);
    expect(drain).toHaveBeenCalledTimes(1);
  });
});
