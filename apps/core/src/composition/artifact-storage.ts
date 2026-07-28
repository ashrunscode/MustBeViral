import {
  CANONICAL_ARTIFACT_VISIBILITY,
  requirePrivateArtifact,
  sha256Hex,
  verifyProviderArtifactBytes,
  type VerifiedProviderArtifact,
} from '../../../../packages/artifacts/src/index';
import { FAL_PRIVATE_OUTPUT_INITIAL_ACL } from '../../../../packages/provider/src/fal';
import type { TransientDeliveryUrl } from '../../../../packages/provider/src/types';

import type { CoreBindings } from '../bindings';

const MAX_PROVIDER_ARTIFACT_BYTES = 100 * 1024 * 1024;

export class ArtifactStorageError extends Error {
  override readonly name = 'ArtifactStorageError';

  constructor(
    readonly reason:
      | 'delivery_fetch_failed'
      | 'delivery_acl_suspected'
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

export interface StoredProviderArtifact extends VerifiedProviderArtifact {
  readonly objectKey: string;
}

function fetchFailure(status: number): ArtifactStorageError {
  return new ArtifactStorageError(
    status === 401 || status === 403 ? 'delivery_acl_suspected' : 'delivery_fetch_failed',
    true,
    status === 401 || status === 403
      ? `Authenticated fal delivery fetch failed; initial ACL "${FAL_PRIVATE_OUTPUT_INITIAL_ACL}" may prevent account-authenticated download`
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
  let response: Response;
  try {
    response = await boundFetch(input.deliveryUrl, {
      method: 'GET',
      headers: { authorization: `Key ${falKey}` },
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

export async function putPrivateCanonicalBytes(
  bucket: R2Bucket,
  input: Readonly<{
    objectKey: string;
    bytes: Uint8Array;
    mimeType: string;
    workspaceId: string;
    runId: string;
  }>,
): Promise<void> {
  try {
    await bucket.put(input.objectKey, input.bytes, {
      httpMetadata: { contentType: input.mimeType },
      customMetadata: metadata(input),
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
