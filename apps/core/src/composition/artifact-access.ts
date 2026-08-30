import {
  CUSTOMER_DOWNLOAD_TTL_SECONDS,
  CUSTOMER_UPLOAD_TTL_SECONDS,
  PROVIDER_INPUT_TTL_SECONDS,
  REVIEW_PREVIEW_TTL_SECONDS,
  mintArtifactAccessToken,
  sha256Hex,
  verifyArtifactAccessToken,
  verifyProviderArtifactBytes,
  type ArtifactAccessClaims,
  type ArtifactAccessPurpose,
} from '../../../../packages/artifacts/src/index';

import type { CoreBindings } from '../bindings';
import { SupabaseDataApiExecutor } from '../data/supabase-data-api';

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
    input.purpose === 'provider_input'
      ? PROVIDER_INPUT_TTL_SECONDS
      : input.purpose === 'review_preview'
        ? REVIEW_PREVIEW_TTL_SECONDS
        : input.purpose === 'customer_upload'
          ? CUSTOMER_UPLOAD_TTL_SECONDS
          : CUSTOMER_DOWNLOAD_TTL_SECONDS;
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
  | Readonly<{
      status: 200;
      body: ReadableStream;
      claims: ArtifactAccessClaims;
      verifiedDownloadRunId: string | null;
    }>
  | Readonly<{ status: 401 | 404 | 410 }>;

interface CustomerDownloadState {
  readonly workspaceId: string;
  readonly runId: string;
}

function checksumHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export interface ExportObjectIntegrityFacts {
  readonly objectKey: string;
  readonly contentHash: string;
  readonly byteSize: number;
  readonly mimeType: string;
  readonly workspaceId: string;
  readonly runId: string;
}

export type ExportObjectIntegrity = 'valid' | 'invalid' | 'unavailable';

/**
 * Verifies the stored export before a customer-download capability is minted. A legacy object
 * without R2's stored SHA-256 is intentionally not mintable: the buyer must explicitly create a
 * new export so the archive is written again with the required checksum and private metadata.
 */
export async function verifyExportObjectBeforeMint(
  bucket: Pick<R2Bucket, 'head'>,
  facts: ExportObjectIntegrityFacts,
): Promise<ExportObjectIntegrity> {
  try {
    const object = await bucket.head(facts.objectKey);
    if (object === null) return 'invalid';
    const checksum = object.checksums.sha256;
    return object.key === facts.objectKey &&
      object.size === facts.byteSize &&
      object.httpMetadata?.contentType === facts.mimeType &&
      object.customMetadata?.visibility === 'private' &&
      object.customMetadata.workspace_id === facts.workspaceId &&
      object.customMetadata.run_id === facts.runId &&
      checksum !== undefined &&
      checksumHex(checksum) === facts.contentHash
      ? 'valid'
      : 'invalid';
  } catch {
    return 'unavailable';
  }
}

async function verifiedCustomerDownloadState(
  bindings: Pick<CoreBindings, 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'>,
  claims: ArtifactAccessClaims,
  callerJwt: string | null,
  fetchImplementation: typeof fetch,
): Promise<CustomerDownloadState | null> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const publishableKey = bindings.SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !publishableKey || !callerJwt) return null;
  const executor = new SupabaseDataApiExecutor({
    baseUrl,
    publishableKey,
    callerJwt,
    fetch: fetchImplementation,
  });
  try {
    const artifact = await executor.selectOne('artifacts', {
      id: `eq.${claims.artifactId}`,
      select:
        'id,artifact_kind,status,run_id,content_hash,object_key,byte_size,mime_type,workspace_id,project_id,canvas_revision_id',
    });
    if (
      artifact === null ||
      artifact.artifact_kind !== 'export' ||
      artifact.status !== 'available' ||
      artifact.run_id === null ||
      artifact.content_hash === null ||
      artifact.object_key !== claims.objectKey ||
      artifact.content_hash !== claims.contentHash ||
      artifact.byte_size !== claims.byteSize ||
      artifact.mime_type !== claims.mimeType
    ) {
      return null;
    }
    const run = await executor.selectOne('runs', {
      id: `eq.${artifact.run_id}`,
      workspace_id: `eq.${artifact.workspace_id}`,
      select: 'id,status,workspace_id,project_id,canvas_revision_id',
    });
    if (
      run === null ||
      (run.status !== 'succeeded' && run.status !== 'partial_succeeded') ||
      run.project_id !== artifact.project_id ||
      run.canvas_revision_id !== artifact.canvas_revision_id
    ) {
      return null;
    }
    return { workspaceId: artifact.workspace_id, runId: artifact.run_id };
  } catch {
    return null;
  }
}

function verifiedCustomerDownloadObject(
  object: R2ObjectBody,
  claims: ArtifactAccessClaims,
  state: CustomerDownloadState,
): boolean {
  const checksum = object.checksums.sha256;
  return (
    object.key === claims.objectKey &&
    object.size === claims.byteSize &&
    object.httpMetadata?.contentType === claims.mimeType &&
    object.customMetadata?.visibility === 'private' &&
    object.customMetadata.workspace_id === state.workspaceId &&
    object.customMetadata.run_id === state.runId &&
    checksum !== undefined &&
    checksumHex(checksum) === claims.contentHash
  );
}

/**
 * Serves the bytes for a valid capability. Verification is crypto + expiry only for
 * provider_input - a database blip during fal's fetch must not waste the paid master that
 * produced the input. customer_download additionally re-checks the artifact and run under the
 * caller's authenticated RLS scope before serving. A capability alone cannot download a buyer
 * export.
 */
export async function serveArtifactContent(
  bindings: Pick<
    CoreBindings,
    'ARTIFACT_ACCESS_SIGNING_KEY' | 'MEDIA_BUCKET' | 'SUPABASE_URL' | 'SUPABASE_PUBLISHABLE_KEY'
  >,
  artifactIdFromPath: string,
  token: string,
  nowEpochSeconds: number,
  callerJwt: string | null = null,
  fetchImplementation: typeof fetch = (input, init) => fetch(input, init),
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
  if (verification.claims.purpose === 'customer_upload') return { status: 401 };
  const downloadState =
    verification.claims.purpose === 'customer_download'
      ? await verifiedCustomerDownloadState(
          bindings,
          verification.claims,
          callerJwt,
          fetchImplementation,
        )
      : null;
  if (verification.claims.purpose === 'customer_download' && downloadState === null) {
    return { status: 404 };
  }
  const object = await bindings.MEDIA_BUCKET.get(verification.claims.objectKey);
  if (object === null) return { status: 404 };
  if (
    verification.claims.purpose === 'customer_download' &&
    (downloadState === null ||
      !verifiedCustomerDownloadObject(object, verification.claims, downloadState))
  ) {
    return { status: 404 };
  }
  return {
    status: 200,
    body: object.body,
    claims: verification.claims,
    verifiedDownloadRunId: downloadState?.runId ?? null,
  };
}

function customerDownloadFilename(claims: ArtifactAccessClaims, verifiedRunId: string): string {
  const safeRunId = verifiedRunId
    .replace(/[^a-zA-Z0-9._-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 80);
  if (safeRunId.length === 0) throw new RangeError('A verified run ID is required for downloads');
  const extension =
    claims.mimeType === 'application/zip'
      ? 'zip'
      : claims.mimeType === 'application/json'
        ? 'json'
        : 'bin';
  return `mustbeviral-launch-pack-${safeRunId}.${extension}`;
}

/** Response headers for served content. Content-Type comes from the signed claims, never from R2
 * metadata, so a swapped object cannot change how the response is interpreted. */
export function artifactContentHeaders(
  claims: ArtifactAccessClaims,
  verifiedDownloadRunId: string | null = null,
): Readonly<Record<string, string>> {
  if (claims.purpose === 'customer_download' && verifiedDownloadRunId === null) {
    throw new RangeError('Customer download headers require a verified run ID');
  }
  return {
    'content-type': claims.mimeType,
    'content-length': String(claims.byteSize),
    'cache-control': 'private, no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...(claims.purpose === 'customer_download'
      ? {
          'content-disposition': `attachment; filename="${customerDownloadFilename(claims, verifiedDownloadRunId ?? '')}"`,
        }
      : {}),
  };
}

export type ArtifactUploadResult =
  | Readonly<{ status: 204; claims: ArtifactAccessClaims }>
  | Readonly<{ status: 400 | 401 | 404 | 409 | 410 | 413 }>;

async function finalizeInputArtifact(
  bindings: Pick<
    CoreBindings,
    'SUPABASE_URL' | 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'
  >,
  artifactId: string,
  contentHash: string,
  fetchImplementation: typeof fetch,
): Promise<boolean> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !privilegedKey) return false;
  const response = await fetchImplementation(`${baseUrl}/rest/v1/rpc/finalize_input_artifact`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: privilegedKey,
      authorization: `Bearer ${privilegedKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ p_artifact_id: artifactId, p_content_hash: contentHash }),
  });
  return response.ok;
}

export async function receiveArtifactUpload(
  bindings: Pick<
    CoreBindings,
    | 'ARTIFACT_ACCESS_SIGNING_KEY'
    | 'MEDIA_BUCKET'
    | 'SUPABASE_URL'
    | 'SUPABASE_SECRET_KEY'
    | 'SUPABASE_SERVICE_ROLE_KEY'
  >,
  artifactIdFromPath: string,
  token: string,
  body: Uint8Array,
  nowEpochSeconds: number,
  fetchImplementation: typeof fetch = (input, init) => fetch(input, init),
): Promise<ArtifactUploadResult> {
  const verification = await verifyArtifactAccessToken(
    bindings.ARTIFACT_ACCESS_SIGNING_KEY,
    token,
    nowEpochSeconds,
  );
  if (!verification.valid) {
    return verification.reason === 'expired' ? { status: 410 } : { status: 401 };
  }
  if (
    verification.claims.artifactId !== artifactIdFromPath ||
    verification.claims.purpose !== 'customer_upload'
  ) {
    return { status: 401 };
  }
  if (body.byteLength > verification.claims.byteSize) return { status: 413 };
  if (body.byteLength !== verification.claims.byteSize) return { status: 400 };
  const digest = await sha256Hex(body);
  if (digest !== verification.claims.contentHash) return { status: 400 };
  try {
    const verified = await verifyProviderArtifactBytes(body, verification.claims.mimeType);
    if (verified.mimeType !== verification.claims.mimeType) return { status: 400 };
  } catch {
    return { status: 400 };
  }
  await bindings.MEDIA_BUCKET.put(verification.claims.objectKey, body, {
    httpMetadata: { contentType: verification.claims.mimeType },
  });
  const finalized = await finalizeInputArtifact(
    bindings,
    verification.claims.artifactId,
    verification.claims.contentHash,
    fetchImplementation,
  );
  if (!finalized) return { status: 409 };
  return { status: 204, claims: verification.claims };
}
