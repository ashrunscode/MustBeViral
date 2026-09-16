import type { CoreBindings } from '../bindings';

export class StripeWebhookDedupUnavailableError extends Error {
  override readonly name = 'StripeWebhookDedupUnavailableError';
}

export class StripeWebhookDedupForbiddenError extends Error {
  override readonly name = 'StripeWebhookDedupForbiddenError';
}

/**
 * The dedup RPC refused this event's input, for example SQLSTATE 22023 for a blank field. Sending
 * the same event again fails the same way, so this is not an outage. Core's error log records the
 * status and code, and the message is handed to exception telemetry, so both carry only the HTTP
 * status and a well-formed SQLSTATE or PostgREST error code, never PostgREST's message or details,
 * which can echo row values.
 */
export class StripeWebhookDedupRejectedError extends Error {
  override readonly name = 'StripeWebhookDedupRejectedError';

  constructor(
    readonly status: number,
    readonly code: string | undefined,
  ) {
    super(
      `Stripe webhook dedup RPC rejected the event with HTTP ${status}${
        code === undefined ? '' : ` (${code})`
      }.`,
    );
  }
}

// PostgREST answers 400 for invalid input (SQLSTATE class 22, 23502, P0001, PGRST1xx request
// errors), 409 for unique and foreign-key violations and 422 for unprocessable requests. Every other
// failure can clear without a change to the event, so it stays Unavailable: 402 (a restricted
// project), 404 (the RPC is missing: a Worker deployed ahead of its migration, or a stale schema
// cache), 405 (SQLSTATE 25006, a read-only database, for example with a nearly full disk), 408, 425
// and 429 (timing and rate limits), and 5xx.
const PERMANENT_REJECTION_STATUSES: ReadonlySet<number> = new Set([400, 409, 422]);

const SAFE_ERROR_CODE = /^(?:[0-9A-Z]{5}|PGRST\d{3})$/u;

async function safeErrorCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as Readonly<{ code?: unknown }> | null;
    const code = body?.code;
    return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : undefined;
  } catch {
    return undefined;
  }
}

type StripeWebhookClaim = 'inserted' | 'duplicate';

function isClaimResult(value: unknown): value is Readonly<{ claim: StripeWebhookClaim }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const claim = (value as Readonly<Record<string, unknown>>).claim;
  return claim === 'inserted' || claim === 'duplicate';
}

/**
 * Privileged Stripe webhook dedup surface. Webhook requests have no user JWT.
 *
 * `record_stripe_webhook_event` has two overloads and PostgREST picks one by the named arguments
 * sent. The five-argument overload returns `{ claim }`; the four-argument overload fails at runtime
 * (boolean compared with integer), so `p_request_id` must always be sent.
 */
export function createStripeWebhookDedupPort(
  bindings: CoreBindings,
  requestId: string,
  fetchImplementation?: typeof fetch,
): Readonly<{
  recordEvent(
    input: Readonly<{
      eventId: string;
      eventType: string;
      livemode: boolean;
      payloadHash: string;
    }>,
  ): Promise<boolean>;
}> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  async function rpc(
    functionName: string,
    body: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    if (!baseUrl || !privilegedKey) {
      throw new StripeWebhookDedupUnavailableError(
        'Stripe webhook dedup is unavailable without Supabase credentials.',
      );
    }

    let response: Response;
    try {
      response = await boundFetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: privilegedKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new StripeWebhookDedupUnavailableError('Stripe webhook dedup RPC failed.', {
        cause,
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new StripeWebhookDedupForbiddenError(
        'Stripe webhook dedup rejected the privileged credential.',
      );
    }
    if (PERMANENT_REJECTION_STATUSES.has(response.status)) {
      throw new StripeWebhookDedupRejectedError(response.status, await safeErrorCode(response));
    }
    if (!response.ok) {
      throw new StripeWebhookDedupUnavailableError(
        `Stripe webhook dedup RPC returned HTTP ${response.status}.`,
      );
    }

    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw new StripeWebhookDedupUnavailableError(
        'Stripe webhook dedup RPC returned invalid JSON.',
        {
          cause,
        },
      );
    }
  }

  return Object.freeze({
    async recordEvent(input) {
      const body = await rpc('record_stripe_webhook_event', {
        p_stripe_event_id: input.eventId,
        p_event_type: input.eventType,
        p_livemode: input.livemode,
        p_payload_hash: input.payloadHash,
        p_request_id: requestId,
      });
      if (!isClaimResult(body)) {
        throw new StripeWebhookDedupUnavailableError(
          'Stripe webhook dedup RPC returned an unexpected shape.',
        );
      }
      return body.claim === 'inserted';
    },
  });
}

export function createStripeWebhookRecordEvent(
  bindings: CoreBindings,
  requestId: string,
): (
  event: Readonly<{
    eventId: string;
    eventType: string;
    livemode: boolean;
    payloadHash: string;
  }>,
) => Promise<boolean> {
  const dedup = createStripeWebhookDedupPort(bindings, requestId);
  return async (event) => dedup.recordEvent(event);
}
