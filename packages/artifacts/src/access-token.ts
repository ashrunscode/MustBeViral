/* Ambient Workers-runtime declarations, matching the package's no-DOM-lib convention. */
declare const crypto: {
  readonly subtle: {
    importKey(
      format: string,
      keyData: Uint8Array,
      algorithm: Readonly<{ name: string; hash: string }>,
      extractable: boolean,
      keyUsages: readonly string[],
    ): Promise<unknown>;
    sign(algorithm: string, key: unknown, data: Uint8Array): Promise<ArrayBuffer>;
    verify(
      algorithm: string,
      key: unknown,
      signature: Uint8Array,
      data: Uint8Array,
    ): Promise<boolean>;
  };
};

declare class TextEncoder {
  encode(value?: string): Uint8Array;
}

declare class TextDecoder {
  decode(value?: Uint8Array): string;
}

declare function btoa(data: string): string;
declare function atob(data: string): string;

/**
 * Signed capability tokens for private artifact bytes.
 *
 * Chosen over R2 presigned URLs deliberately: presigning requires a bucket-wide credential inside
 * the Worker, and a leak of that credential reads every tenant's objects for the life of the key
 * with no per-fetch authorization hook. This scheme keeps the bucket at zero external readers -
 * the only reader remains the Worker - and each token is a capability for exactly one object.
 *
 * The payload is canonical pipe-delimited text, not JSON: no field reordering, no parser
 * ambiguity, nothing to equivocate on. The object key lives INSIDE the signed payload, so
 * exact-key access is structural - a token for artifact X cannot be bent to yield object Y - and
 * the content hash, byte size and mime type are pinned so a swapped object is detectable and the
 * response cannot be sniffed into another type.
 *
 * Purposes with different verification strengths:
 * - `provider_input`: crypto + expiry only, no database round trip. fal fetches the URL when the
 *   job executes, and a storage-side database blip during that fetch must not waste the paid
 *   master that produced the input.
 * - `review_preview`: short-lived inline review in the Studio UI. Served without attachment so
 *   `<img>` / `<video>` can render. Interactive TTL; remint from GET /artifacts/:id.
 * - `customer_download`: the route additionally checks artifact availability and run state before
 *   serving, giving revocability where latency does not matter.
 */

const TOKEN_VERSION = 'v1';

export const ARTIFACT_ACCESS_PURPOSES = [
  'provider_input',
  'review_preview',
  'customer_download',
] as const;
export type ArtifactAccessPurpose = (typeof ARTIFACT_ACCESS_PURPOSES)[number];

/** fal fetches when the job executes and queue depth is not ours to control; expiring mid-queue
 * wastes a paid upstream generation. Mirrors FAL_OUTPUT_LIFECYCLE_PREFERENCE's reasoning. */
export const PROVIDER_INPUT_TTL_SECONDS = 3_600;
/** Customer downloads are interactive; a short window plus re-minting is the right trade. */
export const CUSTOMER_DOWNLOAD_TTL_SECONDS = 300;
/** Review thumbs remint when the operator reloads the receipt. */
export const REVIEW_PREVIEW_TTL_SECONDS = 300;

export interface ArtifactAccessClaims {
  readonly purpose: ArtifactAccessPurpose;
  readonly artifactId: string;
  readonly objectKey: string;
  readonly contentHash: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly expiresAtEpochSeconds: number;
}

export class ArtifactAccessSigningUnavailableError extends Error {
  override readonly name = 'ArtifactAccessSigningUnavailableError';

  constructor() {
    super('Artifact access signing is not configured');
  }
}

function requireClaimText(value: string, field: string): void {
  if (value.length === 0 || value.includes('|')) {
    throw new RangeError(`Artifact access claim ${field} is empty or contains a delimiter`);
  }
}

function canonicalPayload(claims: ArtifactAccessClaims): string {
  if (!ARTIFACT_ACCESS_PURPOSES.includes(claims.purpose)) {
    throw new RangeError('Artifact access purpose is not recognized');
  }
  requireClaimText(claims.artifactId, 'artifactId');
  requireClaimText(claims.objectKey, 'objectKey');
  requireClaimText(claims.contentHash, 'contentHash');
  requireClaimText(claims.mimeType, 'mimeType');
  if (!Number.isSafeInteger(claims.byteSize) || claims.byteSize <= 0) {
    throw new RangeError('Artifact access byteSize must be a positive integer');
  }
  if (!Number.isSafeInteger(claims.expiresAtEpochSeconds) || claims.expiresAtEpochSeconds <= 0) {
    throw new RangeError('Artifact access expiry must be a positive integer');
  }
  return [
    TOKEN_VERSION,
    claims.purpose,
    claims.artifactId,
    claims.objectKey,
    claims.contentHash,
    String(claims.byteSize),
    claims.mimeType,
    String(claims.expiresAtEpochSeconds),
  ].join('|');
}

async function importKey(secret: string): Promise<unknown> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=/gu, '');
}

function fromBase64Url(text: string): Uint8Array | null {
  try {
    const padded = text.replace(/-/gu, '+').replace(/_/gu, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function mintArtifactAccessToken(
  signingKey: string | undefined,
  claims: ArtifactAccessClaims,
): Promise<string> {
  // Fail closed: no key means no capability can exist, so nothing can be fetched.
  if (signingKey === undefined || signingKey.length < 32) {
    throw new ArtifactAccessSigningUnavailableError();
  }
  const payload = canonicalPayload(claims);
  const key = await importKey(signingKey);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return `${base64Url(new TextEncoder().encode(payload))}.${base64Url(signature)}`;
}

export type ArtifactAccessVerification =
  | Readonly<{ valid: true; claims: ArtifactAccessClaims }>
  | Readonly<{ valid: false; reason: 'malformed' | 'signature' | 'expired' | 'unconfigured' }>;

export async function verifyArtifactAccessToken(
  signingKey: string | undefined,
  token: string,
  nowEpochSeconds: number,
): Promise<ArtifactAccessVerification> {
  if (signingKey === undefined || signingKey.length < 32) {
    return { valid: false, reason: 'unconfigured' };
  }
  const [encodedPayload, encodedSignature, ...rest] = token.split('.');
  if (encodedPayload === undefined || encodedSignature === undefined || rest.length > 0) {
    return { valid: false, reason: 'malformed' };
  }
  const payloadBytes = fromBase64Url(encodedPayload);
  const signature = fromBase64Url(encodedSignature);
  if (payloadBytes === null || signature === null || signature.length !== 32) {
    return { valid: false, reason: 'malformed' };
  }
  const payload = new TextDecoder().decode(payloadBytes);
  const parts = payload.split('|');
  if (parts.length !== 8 || parts[0] !== TOKEN_VERSION) {
    return { valid: false, reason: 'malformed' };
  }
  const [, purpose, artifactId, objectKey, contentHash, byteSizeText, mimeType, expiryText] =
    parts as [string, string, string, string, string, string, string, string];
  if (!ARTIFACT_ACCESS_PURPOSES.includes(purpose as ArtifactAccessPurpose)) {
    return { valid: false, reason: 'malformed' };
  }
  const byteSize = Number(byteSizeText);
  const expiresAtEpochSeconds = Number(expiryText);
  if (
    !Number.isSafeInteger(byteSize) ||
    byteSize <= 0 ||
    !Number.isSafeInteger(expiresAtEpochSeconds) ||
    expiresAtEpochSeconds <= 0
  ) {
    return { valid: false, reason: 'malformed' };
  }
  const key = await importKey(signingKey);
  // The comparison happens inside the crypto implementation - the constant-time primitive
  // available in a Worker.
  const signatureValid = await crypto.subtle.verify(
    'HMAC',
    key,
    signature,
    new TextEncoder().encode(payload),
  );
  if (!signatureValid) return { valid: false, reason: 'signature' };
  if (nowEpochSeconds >= expiresAtEpochSeconds) return { valid: false, reason: 'expired' };
  return {
    valid: true,
    claims: {
      purpose: purpose as ArtifactAccessPurpose,
      artifactId,
      objectKey,
      contentHash,
      byteSize,
      mimeType,
      expiresAtEpochSeconds,
    },
  };
}
