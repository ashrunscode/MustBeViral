import { SOURCE_CAPTURE_MAX_ATTEMPTS } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { SupabaseDataApiError } from '../data/supabase-data-api';

export function acquiredSourceAttemptCount(job: unknown): number | null {
  if (typeof job !== 'object' || job === null || Array.isArray(job)) return null;
  const value = (job as { attempt_count?: unknown }).attempt_count;
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > SOURCE_CAPTURE_MAX_ATTEMPTS
  ) {
    return null;
  }
  return value;
}

export class SourceMachineError extends Error {
  override readonly name = 'SourceMachineError';
  constructor(
    readonly code:
      | 'SOURCE_UNSAFE'
      | 'SOURCE_UNSUPPORTED'
      | 'SOURCE_MALFORMED'
      | 'SOURCE_TOO_LARGE'
      | 'SOURCE_TIMEOUT'
      | 'SOURCE_UNREACHABLE'
      | 'SOURCE_INTERRUPTED'
      | 'SOURCE_EGRESS_UNAVAILABLE'
      | 'NOT_FOUND'
      | 'INTERNAL_ERROR',
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(code, options);
  }
}

function unavailable(cause?: unknown): SourceMachineError {
  return new SourceMachineError(
    'INTERNAL_ERROR',
    true,
    cause === undefined ? undefined : { cause },
  );
}

export class PrivilegedSourceMachinePort {
  readonly #baseUrl: string | undefined;
  readonly #privilegedKey: string | undefined;
  readonly #fetch: typeof fetch;

  constructor(bindings: CoreBindings, fetchImplementation?: typeof fetch) {
    this.#baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
    this.#privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
    this.#fetch = fetchImplementation ?? ((input, init) => fetch(input, init));
  }

  async #rpc(functionName: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.#baseUrl || !this.#privilegedKey) throw unavailable();
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: this.#privilegedKey,
          authorization: `Bearer ${this.#privilegedKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw unavailable(cause);
    }
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => ({}));
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : '';
      if (message === 'NOT_FOUND') throw new SourceMachineError('NOT_FOUND', false);
      if (
        message === 'SOURCE_UNSAFE' ||
        message === 'SOURCE_UNSUPPORTED' ||
        message === 'SOURCE_MALFORMED' ||
        message === 'SOURCE_TOO_LARGE' ||
        message === 'SOURCE_TIMEOUT' ||
        message === 'SOURCE_UNREACHABLE' ||
        message === 'SOURCE_INTERRUPTED' ||
        message === 'SOURCE_EGRESS_UNAVAILABLE'
      ) {
        throw new SourceMachineError(message, false);
      }
      throw unavailable();
    }
    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async recordCapture(
    jobId: string,
    payload: Readonly<Record<string, unknown>>,
    requestId: string,
    expectedAttemptCount: number,
  ): Promise<unknown> {
    return await this.#rpc('record_brand_source_capture', {
      p_job_id: jobId,
      p_payload: payload,
      p_request_id: requestId,
      p_expected_attempt_count: expectedAttemptCount,
    });
  }

  async failJob(
    jobId: string,
    failureCode: SourceMachineError['code'],
    requestId: string,
    expectedAttemptCount: number,
  ): Promise<unknown> {
    if (failureCode === 'NOT_FOUND' || failureCode === 'INTERNAL_ERROR') {
      return await this.#rpc('fail_brand_source_job', {
        p_job_id: jobId,
        p_failure_code: 'SOURCE_UNREACHABLE',
        p_request_id: requestId,
        p_expected_attempt_count: expectedAttemptCount,
      });
    }
    return await this.#rpc('fail_brand_source_job', {
      p_job_id: jobId,
      p_failure_code: failureCode,
      p_request_id: requestId,
      p_expected_attempt_count: expectedAttemptCount,
    });
  }
}

export function mapSourceMachineFailure(error: unknown): SourceMachineError {
  if (error instanceof SourceMachineError) return error;
  if (error instanceof SupabaseDataApiError) return new SourceMachineError('INTERNAL_ERROR', true);
  return new SourceMachineError('INTERNAL_ERROR', true);
}
