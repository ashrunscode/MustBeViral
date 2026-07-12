import { createApiError, type ApiError } from '@mustbeviral/contracts';
import type { Context } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';

export function safeError(
  context: Context<CoreHonoEnvironment>,
  code: string,
  message: string,
  retryable = false,
): ApiError {
  return createApiError({
    code,
    message,
    request_id: context.get('requestId'),
    retryable,
  });
}
