import { Hono } from 'hono';
import { P0_REST_OPERATIONS, type P0RestHandlers } from '@mustbeviral/contracts';

import { supabaseJwtVerifier } from './auth/supabase-jwt';
import type { CoreHonoEnvironment } from './bindings';
import { requestIdMiddleware } from './http/request-id';
import { safeError } from './http/responses';
import { healthRoute } from './routes/health';
import { createMcpRoute } from './routes/mcp';
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

export function createCoreApp(v1Dependencies: V1Dependencies = defaultV1Dependencies) {
  const app = new Hono<CoreHonoEnvironment>();

  app.use('*', requestIdMiddleware);
  app.route('/health', healthRoute);
  app.route('/v1', createV1Route(v1Dependencies));
  app.route('/mcp', createMcpRoute(v1Dependencies));

  app.notFound((context) =>
    context.json(safeError(context, 'NOT_FOUND', 'The requested resource was not found.'), 404),
  );

  app.onError((error, context) => {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'core.request.failed',
        request_id: context.get('requestId'),
        error_name: error.name,
      }),
    );
    return context.json(
      safeError(context, 'INTERNAL_ERROR', 'The request could not be completed.', true, {
        error_id: context.get('requestId'),
      }),
      500,
    );
  });

  return app;
}
