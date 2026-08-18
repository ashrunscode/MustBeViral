import { parseJsonObject, ProviderError } from './errors';
import { toTransientDeliveryUrl, type ProviderJobStatus } from './types';

export const FAL_JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json';
const DEFAULT_REPLAY_WINDOW_SECONDS = 300;
const DEFAULT_JWKS_CACHE_MS = 24 * 60 * 60 * 1000;
const boundGlobalFetch: typeof fetch = (input, init) => fetch(input, init);

export interface FalWebhookRequest {
  readonly rawBody: Uint8Array;
  readonly headers: Readonly<Record<string, string | undefined>>;
}

export interface WebhookEventDedupPort {
  claim(provider: 'fal', eventId: string): Promise<'claimed' | 'duplicate' | 'in_progress'>;
  markProcessed(provider: 'fal', eventId: string): Promise<boolean>;
  release(provider: 'fal', eventId: string): Promise<boolean>;
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

export interface FalJwksKey {
  readonly x?: string;
  readonly kty?: string;
  readonly crv?: string;
}

export interface FalJwksDocument {
  readonly keys?: readonly FalJwksKey[];
}

export interface FalWebhookVerifierOptions {
  /** Legacy HMAC material used only when fal sends `x-fal-signature: sha256=...` fixtures. */
  readonly hmacSecret?: string;
  readonly jwksUrl?: string;
  readonly jwksCacheMs?: number;
  readonly fetchImplementation?: typeof fetch;
  readonly replayWindowSeconds?: number;
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

const PROVIDER_ERROR_CODE = /^[A-Za-z0-9_.-]{1,80}$/u;
const HTTP_WRAPPER = /^Invalid status code: (\d{3})$/u;
const MACHINE_KEYS = ['error_type', 'type', 'code', 'detail', 'error'] as const;

function machineErrorCode(value: unknown): string | undefined {
  if (typeof value === 'string' && PROVIDER_ERROR_CODE.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = machineErrorCode(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    // Walk only machine fields. `msg`, `input`, and `url` can carry prompts or signed URLs.
    for (const key of MACHINE_KEYS) {
      const found = machineErrorCode(record[key]);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function mappedHttpWrapper(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = HTTP_WRAPPER.exec(value);
  return match ? `http_${match[1]}` : undefined;
}

export function falWebhookFailureCode(payload: Readonly<Record<string, unknown>>): string {
  const nested =
    typeof payload.payload === 'object' &&
    payload.payload !== null &&
    !Array.isArray(payload.payload)
      ? (payload.payload as Readonly<Record<string, unknown>>)
      : undefined;
  return (
    machineErrorCode(payload.error) ??
    machineErrorCode(payload.error_type) ??
    machineErrorCode(payload.detail) ??
    machineErrorCode(nested?.error) ??
    machineErrorCode(nested?.error_type) ??
    machineErrorCode(nested?.detail) ??
    mappedHttpWrapper(payload.error) ??
    'fal_webhook_failed'
  );
}

export function providerErrorCodeFromFailure(error: ProviderError): string {
  const detailed = machineErrorCode(error.details.provider_error_code);
  return detailed ?? 'fal_webhook_failed';
}

function parseWebhookStatus(
  payload: Readonly<Record<string, unknown>>,
  providerJobId: string,
): ProviderJobStatus {
  const status = payload.status;
  if (status === 'IN_QUEUE') return { state: 'queued', providerJobId };
  if (status === 'IN_PROGRESS') return { state: 'running', providerJobId };
  if (status === 'FAILED' || status === 'ERROR') {
    const providerErrorCode = falWebhookFailureCode(payload);
    return {
      state: 'failed',
      providerJobId,
      error: new ProviderError('provider_error', 'fal webhook reported job failure', false, {
        providerJobId,
        provider_error_code: providerErrorCode,
      }),
    };
  }
  if (status === 'COMPLETED' || status === 'OK') {
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

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeHex(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function sha256Hex(body: Uint8Array): Promise<string> {
  return encodeHex(new Uint8Array(await crypto.subtle.digest('SHA-256', ownedBuffer(body))));
}

async function hmacSha256(secret: string, body: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, ownedBuffer(body)));
}

let jwksCache: { readonly fetchedAtMs: number; readonly keys: readonly FalJwksKey[] } | undefined;

export function clearFalJwksCacheForTests(): void {
  jwksCache = undefined;
}

async function loadFalJwks(
  options: Readonly<{
    jwksUrl: string;
    jwksCacheMs: number;
    fetchImplementation: typeof fetch;
    nowMs: number;
  }>,
): Promise<readonly FalJwksKey[]> {
  if (jwksCache && options.nowMs - jwksCache.fetchedAtMs <= options.jwksCacheMs) {
    return jwksCache.keys;
  }
  const response = await options.fetchImplementation(options.jwksUrl, {
    method: 'GET',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) {
    throw new ProviderError('provider_error', 'fal JWKS could not be fetched', true, {
      status: response.status,
    });
  }
  const document = (await response.json()) as FalJwksDocument;
  const keys = Array.isArray(document.keys) ? document.keys : [];
  if (keys.length === 0) {
    throw new ProviderError('provider_error', 'fal JWKS contained no keys', true);
  }
  jwksCache = { fetchedAtMs: options.nowMs, keys };
  return keys;
}

async function verifyEd25519(
  publicKeyBytes: Uint8Array,
  signatureBytes: Uint8Array,
  messageBytes: Uint8Array,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      ownedBuffer(publicKeyBytes),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'Ed25519',
      key,
      ownedBuffer(signatureBytes),
      ownedBuffer(messageBytes),
    );
  } catch {
    try {
      // Legacy Cloudflare NODE-ED25519 path for environments that still require it.
      const key = await crypto.subtle.importKey(
        'raw',
        ownedBuffer(publicKeyBytes),
        { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' } as never,
        false,
        ['verify'],
      );
      return crypto.subtle.verify(
        { name: 'NODE-ED25519' } as never,
        key,
        ownedBuffer(signatureBytes),
        ownedBuffer(messageBytes),
      );
    } catch {
      return false;
    }
  }
}

export class FalWebhookVerifier {
  private readonly hmacSecret: string | undefined;
  private readonly jwksUrl: string;
  private readonly jwksCacheMs: number;
  private readonly fetchImplementation: typeof fetch;
  private readonly replayWindowSeconds: number;

  constructor(
    hmacSecretOrOptions: string | undefined | FalWebhookVerifierOptions,
    private readonly dedup: WebhookEventDedupPort,
    private readonly clock: EpochClockPort,
    replayWindowSeconds = DEFAULT_REPLAY_WINDOW_SECONDS,
  ) {
    if (
      typeof hmacSecretOrOptions === 'object' &&
      hmacSecretOrOptions !== null &&
      !Array.isArray(hmacSecretOrOptions)
    ) {
      this.hmacSecret = hmacSecretOrOptions.hmacSecret;
      this.jwksUrl = hmacSecretOrOptions.jwksUrl ?? FAL_JWKS_URL;
      this.jwksCacheMs = hmacSecretOrOptions.jwksCacheMs ?? DEFAULT_JWKS_CACHE_MS;
      const configuredFetch = hmacSecretOrOptions.fetchImplementation;
      this.fetchImplementation =
        configuredFetch === undefined
          ? boundGlobalFetch
          : (input, init) => configuredFetch(input, init);
      this.replayWindowSeconds =
        hmacSecretOrOptions.replayWindowSeconds ?? DEFAULT_REPLAY_WINDOW_SECONDS;
    } else {
      this.hmacSecret = typeof hmacSecretOrOptions === 'string' ? hmacSecretOrOptions : undefined;
      this.jwksUrl = FAL_JWKS_URL;
      this.jwksCacheMs = DEFAULT_JWKS_CACHE_MS;
      this.fetchImplementation = boundGlobalFetch;
      this.replayWindowSeconds = replayWindowSeconds;
    }
  }

  async verifyAndMap(request: FalWebhookRequest): Promise<VerifiedFalWebhook> {
    const jwksRequestId = header(request.headers, 'x-fal-webhook-request-id');
    const jwksUserId = header(request.headers, 'x-fal-webhook-user-id');
    const jwksTimestamp = header(request.headers, 'x-fal-webhook-timestamp');
    const jwksSignature = header(request.headers, 'x-fal-webhook-signature');
    if (
      jwksRequestId !== undefined ||
      jwksUserId !== undefined ||
      jwksTimestamp !== undefined ||
      jwksSignature !== undefined
    ) {
      return this.verifyJwksAndMap(request, {
        requestId: jwksRequestId,
        userId: jwksUserId,
        timestampHeader: jwksTimestamp,
        signatureHex: jwksSignature,
      });
    }
    return this.verifyLegacyHmacAndMap(request);
  }

  private async verifyJwksAndMap(
    request: FalWebhookRequest,
    material: Readonly<{
      requestId: string | undefined;
      userId: string | undefined;
      timestampHeader: string | undefined;
      signatureHex: string | undefined;
    }>,
  ): Promise<VerifiedFalWebhook> {
    const { requestId, userId, timestampHeader, signatureHex } = material;
    if (
      requestId === undefined ||
      userId === undefined ||
      timestampHeader === undefined ||
      signatureHex === undefined
    ) {
      throw new ProviderError(
        'auth_rejected',
        'fal webhook authentication headers are incomplete',
        false,
      );
    }
    if (!/^[0-9a-fA-F]+$/u.test(signatureHex) || signatureHex.length % 2 !== 0) {
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
    const message = [requestId, userId, timestampHeader, await sha256Hex(request.rawBody)].join(
      '\n',
    );
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = decodeHex(signatureHex);
    const keys = await loadFalJwks({
      jwksUrl: this.jwksUrl,
      jwksCacheMs: this.jwksCacheMs,
      fetchImplementation: this.fetchImplementation,
      nowMs: now * 1000,
    });
    let verified = false;
    for (const key of keys) {
      if (typeof key.x !== 'string' || key.x.length === 0) continue;
      const publicKeyBytes = decodeBase64Url(key.x);
      if (await verifyEd25519(publicKeyBytes, signatureBytes, messageBytes)) {
        verified = true;
        break;
      }
    }
    if (!verified) {
      throw new ProviderError('auth_rejected', 'fal webhook signature is invalid', false);
    }
    return this.mapVerifiedEvent(request.rawBody, requestId, now);
  }

  private async verifyLegacyHmacAndMap(request: FalWebhookRequest): Promise<VerifiedFalWebhook> {
    const secret = this.hmacSecret;
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
    const supplied = decodeHex(signatureHeader.slice('sha256='.length));
    const expected = await hmacSha256(secret, request.rawBody);
    if (!constantTimeEqual(supplied, expected)) {
      throw new ProviderError('auth_rejected', 'fal webhook signature is invalid', false);
    }
    return this.mapVerifiedEvent(request.rawBody, eventId, now);
  }

  private async mapVerifiedEvent(
    rawBody: Uint8Array,
    eventId: string,
    now: number,
  ): Promise<VerifiedFalWebhook> {
    const claim = await this.dedup.claim('fal', eventId);
    if (claim === 'duplicate') {
      throw new ProviderError('provider_error', 'fal webhook event was already processed', false, {
        reason: 'webhook_replayed',
        eventId,
      });
    }
    if (claim === 'in_progress') {
      throw new ProviderError(
        'provider_error',
        'fal webhook event is already being processed',
        true,
        {
          reason: 'webhook_in_progress',
          eventId,
        },
      );
    }
    const payload = parseJsonObject(new TextDecoder().decode(rawBody), 'fal');
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
