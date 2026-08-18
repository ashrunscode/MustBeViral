import { describe, expect, it, vi } from 'vitest';

import {
  mintArtifactAccessToken,
  sha256Hex,
  type ArtifactAccessClaims,
} from '../../../../packages/artifacts/src/index';
import { receiveArtifactUpload, serveArtifactContent } from '../../src/composition/artifact-access';

const KEY = 'artifact-access-signing-key-fixture-32ch';
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
);

async function claims(): Promise<ArtifactAccessClaims> {
  return {
    purpose: 'customer_upload',
    artifactId: 'artifact-packshot',
    objectKey: 'workspaces/w/projects/p/inputs/artifact-packshot',
    contentHash: await sha256Hex(PNG_1X1),
    byteSize: PNG_1X1.byteLength,
    mimeType: 'image/png',
    expiresAtEpochSeconds: 2_000_000,
  };
}

describe('customer upload capability', () => {
  it('refuses to GET a customer_upload token', async () => {
    const signed = await claims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const result = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get: async () => ({ body: new ReadableStream() }) },
      } as never,
      signed.artifactId,
      token,
      1_999_000,
    );
    expect(result.status).toBe(401);
  });

  it('writes matching bytes and finalizes the pending input', async () => {
    const signed = await claims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const put = vi.fn(async () => undefined);
    const fetchImplementation = vi.fn(async () => Response.json({ status: 'available' }));
    const result = await receiveArtifactUpload(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { put },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      signed.artifactId,
      token,
      PNG_1X1,
      1_999_000,
      fetchImplementation as unknown as typeof fetch,
    );
    expect(result).toEqual({ status: 204, claims: signed });
    expect(put).toHaveBeenCalledWith(signed.objectKey, PNG_1X1, {
      httpMetadata: { contentType: 'image/png' },
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringContaining('finalize_input_artifact'),
      expect.any(Object),
    );
  });

  it('rejects a hash mismatch without writing the object', async () => {
    const signed = await claims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const put = vi.fn(async () => undefined);
    const result = await receiveArtifactUpload(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { put },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      signed.artifactId,
      token,
      Uint8Array.of(1, 2, 3, 4),
      1_999_000,
    );
    expect(result.status).toBe(400);
    expect(put).not.toHaveBeenCalled();
  });
});
