import type { MiddlewareHandler } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';

const safeRequestId = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

export function normalizeRequestId(value: string | undefined): string {
  return value && safeRequestId.test(value) ? value : crypto.randomUUID();
}

export const requestIdMiddleware: MiddlewareHandler<CoreHonoEnvironment> = async (
  context,
  next,
) => {
  const requestId = normalizeRequestId(context.req.header('x-request-id'));
  context.set('requestId', requestId);
  await next();
  context.header('x-request-id', requestId);
  if (!context.res.headers.has('cache-control')) {
    context.header('cache-control', 'no-store');
  }
};
