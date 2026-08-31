import { Hono } from 'hono';
import { P0_REST_OPERATIONS, type P0RestHandlers } from '@mustbeviral/contracts';

import { supabaseJwtVerifier } from './auth/supabase-jwt';
import type { CoreBindings, CoreHonoEnvironment } from './bindings';
import { requestIdMiddleware } from './http/request-id';
import { safeError } from './http/responses';
import { healthRoute } from './routes/health';
import { createCoreObservability } from './composition/core-observability';
import { createMcpRoute } from './routes/mcp';
import {
  createStripeWebhookRoute,
  resolveStripeWebhookDependencies,
  type StripeWebhookDependencies,
} from './routes/stripe-webhook';
import { createV1Route, type V1Dependencies } from './routes/v1';

const unavailableHandlers = Object.fromEntries(
  P0_REST_OPERATIONS.map((operation) => [
    operation,
    async () => ({ status: 'provider_unavailable' as const }),
  ]),
) as unknown as P0RestHandlers;

export const defaultV1Dependencies: V1Dependencies = {
  handlers: unavailableHandlers,
  jwt: supabaseJwtVerifier,
  workspaces: { resolve: async () => null },
};

export interface CoreAppExtensions {
  readonly createStripeWebhookRecordEvent?: (
    bindings: CoreBindings,
    requestId: string,
  ) => NonNullable<StripeWebhookDependencies['recordEvent']>;
  readonly createStripeWebhookSettleEvent?: (
    bindings: CoreBindings,
    requestId: string,
  ) => NonNullable<StripeWebhookDependencies['settleEvent']>;
}

export function createCoreApp(
  v1Dependencies: V1Dependencies = defaultV1Dependencies,
  extensions: CoreAppExtensions = {},
) {
  const app = new Hono<CoreHonoEnvironment>();

  app.use('*', requestIdMiddleware);
  app.route('/health', healthRoute);
  app.route('/v1', createV1Route(v1Dependencies));
  app.route('/mcp', createMcpRoute(v1Dependencies));
  app.route(
    '/webhooks/stripe',
    createStripeWebhookRoute((bindings, requestId) =>
      resolveStripeWebhookDependencies(
        bindings,
        extensions.createStripeWebhookRecordEvent?.(bindings, requestId),
        extensions.createStripeWebhookSettleEvent?.(bindings, requestId),
      ),
    ),
  );

  app.notFound((context) =>
    context.json(safeError(context, 'NOT_FOUND', 'The requested resource was not found.'), 404),
  );

  app.onError((error, context) => {
    const requestId = context.get('requestId');
    createCoreObservability(context.env).captureException(error, requestId);
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'core.request.failed',
        request_id: requestId,
        error_name: error.name,
      }),
    );
    return context.json(
      safeError(context, 'INTERNAL_ERROR', 'The request could not be completed.', true, {
        error_id: requestId,
      }),
      500,
    );
  });

  return app;
}
