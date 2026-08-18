import type { MustBeViralRestClient } from '@mustbeviral/contracts';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export class PackshotUploadError extends Error {
  override readonly name = 'PackshotUploadError';

  constructor(
    readonly code: 'type' | 'size' | 'sign' | 'put',
    message: string,
  ) {
    super(message);
  }
}

function sameOriginUploadUrl(accessUrl: string): string {
  try {
    const url = new URL(accessUrl);
    if (typeof window === 'undefined') return accessUrl;
    return `${window.location.origin}/api/core${url.pathname}${url.search}`;
  } catch {
    return accessUrl;
  }
}

export async function sha256HexOfBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function packshotContentType(file: File): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (ALLOWED_TYPES.has(file.type)) {
    return file.type as 'image/jpeg' | 'image/png' | 'image/webp';
  }
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  return null;
}

export async function uploadPackshot(
  client: MustBeViralRestClient,
  projectId: string,
  file: File,
  fetchImplementation: typeof fetch = (input, init) => fetch(input, init),
): Promise<Readonly<{ artifactId: string }>> {
  const contentType = packshotContentType(file);
  if (contentType === null) {
    throw new PackshotUploadError('type', 'Use a JPEG, PNG, or WebP packshot.');
  }
  if (file.size < 1 || file.size > 12_582_912) {
    throw new PackshotUploadError('size', 'The packshot must be between 1 byte and 12 MB.');
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const sha256 = await sha256HexOfBytes(bytes);
  const created = await client.request('create_artifact_upload', {
    idempotencyKey: `packshot-${sha256}`,
    body: {
      project_id: projectId,
      content_type: contentType,
      byte_size: file.size,
      sha256,
      purpose: 'packshot',
    },
  });
  if ('error' in created) {
    throw new PackshotUploadError('sign', 'Core could not prepare a private upload.');
  }
  const put = await fetchImplementation(sameOriginUploadUrl(created.data.upload_url), {
    method: 'PUT',
    headers: { 'content-type': contentType },
    body: bytes,
  });
  if (!put.ok) {
    throw new PackshotUploadError('put', 'The packshot could not be stored privately.');
  }
  return { artifactId: created.data.artifact_id };
}
