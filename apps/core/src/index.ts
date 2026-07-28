import { createCoreApp, defaultV1Dependencies } from './app';
import type { CoreBindings } from './bindings';
import { runProviderScheduled } from './composition/provider-outbox';
import { createFalWebhookIngestHandler } from './composition/fal-ingest';
import { supabaseRequestDependencyFactory } from './composition/supabase';

const app = createCoreApp({
  ...defaultV1Dependencies,
  requestFactory: supabaseRequestDependencyFactory,
  falWebhookIngest: (event, bindings, requestId) =>
    createFalWebhookIngestHandler(bindings, requestId)(event),
});

function scheduled(
  _controller: ScheduledController,
  bindings: CoreBindings,
  context: ExecutionContext,
): void {
  context.waitUntil(runProviderScheduled(bindings));
}

export default Object.assign(app, { scheduled });
