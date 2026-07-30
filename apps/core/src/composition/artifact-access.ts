import {
  CUSTOMER_DOWNLOAD_TTL_SECONDS,
  PROVIDER_INPUT_TTL_SECONDS,
  mintArtifactAccessToken,
  verifyArtifactAccessToken,
  type ArtifactAccessClaims,
  type ArtifactAccessPurpose,
} from '../../../../packages/artifacts/src/index';

import type { CoreBindings } from '../bindings';

/**
 * Worker-side composition for signed artifact access.
 *
 * The bucket keeps zero external readers: the only reader is this Worker, and a token is a
 * capability for exactly one object with its hash, size and mime pinned inside the signed payload.
 * fal's fetcher sends no headers, which is why the capability rides in the URL.
 */

export interface MintArtifactAccessUrlInput {
  readonly purpose: ArtifactAccessPurpose;
  readonly artifactId: string;
  readonly objectKey: string;
  readonly contentHash: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly nowEpochSeconds: number;
}

/**
 * The public origin is derived from FAL_WEBHOOK_URL, which already proves fal can reach this host.
 * A dedicated PUBLIC_BASE_URL binding replaces this once a custom domain lands; deriving keeps the
 * staging path working without another operator input.
 */
export function publicOriginFrom(bindings: Pick<CoreBindings, 'FAL_WEBHOOK_URL'>): string | null {
  if (bindings.FAL_WEBHOOK_URL === undefined) return null;
  try {
    return new URL(bindings.FAL_WEBHOOK_URL).origin;
  } catch {
    return null;
  }
}

export async function mintArtifactAccessUrl(
  bindings: Pick<CoreBindings, 'ARTIFACT_ACCESS_SIGNING_KEY' | 'FAL_WEBHOOK_URL'>,
  input: MintArtifactAccessUrlInput,
): Promise<string> {
  const origin = publicOriginFrom(bindings);
  if (origin === null) {
    throw new Error('No public origin is available to mint an artifact access URL');
  }
  const ttl =
    input.purpose === 'provider_input' ? PROVIDER_INPUT_TTL_SECONDS : CUSTOMER_DOWNLOAD_TTL_SECONDS;
  const token = await mintArtifactAccessToken(bindings.ARTIFACT_ACCESS_SIGNING_KEY, {
    purpose: input.purpose,
    artifactId: input.artifactId,
    objectKey: input.objectKey,
    contentHash: input.contentHash,
    byteSize: input.byteSize,
    mimeType: input.mimeType,
    expiresAtEpochSeconds: input.nowEpochSeconds + ttl,
  });
  return `${origin}/v1/artifacts/${encodeURIComponent(input.artifactId)}/content?token=${encodeURIComponent(token)}`;
}

export type ArtifactContentResult =
  | Readonly<{ status: 200; body: ReadableStream; claims: ArtifactAccessClaims }>
  | Readonly<{ status: 401 | 404 | 410 }>;

/**
 * Serves the bytes for a valid capability. Verification is crypto + expiry only for
 * provider_input - a database blip during fal's fetch must not waste the paid master that
 * produced the input. customer_download additionally re-checks the artifact row before serving;
 * that check lives with the caller because it needs the privileged executor.
 */
export async function serveArtifactContent(
  bindings: Pick<CoreBindings, 'ARTIFACT_ACCESS_SIGNING_KEY' | 'MEDIA_BUCKET'>,
  artifactIdFromPath: string,
  token: string,
  nowEpochSeconds: number,
): Promise<ArtifactContentResult> {
  const verification = await verifyArtifactAccessToken(
    bindings.ARTIFACT_ACCESS_SIGNING_KEY,
    token,
    nowEpochSeconds,
  );
  if (!verification.valid) {
    // Expiry gets its own status so a caller can distinguish "mint me a new one" from "invalid".
    return verification.reason === 'expired' ? { status: 410 } : { status: 401 };
  }
  // The path id must match the signed id: a token is not transferable between artifact URLs.
  if (verification.claims.artifactId !== artifactIdFromPath) return { status: 401 };
  const object = await bindings.MEDIA_BUCKET.get(verification.claims.objectKey);
  if (object === null) return { status: 404 };
  return { status: 200, body: object.body, claims: verification.claims };
}

/** Response headers for served content. Content-Type comes from the signed claims, never from R2
 * metadata, so a swapped object cannot change how the response is interpreted. */
export function artifactContentHeaders(
  claims: ArtifactAccessClaims,
): Readonly<Record<string, string>> {
  return {
    'content-type': claims.mimeType,
    'content-length': String(claims.byteSize),
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...(claims.purpose === 'customer_download' ? { 'content-disposition': 'attachment' } : {}),
  };
}
