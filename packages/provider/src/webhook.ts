import { createHmac, timingSafeEqual } from 'node:crypto';

import { parseJsonObject, ProviderError } from './errors';
import { toTransientDeliveryUrl, type ProviderJobStatus } from './types';

export interface FalWebhookRequest {
  readonly rawBody: Uint8Array;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface WebhookEventDedupPort {
  claim(provider: 'fal', eventId: string): Promise<'claimed' | 'duplicate'>;
}

export interface EpochClockPort {
  nowEpochSeconds(): number;
}

export interface VerifiedFalWebhook {
  readonly provider: 'fal';
  readonly eventId: string;
  readonly receivedAtEpochSeconds: number;
  readonly attempt: Readonly<{
    providerJobId: string;
    status: ProviderJobStatus;
  }>;
}

function header(
  headers: Readonly<Record<string, string | undefined>>,
  name: string,
): string | undefined {
  const direct = headers[name];
  if (direct !== undefined) return direct;
  const found = Object.entries(headers).find(([candidate]) => candidate.toLowerCase() === name);
  return found?.[1];
}

function parseWebhookStatus(
  payload: Readonly<Record<string, unknown>>,
  providerJobId: string,
): ProviderJobStatus {
  const status = payload.status;
  if (status === 'IN_QUEUE') return { state: 'queued', providerJobId };
  if (status === 'IN_PROGRESS') return { state: 'running', providerJobId };
  if (status === 'FAILED') {
    return {
      state: 'failed',
      providerJobId,
      error: new ProviderError('provider_error', 'fal webhook reported job failure', false, {
        providerJobId,
      }),
    };
  }
  if (status === 'COMPLETED') {
    const payloadValue = payload.payload;
    if (typeof payloadValue !== 'object' || payloadValue === null || Array.isArray(payloadValue)) {
      throw new ProviderError(
        'payload_invalid',
        'fal webhook completion payload is invalid',
        false,
      );
    }
    const output = payloadValue as Readonly<Record<string, unknown>>;
    const media = output.video ?? (Array.isArray(output.images) ? output.images[0] : undefined);
    if (typeof media !== 'object' || media === null || Array.isArray(media)) {
      throw new ProviderError('payload_invalid', 'fal webhook delivery payload is invalid', false);
    }
    return {
      state: 'succeeded',
      providerJobId,
      delivery: {
        kind: 'transient_delivery_url',
        transientDeliveryUrl: toTransientDeliveryUrl(
          (media as Readonly<Record<string, unknown>>).url,
        ),
      },
    };
  }
  throw new ProviderError('payload_invalid', 'fal webhook status is invalid', false);
}

export class FalWebhookVerifier {
  constructor(
    private readonly webhookSecret: string | undefined,
    private readonly dedup: WebhookEventDedupPort,
    private readonly clock: EpochClockPort,
    private readonly replayWindowSeconds = 300,
  ) {}

  async verifyAndMap(request: FalWebhookRequest): Promise<VerifiedFalWebhook> {
    const secret = this.webhookSecret;
    if (secret === undefined || secret.length === 0) {
      throw new ProviderError('auth_missing', 'fal webhook credential is not configured', false);
    }
    const signatureHeader = header(request.headers, 'x-fal-signature');
    const timestampHeader = header(request.headers, 'x-fal-timestamp');
    const eventId = header(request.headers, 'x-fal-event-id');
    if (signatureHeader === undefined || timestampHeader === undefined || eventId === undefined) {
      throw new ProviderError(
        'auth_rejected',
        'fal webhook authentication headers are incomplete',
        false,
      );
    }
    if (!/^sha256=[a-f0-9]{64}$/u.test(signatureHeader)) {
      throw new ProviderError('auth_rejected', 'fal webhook signature encoding is invalid', false);
    }
    const timestamp = Number(timestampHeader);
    const now = this.clock.nowEpochSeconds();
    if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > this.replayWindowSeconds) {
      throw new ProviderError(
        'auth_rejected',
        'fal webhook timestamp is outside the replay window',
        false,
      );
    }
    const supplied = Buffer.from(signatureHeader.slice('sha256='.length), 'hex');
    const expected = createHmac('sha256', secret).update(request.rawBody).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new ProviderError('auth_rejected', 'fal webhook signature is invalid', false);
    }
    if ((await this.dedup.claim('fal', eventId)) === 'duplicate') {
      throw new ProviderError('provider_error', 'fal webhook event was already processed', false, {
        reason: 'webhook_replayed',
        eventId,
      });
    }
    const payload = parseJsonObject(Buffer.from(request.rawBody).toString('utf8'), 'fal');
    const providerJobId = payload.request_id;
    if (typeof providerJobId !== 'string' || providerJobId.length === 0) {
      throw new ProviderError('payload_invalid', 'fal webhook request_id is invalid', false);
    }
    return {
      provider: 'fal',
      eventId,
      receivedAtEpochSeconds: now,
      attempt: {
        providerJobId,
        status: parseWebhookStatus(payload, providerJobId),
      },
    };
  }
}
