import { describe, expect, it, vi } from 'vitest';

import {
  mintArtifactAccessToken,
  sha256Hex,
  type ArtifactAccessClaims,
} from '../../../../packages/artifacts/src/index';
import {
  artifactContentHeaders,
  receiveArtifactUpload,
  serveArtifactContent,
  verifyExportObjectBeforeMint,
} from '../../src/composition/artifact-access';

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

const EXPORT_BYTES = new TextEncoder().encode('PK deterministic buyer export');

async function downloadClaims(): Promise<ArtifactAccessClaims> {
  return {
    purpose: 'customer_download',
    artifactId: 'artifact-export',
    objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
    contentHash: await sha256Hex(EXPORT_BYTES),
    byteSize: EXPORT_BYTES.byteLength,
    mimeType: 'application/zip',
    expiresAtEpochSeconds: 2_000_000,
  };
}

function hashBuffer(contentHash: string): ArrayBuffer {
  return Uint8Array.from(contentHash.match(/.{2}/gu) ?? [], (pair) => Number.parseInt(pair, 16))
    .buffer as ArrayBuffer;
}

function downloadObject(signed: ArtifactAccessClaims): Readonly<Record<string, unknown>> {
  return {
    key: signed.objectKey,
    size: signed.byteSize,
    body: new ReadableStream(),
    httpMetadata: { contentType: signed.mimeType },
    customMetadata: {
      visibility: 'private',
      workspace_id: 'workspace-1',
      run_id: 'run-1',
    },
    checksums: { sha256: hashBuffer(signed.contentHash) },
  };
}

function databaseFetch(
  signed: ArtifactAccessClaims,
  overrides: Readonly<{
    artifactStatus?: string;
    artifactHash?: string;
    artifactKind?: string;
    artifactObjectKey?: string;
    artifactByteSize?: number;
    artifactMimeType?: string;
    runStatus?: string;
  }> = {},
): ReturnType<typeof vi.fn> {
  return vi.fn(async (request: string | URL | Request, _init?: RequestInit) => {
    void _init;
    const url = String(request);
    if (url.includes('/rest/v1/artifacts?')) {
      return Response.json({
        id: signed.artifactId,
        artifact_kind: overrides.artifactKind ?? 'export',
        status: overrides.artifactStatus ?? 'available',
        run_id: 'run-1',
        content_hash: overrides.artifactHash ?? signed.contentHash,
        object_key: overrides.artifactObjectKey ?? signed.objectKey,
        byte_size: overrides.artifactByteSize ?? signed.byteSize,
        mime_type: overrides.artifactMimeType ?? signed.mimeType,
        workspace_id: 'workspace-1',
        project_id: 'project-1',
        canvas_revision_id: 'revision-1',
      });
    }
    if (url.includes('/rest/v1/runs?')) {
      return Response.json({
        id: 'run-1',
        status: overrides.runStatus ?? 'succeeded',
        workspace_id: 'workspace-1',
        project_id: 'project-1',
        canvas_revision_id: 'revision-1',
      });
    }
    return Response.json({ message: 'unexpected fixture request' }, { status: 500 });
  });
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

  it.each(['provider_input', 'review_preview'] as const)(
    'keeps %s reads capability-only and independent of caller auth',
    async (purpose) => {
      const signed = { ...(await claims()), purpose };
      const token = await mintArtifactAccessToken(KEY, signed);
      const get = vi.fn(async () => ({ body: new ReadableStream() }));
      const fetchImplementation = vi.fn(() => {
        throw new Error('Capability-only reads must not query Supabase');
      });

      const result = await serveArtifactContent(
        {
          ARTIFACT_ACCESS_SIGNING_KEY: KEY,
          MEDIA_BUCKET: { get },
        } as never,
        signed.artifactId,
        token,
        1_999_000,
        null,
        fetchImplementation as unknown as typeof fetch,
      );

      expect(result.status).toBe(200);
      expect(get).toHaveBeenCalledWith(signed.objectKey);
      expect(fetchImplementation).not.toHaveBeenCalled();
    },
  );
});

describe('customer download capability', () => {
  it('fails closed before minting a legacy export without a stored R2 SHA-256', async () => {
    const signed = await downloadClaims();
    const valid = downloadObject(signed);
    const head = vi
      .fn()
      .mockResolvedValueOnce({ ...valid, checksums: {} })
      .mockResolvedValueOnce(valid)
      .mockRejectedValueOnce(new Error('transient R2 lookup failure'));
    const facts = {
      objectKey: signed.objectKey,
      contentHash: signed.contentHash,
      byteSize: signed.byteSize,
      mimeType: signed.mimeType,
      workspaceId: 'workspace-1',
      runId: 'run-1',
    };

    await expect(verifyExportObjectBeforeMint({ head } as never, facts)).resolves.toBe('invalid');
    await expect(verifyExportObjectBeforeMint({ head } as never, facts)).resolves.toBe('valid');
    await expect(verifyExportObjectBeforeMint({ head } as never, facts)).resolves.toBe(
      'unavailable',
    );
  });

  it('serves only an exact terminal database row and checksummed R2 object', async () => {
    const signed = await downloadClaims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const get = vi.fn(async () => downloadObject(signed));
    const fetchImplementation = databaseFetch(signed);

    const result = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        SUPABASE_SECRET_KEY: 'privileged-key-must-not-be-used',
      } as never,
      signed.artifactId,
      token,
      1_999_000,
      'verified-caller-jwt',
      fetchImplementation as unknown as typeof fetch,
    );

    expect(result).toMatchObject({ status: 200, verifiedDownloadRunId: 'run-1' });
    expect(get).toHaveBeenCalledWith(signed.objectKey);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImplementation.mock.calls) {
      const headers = new Headers(init?.headers);
      expect(headers.get('apikey')).toBe('publishable-key');
      expect(headers.get('authorization')).toBe('Bearer verified-caller-jwt');
    }
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain(
      'privileged-key-must-not-be-used',
    );
    expect(fetchImplementation.mock.calls.map(([request]) => String(request))).toEqual([
      expect.stringContaining('/rest/v1/artifacts?'),
      expect.stringContaining('/rest/v1/runs?'),
    ]);
    expect(
      fetchImplementation.mock.calls.map(([request]) => String(request)).join('\n'),
    ).not.toContain('select=*');
    expect(artifactContentHeaders(signed, 'run-1')).toMatchObject({
      'content-type': 'application/zip',
      'content-length': String(EXPORT_BYTES.byteLength),
      'cache-control': 'private, no-store',
      'content-disposition': 'attachment; filename="mustbeviral-launch-pack-run-1.zip"',
    });
  });

  it.each([
    ['a quarantined export row', { artifactStatus: 'quarantined' }],
    ['database content-hash drift', { artifactHash: 'f'.repeat(64) }],
    ['a non-export artifact row', { artifactKind: 'approved_output' }],
    ['database object-key drift', { artifactObjectKey: 'workspaces/other/export.zip' }],
    ['database byte-size drift', { artifactByteSize: EXPORT_BYTES.byteLength + 1 }],
    ['database MIME drift', { artifactMimeType: 'application/json' }],
    ['a non-terminal run', { runStatus: 'running' }],
  ])('fails closed before R2 for %s', async (_label, overrides) => {
    const signed = await downloadClaims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const get = vi.fn(async () => downloadObject(signed));
    const result = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      } as never,
      signed.artifactId,
      token,
      1_999_000,
      'verified-caller-jwt',
      databaseFetch(signed, overrides) as unknown as typeof fetch,
    );
    expect(result.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it.each(['key', 'size', 'hash', 'mime', 'metadata', 'missing_checksum'] as const)(
    'fails closed for R2 %s drift',
    async (drift) => {
      const signed = await downloadClaims();
      const token = await mintArtifactAccessToken(KEY, signed);
      const valid = downloadObject(signed);
      const object =
        drift === 'key'
          ? { ...valid, key: 'workspaces/other/export.zip' }
          : drift === 'size'
            ? { ...valid, size: signed.byteSize + 1 }
            : drift === 'mime'
              ? { ...valid, httpMetadata: { contentType: 'application/json' } }
              : drift === 'hash'
                ? { ...valid, checksums: { sha256: hashBuffer('f'.repeat(64)) } }
                : drift === 'metadata'
                  ? { ...valid, customMetadata: { visibility: 'private', workspace_id: 'other' } }
                  : { ...valid, checksums: {} };
      const result = await serveArtifactContent(
        {
          ARTIFACT_ACCESS_SIGNING_KEY: KEY,
          MEDIA_BUCKET: { get: async () => object },
          SUPABASE_URL: 'https://staging.example.test',
          SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        } as never,
        signed.artifactId,
        token,
        1_999_000,
        'verified-caller-jwt',
        databaseFetch(signed) as unknown as typeof fetch,
      );
      expect(result.status).toBe(404);
    },
  );

  it('fails closed before R2 when caller-scoped state verification is unavailable', async () => {
    const signed = await downloadClaims();
    const token = await mintArtifactAccessToken(KEY, signed);
    const get = vi.fn(async () => downloadObject(signed));
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 401 }));

    const missingCaller = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      } as never,
      signed.artifactId,
      token,
      1_999_000,
    );
    expect(missingCaller.status).toBe(404);
    expect(fetchImplementation).not.toHaveBeenCalled();

    const rejectedCaller = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get },
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
      } as never,
      signed.artifactId,
      token,
      1_999_000,
      'invalid-caller-jwt',
      fetchImplementation as unknown as typeof fetch,
    );
    expect(rejectedCaller.status).toBe(404);

    const result = await serveArtifactContent(
      {
        ARTIFACT_ACCESS_SIGNING_KEY: KEY,
        MEDIA_BUCKET: { get },
      } as never,
      signed.artifactId,
      token,
      1_999_000,
    );
    expect(result.status).toBe(404);
    expect(get).not.toHaveBeenCalled();
  });

  it('sanitizes the deterministic attachment filename', async () => {
    const signed = {
      ...(await downloadClaims()),
    };
    const disposition = artifactContentHeaders(signed, 'run"\r\nx-unsafe: yes')[
      'content-disposition'
    ];
    expect(disposition).toBe('attachment; filename="mustbeviral-launch-pack-run-x-unsafe-yes.zip"');
    expect(disposition).not.toMatch(/[\r\n]/u);
  });

  it('refuses to build customer-download headers without a database-verified run ID', async () => {
    const signed = await downloadClaims();
    expect(() => artifactContentHeaders(signed)).toThrow('verified run ID');
  });
});
