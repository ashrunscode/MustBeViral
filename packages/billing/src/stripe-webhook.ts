export interface StripeWebhookVerificationInput {
  readonly rawBody: string;
  readonly signatureHeader: string;
  readonly webhookSecret: string;
  readonly toleranceSeconds?: number;
  readonly nowSeconds?: number;
}

export interface VerifiedStripeWebhook {
  readonly eventId: string;
  readonly eventType: string;
  readonly livemode: boolean;
  readonly payload: unknown;
}

export class StripeWebhookVerificationError extends Error {
  override readonly name = 'StripeWebhookVerificationError';
}

function parseSignatureHeader(
  header: string,
): Readonly<{ timestamp: number; signatures: readonly string[] }> {
  const parts = header.split(',');
  let timestamp = 0;
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't' && value !== undefined) timestamp = Number(value);
    if (key === 'v1' && value !== undefined) signatures.push(value);
  }
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new StripeWebhookVerificationError('Stripe signature header is malformed.');
  }
  return { timestamp, signatures };
}

function timingSafeEqualHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const subtle = crypto.subtle;
  if (subtle === undefined) {
    throw new StripeWebhookVerificationError('Web Crypto is unavailable in this runtime.');
  }
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyStripeWebhook(
  input: StripeWebhookVerificationInput,
): Promise<VerifiedStripeWebhook> {
  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const { timestamp, signatures } = parseSignatureHeader(input.signatureHeader);
  if (Math.abs(now - timestamp) > tolerance) {
    throw new StripeWebhookVerificationError(
      'Stripe webhook timestamp is outside the tolerance window.',
    );
  }

  const signedPayload = `${timestamp}.${input.rawBody}`;
  const expected = await hmacSha256Hex(input.webhookSecret, signedPayload);
  const matched = signatures.some((signature) => timingSafeEqualHex(signature, expected));
  if (!matched) {
    throw new StripeWebhookVerificationError('Stripe webhook signature verification failed.');
  }

  const payload = JSON.parse(input.rawBody) as {
    id?: string;
    type?: string;
    livemode?: boolean;
  };
  if (typeof payload.id !== 'string' || typeof payload.type !== 'string') {
    throw new StripeWebhookVerificationError('Stripe webhook payload is missing id or type.');
  }

  return Object.freeze({
    eventId: payload.id,
    eventType: payload.type,
    livemode: payload.livemode === true,
    payload,
  });
}

export const P1A_FULLY_LANDED_MARGIN_CAP_MICROS = 1_820_000n;

export function assertP1aPackMarginGuardrail(
  landedCostMicros: bigint,
  catalogChargeMicros: bigint,
): void {
  if (landedCostMicros > P1A_FULLY_LANDED_MARGIN_CAP_MICROS) {
    throw new RangeError(
      `Fully landed cost ${landedCostMicros.toString()} exceeds the P1a $1.82 guardrail.`,
    );
  }
  if (catalogChargeMicros <= landedCostMicros) {
    throw new RangeError('Catalog charge must exceed fully landed cost to preserve margin.');
  }
}
