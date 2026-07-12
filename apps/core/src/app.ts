import { Hono } from 'hono';

import type { CoreHonoEnvironment } from './bindings';
import { requestIdMiddleware } from './http/request-id';
import { safeError } from './http/responses';
import { healthRoute } from './routes/health';

export function createCoreApp() {
  const app = new Hono<CoreHonoEnvironment>();

  app.use('*', requestIdMiddleware);
  app.route('/health', healthRoute);

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
      safeError(context, 'INTERNAL_ERROR', 'The request could not be completed.', true),
      500,
    );
  });

  return app;
}
