import type { P1bHandlerResult } from '@mustbeviral/contracts';

export function p1bResultSemantics(result: P1bHandlerResult): Readonly<
  | { ok: true; data: unknown }
  | {
      ok: false;
      error: Readonly<{
        code: string;
        message: string;
        retryable: boolean;
        httpStatus: number;
        details?: Readonly<Record<string, unknown>>;
      }>;
    }
> {
  if (result.status === 'ok') return { ok: true, data: result.data };
  switch (result.status) {
    case 'forbidden':
      return {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Access to this resource is forbidden.',
          retryable: false,
          httpStatus: 403,
        },
      };
    case 'not_found':
      return {
        ok: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found.',
          retryable: false,
          httpStatus: 404,
        },
      };
    case 'conflict':
      return {
        ok: false,
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'The idempotency key was reused with different input.',
          retryable: false,
          httpStatus: 409,
        },
      };
    case 'unauthenticated':
      return {
        ok: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Client credentials are invalid.',
          retryable: false,
          httpStatus: 401,
        },
      };
    default:
      return {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The request is invalid.',
          retryable: false,
          httpStatus: 400,
        },
      };
  }
}
