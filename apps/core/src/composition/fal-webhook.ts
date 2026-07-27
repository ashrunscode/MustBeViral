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

      const claim = await durable.claim(provider, eventId);
      processLocalClaims.set(key, Date.now());
      // Bound memory for long-lived isolates. PostgreSQL remains the durable authority.
      if (processLocalClaims.size > 10_000) {
        const oldest = processLocalClaims.keys().next().value;
        if (oldest !== undefined) processLocalClaims.delete(oldest);
      }
      return claim;
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
  const hmacSecret = bindings.FAL_WEBHOOK_SECRET;
  const verifier = new FalWebhookVerifier(
    {
      ...(hmacSecret === undefined ? {} : { hmacSecret }),
      fetchImplementation: (input, init) => fetch(input, init),
    },
    withProcessLocalFastPath(durableDedup),
    systemClock,
  );
  return {
    verifyAndMap: (request: FalWebhookRequest) => verifier.verifyAndMap(request),
  };
}
