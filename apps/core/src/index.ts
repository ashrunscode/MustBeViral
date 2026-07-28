import { createCoreApp, defaultV1Dependencies } from './app';
import type { CoreBindings } from './bindings';
import { runProviderScheduled } from './composition/provider-outbox';
import { supabaseRequestDependencyFactory } from './composition/supabase';

const app = createCoreApp({
  ...defaultV1Dependencies,
  requestFactory: supabaseRequestDependencyFactory,
});

function scheduled(
  _controller: ScheduledController,
  bindings: CoreBindings,
  context: ExecutionContext,
): void {
  context.waitUntil(runProviderScheduled(bindings));
}

export default Object.assign(app, { scheduled });
