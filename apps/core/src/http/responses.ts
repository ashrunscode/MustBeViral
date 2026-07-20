import { createApiErrorEnvelope, type ApiErrorEnvelope } from '@mustbeviral/contracts';
import type { Context } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';

export function safeError(
  context: Context<CoreHonoEnvironment>,
  code: string,
  message: string,
  retryable = false,
  details?: Readonly<Record<string, unknown>>,
): ApiErrorEnvelope {
  return createApiErrorEnvelope({
    code,
    message,
    request_id: context.get('requestId'),
    retryable,
    ...(details === undefined ? {} : { details }),
  });
}

interface ApiSuccessEnvelope {
  readonly data: unknown;
  readonly meta: Readonly<{ request_id: string }>;
}

export function safeSuccess(
  context: Context<CoreHonoEnvironment>,
  data: unknown,
): ApiSuccessEnvelope {
  return {
    data,
    meta: { request_id: context.get('requestId') },
  };
}

export function jsonSafe(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString(10);
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, jsonSafe(entry)]));
  }
  return value;
}
