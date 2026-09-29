export const OUTBOX_WAKE_MESSAGE_TYPE = 'outbox.wake' as const;

export interface OutboxWakeMessage {
  readonly type: typeof OUTBOX_WAKE_MESSAGE_TYPE;
  readonly event_id: string;
}

export interface QueueSendPort {
  send(message: OutboxWakeMessage): Promise<unknown>;
}

const FORBIDDEN_PAYLOAD_KEYS = [
  'ledger',
  'reservation_id',
  'wallet_balance_micros',
  'revision_id',
  'expected_revision_id',
  'canvas_head',
  'membership',
] as const;

export function queuesEnabled(bindings: Readonly<{ QUEUES_ENABLED?: string }>): boolean {
  return bindings.QUEUES_ENABLED === 'true';
}

export function parseOutboxWakeMessage(value: unknown): OutboxWakeMessage {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('outbox wake message must be an object');
  }
  const record = value as Readonly<Record<string, unknown>>;
  for (const key of FORBIDDEN_PAYLOAD_KEYS) {
    if (key in record) {
      throw new Error(`outbox wake message must not carry ${key}`);
    }
  }
  if (record.type !== OUTBOX_WAKE_MESSAGE_TYPE) {
    throw new Error('outbox wake message type is invalid');
  }
  if (typeof record.event_id !== 'string' || record.event_id.length === 0) {
    throw new Error('outbox wake message event_id is required');
  }
  return { type: OUTBOX_WAKE_MESSAGE_TYPE, event_id: record.event_id };
}

export async function enqueueOutboxWake(
  queue: QueueSendPort | undefined,
  enabled: boolean,
  eventId: string,
): Promise<'sent' | 'skipped'> {
  if (!enabled || queue === undefined) return 'skipped';
  const message = parseOutboxWakeMessage({
    type: OUTBOX_WAKE_MESSAGE_TYPE,
    event_id: eventId,
  });
  await queue.send(message);
  return 'sent';
}

export async function consumeOutboxWakeBatch(input: {
  readonly messages: readonly unknown[];
  readonly drain: () => Promise<unknown>;
}): Promise<number> {
  const eventIds = input.messages.map((message) => parseOutboxWakeMessage(message).event_id);
  if (eventIds.length === 0) return 0;
  await input.drain();
  return eventIds.length;
}
