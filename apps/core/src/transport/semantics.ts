import type { P0HandlerResult } from '@mustbeviral/contracts';

export interface SafeSemanticError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly httpStatus: 400 | 402 | 403 | 404 | 409 | 422 | 429 | 503;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type P0SemanticResult =
  | Readonly<{ ok: true; data: Readonly<Record<string, unknown>> }>
  | Readonly<{ ok: false; error: SafeSemanticError }>;

function successData(result: P0HandlerResult): Readonly<Record<string, unknown>> {
  return Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'status'));
}

function conflictCode(result: P0HandlerResult): string {
  if (result.reason === 'idempotency') return 'IDEMPOTENCY_CONFLICT';
  if (result.reason === 'quote_stale') return 'QUOTE_STALE';
  if (result.reason === 'run_state') return 'RUN_NOT_CANCELABLE';
  return 'REVISION_CONFLICT';
}

export function p0ResultSemantics(result: P0HandlerResult): P0SemanticResult {
  if (result.status === 'ok') return { ok: true, data: successData(result) };
  if (result.status === 'forbidden') {
    return {
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Access to this resource is forbidden.',
        retryable: false,
        httpStatus: 403,
      },
    };
  }
  if (result.status === 'not_found') {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
        retryable: false,
        httpStatus: 404,
      },
    };
  }
  if (result.status === 'conflict') {
    return {
      ok: false,
      error: {
        code: conflictCode(result),
        message: 'The requested state change conflicts with current state.',
        retryable: false,
        httpStatus: 409,
      },
    };
  }
  if (result.status === 'expired_quote') {
    return {
      ok: false,
      error: {
        code: 'QUOTE_EXPIRED',
        message: 'The referenced quote has expired.',
        retryable: false,
        httpStatus: 409,
      },
    };
  }
  if (result.status === 'cap_exceeded') {
    const balance = result.tier === 'available_balance';
    return {
      ok: false,
      error: {
        code: balance ? 'INSUFFICIENT_BALANCE' : 'BUDGET_EXCEEDED',
        message: balance
          ? 'Available balance is insufficient.'
          : 'The configured budget cap was exceeded.',
        retryable: false,
        httpStatus: balance ? 402 : 409,
      },
    };
  }
  if (result.status === 'graph_invalid') {
    return {
      ok: false,
      error: {
        code: 'GRAPH_INVALID',
        message: 'The canvas graph is invalid.',
        retryable: false,
        httpStatus: 422,
      },
    };
  }
  if (result.status === 'rate_limited') {
    return {
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'The request rate limit was exceeded.',
        retryable: true,
        httpStatus: 429,
        ...(result.retry_after_seconds === undefined
          ? {}
          : { details: { retry_after_seconds: result.retry_after_seconds } }),
      },
    };
  }
  if (result.status === 'provider_ambiguous') {
    return {
      ok: false,
      error: {
        code: 'PROVIDER_AMBIGUOUS',
        message: 'Provider acceptance is ambiguous and requires reconciliation.',
        retryable: false,
        httpStatus: 409,
        ...(result.reconcile_state === undefined
          ? {}
          : { details: { reconcile_state: result.reconcile_state } }),
      },
    };
  }
  return {
    ok: false,
    error: {
      code: 'MODEL_UNAVAILABLE',
      message: 'Provider-backed execution is not enabled.',
      retryable: false,
      httpStatus: 503,
    },
  };
}
