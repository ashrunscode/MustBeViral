import { ProviderError } from '../../../../packages/provider/src/errors';
import type { WebhookEventDedupPort } from '../../../../packages/provider/src/webhook';

import type { CoreBindings } from '../bindings';

type WebhookClaim = 'claimed' | 'duplicate' | 'in_progress';

function isWebhookClaim(value: unknown): value is Readonly<{ claim: WebhookClaim }> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const claim = (value as Readonly<Record<string, unknown>>).claim;
  return claim === 'claimed' || claim === 'duplicate' || claim === 'in_progress';
}

function booleanResult(
  value: unknown,
  field: 'marked' | 'released',
): value is Readonly<Record<typeof field, boolean>> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Readonly<Record<string, unknown>>)[field] === 'boolean'
  );
}

function unavailable(cause?: unknown): ProviderError {
  return new ProviderError(
    'provider_error',
    'durable fal webhook replay protection is unavailable',
    true,
    { reason: 'webhook_dedup_unavailable' },
    cause === undefined ? undefined : { cause },
  );
}

/**
 * A rejected privileged credential is a deployment fault, not a transient outage, so it must not
 * be retryable: fal would otherwise redeliver the same event indefinitely against a credential
 * that can never succeed. Verified against staging: the modern `sb_secret_*` key authorizes this
 * RPC, while a legacy service-role JWT is refused with HTTP 401 / SQLSTATE 42501.
 */
function misconfigured(): ProviderError {
  return new ProviderError(
    'provider_error',
    'durable fal webhook replay protection rejected the privileged credential',
    false,
    { reason: 'webhook_dedup_forbidden' },
  );
}

/**
 * Creates the one-operation privileged database surface used after fal signature verification.
 *
 * This intentionally does not reuse the caller-scoped Supabase executor: webhook requests have
 * no user JWT, and the privileged credential must be unable to flow into ordinary request ports.
 */
export function createFalWebhookPrivilegedClaimPort(
  bindings: CoreBindings,
  requestId: string,
  fetchImplementation?: typeof fetch,
): WebhookEventDedupPort {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const boundFetch = fetchImplementation ?? ((input, init) => fetch(input, init));

  async function rpc(
    functionName: string,
    body: Readonly<Record<string, string>>,
  ): Promise<unknown> {
    if (!baseUrl || !privilegedKey) throw unavailable();

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
      throw unavailable(cause);
    }

    if (response.status === 401 || response.status === 403) throw misconfigured();
    if (!response.ok) throw unavailable();

    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  return {
    async claim(provider, eventId) {
      const body = await rpc('claim_provider_webhook_event', {
        p_provider: provider,
        p_event_id: eventId,
        p_request_id: requestId,
      });
      if (!isWebhookClaim(body)) throw unavailable();
      return body.claim;
    },
    async markProcessed(provider, eventId) {
      const body = await rpc('mark_provider_webhook_event_processed', {
        p_provider: provider,
        p_event_id: eventId,
      });
      if (!booleanResult(body, 'marked')) throw unavailable();
      return body.marked;
    },
    async release(provider, eventId) {
      const body = await rpc('release_provider_webhook_event', {
        p_provider: provider,
        p_event_id: eventId,
      });
      if (!booleanResult(body, 'released')) throw unavailable();
      return body.released;
    },
  };
}
