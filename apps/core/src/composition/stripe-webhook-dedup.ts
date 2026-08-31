import type { CoreBindings } from '../bindings';

export class StripeWebhookDedupUnavailableError extends Error {
  override readonly name = 'StripeWebhookDedupUnavailableError';
}

export class StripeWebhookDedupForbiddenError extends Error {
  override readonly name = 'StripeWebhookDedupForbiddenError';
}

function isInsertResult(value: unknown): value is Readonly<{ inserted: boolean }> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Readonly<Record<string, unknown>>).inserted === 'boolean'
  );
}

/**
 * Privileged Stripe webhook dedup surface. Webhook requests have no user JWT.
 */
export function createStripeWebhookDedupPort(
  bindings: CoreBindings,
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
      });
      if (!isInsertResult(body)) {
        throw new StripeWebhookDedupUnavailableError(
          'Stripe webhook dedup RPC returned an unexpected shape.',
        );
      }
      return body.inserted;
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
  void requestId;
  const dedup = createStripeWebhookDedupPort(bindings);
  return async (event) => dedup.recordEvent(event);
}
