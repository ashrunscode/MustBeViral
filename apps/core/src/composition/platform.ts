import {
  PLATFORM_ERRORS,
  PLATFORM_OPERATIONS,
  type PlatformErrorCode,
  type PlatformPort,
} from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { SupabaseDataApiError, SupabaseDataApiExecutor } from '../data/supabase-data-api';

export function createPlatformPort(
  bindings: Pick<
    CoreBindings,
    'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'
  >,
  callerJwt: string,
  fetchImplementation?: typeof fetch,
): PlatformPort {
  const baseUrl = bindings.SUPABASE_URL;
  const publishableKey = bindings.SUPABASE_PUBLISHABLE_KEY;
  if (baseUrl === undefined || publishableKey === undefined || callerJwt.length === 0) {
    throw new Error('User-scoped platform access is not configured');
  }
  const executor = new SupabaseDataApiExecutor({
    baseUrl,
    publishableKey,
    callerJwt,
    ...(fetchImplementation === undefined ? {} : { fetch: fetchImplementation }),
  });
  return {
    async execute({ operation, input, context, idempotencyKey }) {
      const mutation = PLATFORM_OPERATIONS[operation].method !== 'GET';
      try {
        const data = await executor.request({
          method: 'POST',
          path: mutation ? 'rpc/platform_command' : 'rpc/platform_query',
          body: {
            p_operation: operation,
            p_input: input,
            ...(mutation
              ? { p_idempotency_key: idempotencyKey, p_request_id: context.request_id }
              : {}),
          },
        });
        return { status: 'ok', data };
      } catch (error) {
        if (error instanceof SupabaseDataApiError) {
          const code = error.databaseMessage;
          if (code !== undefined && Object.hasOwn(PLATFORM_ERRORS, code)) {
            return { status: 'error', code: code as PlatformErrorCode };
          }
          if (error.kind === 'forbidden') return { status: 'error', code: 'FORBIDDEN' };
          if (error.kind === 'not_found') return { status: 'error', code: 'NOT_FOUND' };
          if (error.kind === 'validation') return { status: 'error', code: 'VALIDATION_FAILED' };
        }
        return { status: 'error', code: 'INTERNAL_ERROR' };
      }
    },
  };
}
