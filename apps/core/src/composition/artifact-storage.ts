import {
  CANONICAL_ARTIFACT_VISIBILITY,
  crc32Bytes,
  requirePrivateArtifact,
  sha256Hex,
  verifyProviderArtifactBytes,
  type VerifiedProviderArtifact,
} from '../../../../packages/artifacts/src/index';
import type { TransientDeliveryUrl } from '../../../../packages/provider/src/types';

import type { CoreBindings } from '../bindings';

const MAX_PROVIDER_ARTIFACT_BYTES = 100 * 1024 * 1024;

interface DigestStreamLike extends WritableStream<ArrayBuffer | ArrayBufferView> {
  readonly digest: Promise<ArrayBuffer>;
  readonly bytesWritten: number | bigint;
}

interface PrivateR2ObjectBody {
  readonly size: number;
  readonly etag: string;
  readonly body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
}

interface PrivateR2StoredObject {
  readonly size: number;
  readonly checksums: Readonly<{ sha256?: ArrayBuffer }>;
}

function createDigestStream(): DigestStreamLike {
  const DigestStreamConstructor = (
    crypto as unknown as {
      readonly DigestStream: new (algorithm: string) => DigestStreamLike;
    }
  ).DigestStream;
  return new DigestStreamConstructor('SHA-256');
}

function createFixedLengthStream(byteSize: number): Readonly<{
  readable: ReadableStream;
  writable: WritableStream<ArrayBuffer | ArrayBufferView>;
}> {
  const FixedLengthStreamConstructor = (
    globalThis as unknown as {
      readonly FixedLengthStream: new (length: number) => Readonly<{
        readable: ReadableStream;
        writable: WritableStream<ArrayBuffer | ArrayBufferView>;
      }>;
    }
  ).FixedLengthStream;
  return new FixedLengthStreamConstructor(byteSize);
}

export class ArtifactStorageError extends Error {
  override readonly name = 'ArtifactStorageError';

  constructor(
    readonly reason:
      | 'delivery_fetch_failed'
      | 'delivery_acl_suspected'
      | 'delivery_origin_invalid'
      | 'artifact_too_large'
      | 'artifact_verification_failed'
      | 'r2_put_failed'
      | 'r2_read_failed',
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

function requireFalDeliveryOrigin(deliveryUrl: TransientDeliveryUrl): string {
  const parsed = new URL(deliveryUrl);
  const isFalMedia =
    parsed.hostname === 'fal.media' || parsed.hostname.toLowerCase().endsWith('.fal.media');
  if (
    !isFalMedia ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    parsed.hash.length > 0
  ) {
    throw new ArtifactStorageError(
      'delivery_origin_invalid',
      false,
      'fal delivery URL is outside the approved media origin',
    );
  }
  return parsed.toString();
}

export interface StoredProviderArtifact extends VerifiedProviderArtifact {
  readonly objectKey: string;
}

function fetchFailure(status: number): ArtifactStorageError {
  return new ArtifactStorageError(
    status === 401 || status === 403 ? 'delivery_acl_suspected' : 'delivery_fetch_failed',
    true,
    status === 401 || status === 403
      ? 'Authenticated fal delivery fetch was denied; the short-lived object may have expired or fal delivery access behavior may have changed'
      : 'Authenticated fal delivery fetch failed',
  );
}

function metadata(
  input: Readonly<{
    workspaceId: string;
    runId: string;
    attemptId?: string;
  }>,
): Readonly<Record<string, string>> {
  return {
    visibility: requirePrivateArtifact(CANONICAL_ARTIFACT_VISIBILITY),
    workspace_id: input.workspaceId,
    run_id: input.runId,
    ...(input.attemptId === undefined ? {} : { attempt_id: input.attemptId }),
  };
}

function sha256ChecksumBytes(contentHash: string): Uint8Array {
  if (!/^[0-9a-f]{64}$/u.test(contentHash)) {
    throw new TypeError('Canonical artifact SHA-256 must be 64 lowercase hexadecimal characters');
  }
  return Uint8Array.from(contentHash.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16));
}

export async function copyFalDeliveryToPrivateR2(
  input: Readonly<{
    bindings: CoreBindings;
    deliveryUrl: TransientDeliveryUrl;
    objectKey: string;
    workspaceId: string;
    runId: string;
    attemptId: string;
    fetchImplementation?: typeof fetch;
  }>,
): Promise<StoredProviderArtifact> {
  const falKey = input.bindings.FAL_KEY;
  if (falKey === undefined || falKey.length === 0) {
    throw new ArtifactStorageError(
      'delivery_fetch_failed',
      true,
      'Authenticated fal delivery fetch is unavailable',
    );
  }
  const boundFetch = input.fetchImplementation ?? ((request, init) => fetch(request, init));
  const deliveryUrl = requireFalDeliveryOrigin(input.deliveryUrl);
  let response: Response;
  try {
    response = await boundFetch(deliveryUrl, {
      method: 'GET',
      headers: { authorization: `Key ${falKey}` },
      // Never forward the fal credential across a provider-controlled redirect. Official fal
      // outputs are direct fal.media objects, so a redirect is drift or an unsafe response.
      redirect: 'error',
    });
  } catch (cause) {
    throw new ArtifactStorageError(
      'delivery_fetch_failed',
      true,
      'Authenticated fal delivery fetch failed',
      { cause },
    );
  }
  if (!response.ok) throw fetchFailure(response.status);

  const declaredLength = response.headers.get('content-length');
  if (
    declaredLength !== null &&
    (!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_PROVIDER_ARTIFACT_BYTES)
  ) {
    throw new ArtifactStorageError(
      'artifact_too_large',
      false,
      'Provider artifact exceeds the private copy size limit',
    );
  }
  const contentType = response.headers.get('content-type');
  if (contentType === null || response.body === null) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      true,
      'Provider artifact response is missing verifiable media metadata',
    );
  }
  const storageContentType = contentType.split(';', 1)[0]?.trim().toLowerCase();
  if (storageContentType === undefined || storageContentType.length === 0) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      true,
      'Provider artifact response has an invalid content type',
    );
  }

  try {
    await input.bindings.MEDIA_BUCKET.put(input.objectKey, response.body, {
      httpMetadata: { contentType: storageContentType },
      customMetadata: metadata(input),
    });
  } catch (cause) {
    throw new ArtifactStorageError(
      'r2_put_failed',
      true,
      'Private R2 provider artifact copy failed',
      { cause },
    );
  }

  let storedObject: R2ObjectBody | null;
  let bytes: Uint8Array;
  try {
    storedObject = await input.bindings.MEDIA_BUCKET.get(input.objectKey);
    if (storedObject === null) {
      throw new Error('Private R2 object was not readable after write');
    }
    bytes = new Uint8Array(await storedObject.arrayBuffer());
  } catch (cause) {
    throw new ArtifactStorageError(
      'r2_read_failed',
      true,
      'Private R2 provider artifact could not be read after write',
      { cause },
    );
  }
  if (bytes.byteLength > MAX_PROVIDER_ARTIFACT_BYTES) {
    throw new ArtifactStorageError(
      'artifact_too_large',
      false,
      'Provider artifact exceeds the private copy size limit',
    );
  }
  try {
    return {
      objectKey: input.objectKey,
      ...(await verifyProviderArtifactBytes(bytes, contentType)),
    };
  } catch (cause) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      true,
      'Provider artifact hash or media measurement could not be verified',
      { cause },
    );
  }
}

export async function readVerifiedPrivateArtifact(
  bucket: R2Bucket,
  input: Readonly<{ objectKey: string; contentHash: string }>,
): Promise<Uint8Array> {
  let object: R2ObjectBody | null;
  try {
    object = await bucket.get(input.objectKey);
  } catch (cause) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member read failed', {
      cause,
    });
  }
  if (object === null) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member is missing');
  }
  const bytes = new Uint8Array(await object.arrayBuffer());
  if ((await sha256Hex(bytes)) !== input.contentHash) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 export member no longer matches its immutable content hash',
    );
  }
  return bytes;
}

export interface VerifiedPrivateArtifactSnapshot {
  readonly bytes: Uint8Array;
  readonly etag: string;
  readonly byteSize: number;
  readonly crc32: number;
}

function checksumHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256HexWithDigestStream(bytes: Uint8Array): Promise<string> {
  const digestStream = createDigestStream();
  const writer = digestStream.getWriter();
  await writer.write(bytes);
  await writer.close();
  return checksumHex(await digestStream.digest);
}

/**
 * Reads only one source object at a time. The caller must discard `bytes` before requesting the next
 * snapshot, which keeps aggregate launch-pack sources out of the Worker heap.
 */
export async function readVerifiedPrivateArtifactSnapshot(
  bucket: R2Bucket,
  input: Readonly<{ objectKey: string; contentHash: string; byteSize: number }>,
): Promise<VerifiedPrivateArtifactSnapshot> {
  let object: R2ObjectBody | null;
  try {
    object = await bucket.get(input.objectKey);
  } catch (cause) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member read failed', {
      cause,
    });
  }
  if (object === null) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member is missing');
  }
  const privateObject = object as unknown as PrivateR2ObjectBody;
  if (
    privateObject.size !== input.byteSize ||
    typeof privateObject.etag !== 'string' ||
    privateObject.etag.length === 0
  ) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 export member metadata no longer matches immutable artifact facts',
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await privateObject.arrayBuffer());
  } catch (cause) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member read failed', {
      cause,
    });
  }
  if (
    bytes.byteLength !== input.byteSize ||
    (await sha256HexWithDigestStream(bytes)) !== input.contentHash
  ) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 export member no longer matches its immutable content hash',
    );
  }
  return {
    bytes,
    etag: privateObject.etag,
    byteSize: privateObject.size,
    crc32: crc32Bytes(bytes),
  };
}

export async function openPinnedPrivateArtifactStream(
  bucket: R2Bucket,
  input: Readonly<{ objectKey: string; etag: string; byteSize: number }>,
): Promise<ReadableStream> {
  let object: PrivateR2ObjectBody | Readonly<{ size: number; etag: string }> | null;
  try {
    object = await (
      bucket as unknown as {
        get(
          key: string,
          options: Readonly<{ onlyIf: Readonly<{ etagMatches: string }> }>,
        ): Promise<PrivateR2ObjectBody | Readonly<{ size: number; etag: string }> | null>;
      }
    ).get(input.objectKey, { onlyIf: { etagMatches: input.etag } });
  } catch (cause) {
    throw new ArtifactStorageError('r2_read_failed', true, 'Private R2 export member read failed', {
      cause,
    });
  }
  if (
    object === null ||
    !('body' in object) ||
    object.etag !== input.etag ||
    object.size !== input.byteSize
  ) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 export member changed after validation',
    );
  }
  return object.body;
}

export async function sha256HexOfChunks(
  chunks: AsyncIterable<Uint8Array>,
): Promise<Readonly<{ contentHash: string; byteSize: number }>> {
  const digestStream = createDigestStream();
  const writer = digestStream.getWriter();
  try {
    for await (const chunk of chunks) await writer.write(chunk);
    await writer.close();
  } catch (cause) {
    await writer.abort(cause).catch(() => undefined);
    throw cause;
  }
  const bytesWritten = Number(digestStream.bytesWritten);
  if (!Number.isSafeInteger(bytesWritten) || bytesWritten < 0) {
    throw new TypeError('Streamed SHA-256 byte count exceeds safe precision');
  }
  return { contentHash: checksumHex(await digestStream.digest), byteSize: bytesWritten };
}

export async function putPrivateCanonicalStream(
  bucket: R2Bucket,
  input: Readonly<{
    objectKey: string;
    chunks: AsyncIterable<Uint8Array>;
    byteSize: number;
    mimeType: string;
    workspaceId: string;
    runId: string;
    contentHash: string;
  }>,
): Promise<void> {
  const iterator = input.chunks[Symbol.asyncIterator]();
  const fixedLength = createFixedLengthStream(input.byteSize);
  const writer = fixedLength.writable.getWriter();
  let sourceFailure: unknown;
  let sourceFailed = false;
  const pump = (async () => {
    let emittedBytes = 0;
    try {
      while (true) {
        let next: IteratorResult<Uint8Array>;
        try {
          next = await iterator.next();
        } catch (cause) {
          sourceFailed = true;
          sourceFailure = cause;
          throw cause;
        }
        if (next.done) break;
        emittedBytes += next.value.byteLength;
        if (!Number.isSafeInteger(emittedBytes) || emittedBytes > input.byteSize) {
          sourceFailed = true;
          sourceFailure = new TypeError('Streamed export exceeded its deterministic byte size');
          throw sourceFailure;
        }
        await writer.write(next.value);
      }
      if (emittedBytes !== input.byteSize) {
        sourceFailed = true;
        sourceFailure = new TypeError('Streamed export ended before its deterministic byte size');
        throw sourceFailure;
      }
      await writer.close();
    } catch (cause) {
      await iterator.return?.().catch(() => undefined);
      await writer.abort(cause).catch(() => undefined);
      throw cause;
    }
  })();
  const put = (async () => {
    try {
      return (await bucket.put(input.objectKey, fixedLength.readable, {
        httpMetadata: { contentType: input.mimeType },
        customMetadata: metadata(input),
        sha256: sha256ChecksumBytes(input.contentHash),
      })) as unknown as PrivateR2StoredObject;
    } catch (cause) {
      await fixedLength.readable.cancel(cause).catch(() => undefined);
      throw cause;
    }
  })();
  const [putResult, pumpResult] = await Promise.allSettled([put, pump]);
  if (sourceFailed) {
    if (sourceFailure instanceof ArtifactStorageError) throw sourceFailure;
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 canonical artifact source changed while streaming',
      { cause: sourceFailure },
    );
  }
  if (putResult.status === 'rejected' || pumpResult.status === 'rejected') {
    const cause =
      putResult.status === 'rejected'
        ? putResult.reason
        : pumpResult.status === 'rejected'
          ? pumpResult.reason
          : undefined;
    throw new ArtifactStorageError(
      'r2_put_failed',
      true,
      'Private R2 canonical artifact write failed',
      { cause },
    );
  }
  const stored = putResult.value;
  const storedSha256 = stored?.checksums?.sha256;
  if (
    stored?.size !== input.byteSize ||
    storedSha256 === undefined ||
    checksumHex(storedSha256) !== input.contentHash
  ) {
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 canonical artifact checksum response disagrees with the upload',
    );
  }
}

export async function putPrivateCanonicalBytes(
  bucket: R2Bucket,
  input: Readonly<{
    objectKey: string;
    bytes: Uint8Array;
    mimeType: string;
    workspaceId: string;
    runId: string;
    /** R2 verifies these bytes during PUT and retains the SHA-256 for download-time integrity. */
    contentHash?: string;
  }>,
): Promise<void> {
  try {
    await bucket.put(input.objectKey, input.bytes, {
      httpMetadata: { contentType: input.mimeType },
      customMetadata: metadata(input),
      ...(input.contentHash === undefined
        ? {}
        : { sha256: sha256ChecksumBytes(input.contentHash) }),
    });
  } catch (cause) {
    throw new ArtifactStorageError(
      'r2_put_failed',
      true,
      'Private R2 canonical artifact write failed',
      { cause },
    );
  }
}
