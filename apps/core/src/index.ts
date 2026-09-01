import { createCoreApp, defaultV1Dependencies } from './app';
import type { CoreBindings } from './bindings';
import { consumeOutboxWakeBatch, queuesEnabled } from './composition/outbox-queue';
import { runProviderScheduled } from './composition/provider-outbox';
import { createFalWebhookIngestHandler } from './composition/fal-ingest';
import { createStripeWebhookRecordEvent } from './composition/stripe-webhook-dedup';
import { createStripeWebhookSettlementHandler } from './composition/stripe-webhook-settlement';
import { supabaseRequestDependencyFactory } from './composition/supabase';

const app = createCoreApp(
  {
    ...defaultV1Dependencies,
    requestFactory: supabaseRequestDependencyFactory,
    falWebhookIngest: (event, bindings, requestId) =>
      createFalWebhookIngestHandler(bindings, requestId)(event),
  },
  {
    createStripeWebhookRecordEvent: (bindings, requestId) =>
      createStripeWebhookRecordEvent(bindings, requestId),
    createStripeWebhookSettleEvent: (bindings) => {
      const settle = createStripeWebhookSettlementHandler(bindings);
      return async (input) => settle(input);
    },
  },
);

function scheduled(
  _controller: ScheduledController,
  bindings: CoreBindings,
  context: ExecutionContext,
): void {
  context.waitUntil(runProviderScheduled(bindings));
}

async function queue(batch: MessageBatch<unknown>, bindings: CoreBindings): Promise<void> {
  if (!queuesEnabled(bindings)) return;
  await consumeOutboxWakeBatch({
    messages: batch.messages.map((message) => message.body),
    drain: async () => {
      await runProviderScheduled(bindings);
    },
  });
}

export default Object.assign(app, { scheduled, queue });
