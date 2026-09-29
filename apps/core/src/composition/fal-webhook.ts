import {
  FalWebhookVerifier,
  type EpochClockPort,
  type FalWebhookRequest,
  type WebhookEventDedupPort,
} from '../../../../packages/provider/src/webhook';

import type { CoreBindings } from '../bindings';
import type { FalWebhookVerifierPort } from '../routes/v1';
import { createFalWebhookPrivilegedClaimPort } from './fal-webhook-dedup';

const processLocalClaims = new Map<string, number>();

function withProcessLocalFastPath(durable: WebhookEventDedupPort): WebhookEventDedupPort {
  return {
    async claim(provider, eventId) {
      const key = `${provider}:${eventId}`;
      if (processLocalClaims.has(key)) return 'duplicate';

      return durable.claim(provider, eventId);
    },
    async markProcessed(provider, eventId) {
      const marked = await durable.markProcessed(provider, eventId);
      if (!marked) return false;

      const key = `${provider}:${eventId}`;
      processLocalClaims.set(key, Date.now());
      // Bound memory for long-lived isolates. PostgreSQL remains the durable authority.
      if (processLocalClaims.size > 10_000) {
        const oldest = processLocalClaims.keys().next().value;
        if (oldest !== undefined) processLocalClaims.delete(oldest);
      }
      return true;
    },
    async release(provider, eventId) {
      const released = await durable.release(provider, eventId);
      if (released) processLocalClaims.delete(`${provider}:${eventId}`);
      return released;
    },
  };
}

const systemClock: EpochClockPort = {
  nowEpochSeconds: () => Math.floor(Date.now() / 1000),
};

export function createFalWebhookVerifierPort(
  bindings: CoreBindings,
  requestId: string,
): FalWebhookVerifierPort {
  const durableDedup = createFalWebhookPrivilegedClaimPort(bindings, requestId);
  const lifecycleDedup = withProcessLocalFastPath(durableDedup);
  const hmacSecret = bindings.FAL_WEBHOOK_SECRET;
  const verifier = new FalWebhookVerifier(
    {
      ...(hmacSecret === undefined ? {} : { hmacSecret }),
      fetchImplementation: (input, init) => fetch(input, init),
    },
    lifecycleDedup,
    systemClock,
  );
  return {
    verifyAndMap: (request: FalWebhookRequest) => verifier.verifyAndMap(request),
    markProcessed: (provider, eventId) => lifecycleDedup.markProcessed(provider, eventId),
    release: (provider, eventId) => lifecycleDedup.release(provider, eventId),
  };
}
