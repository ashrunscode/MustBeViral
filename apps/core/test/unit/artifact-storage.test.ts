import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { sha256Hex } from '../../../../packages/artifacts/src/index';
import {
  ArtifactStorageError,
  putPrivateCanonicalBytes,
  putPrivateCanonicalStream,
} from '../../src/composition/artifact-storage';

describe('private canonical export storage', () => {
  it('asks R2 to verify and retain the export SHA-256 during PUT', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async () => undefined);

    await putPrivateCanonicalBytes({ put } as never, {
      objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
      bytes,
      mimeType: 'application/zip',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      contentHash,
    });

    expect(put).toHaveBeenCalledWith('workspaces/workspace-1/runs/run-1/exports/hash.zip', bytes, {
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: {
        visibility: 'private',
        workspace_id: 'workspace-1',
        run_id: 'run-1',
      },
      sha256: Uint8Array.from(contentHash.match(/.{2}/gu) ?? [], (pair) =>
        Number.parseInt(pair, 16),
      ),
    });
  });

  it('streams a lazy export and verifies R2 retained the supplied SHA-256', async () => {
    const chunks = [
      new TextEncoder().encode('deterministic '),
      new TextEncoder().encode('streamed export'),
    ];
    const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const contentHash = await sha256Hex(bytes);
    let observed: Uint8Array | undefined;
    const put = vi.fn(async (_key: string, body: ReadableStream, options: R2PutOptions) => {
      observed = new Uint8Array(await new Response(body).arrayBuffer());
      const supplied = options.sha256 as Uint8Array;
      return {
        size: observed.byteLength,
        checksums: {
          sha256: supplied.buffer.slice(
            supplied.byteOffset,
            supplied.byteOffset + supplied.byteLength,
          ),
        },
      };
    });

    await putPrivateCanonicalStream({ put } as never, {
      objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
      chunks: (async function* () {
        for (const chunk of chunks) yield chunk;
      })(),
      byteSize: bytes.byteLength,
      mimeType: 'application/zip',
      workspaceId: 'workspace-1',
      runId: 'run-1',
      contentHash,
    });

    expect(observed).toEqual(bytes);
    expect(put.mock.calls[0]?.[1]).toBeInstanceOf(ReadableStream);
    expect(put.mock.calls[0]?.[2]).toMatchObject({
      httpMetadata: { contentType: 'application/zip' },
      customMetadata: {
        visibility: 'private',
        workspace_id: 'workspace-1',
        run_id: 'run-1',
      },
    });
    expect(
      Buffer.from((put.mock.calls[0]?.[2] as R2PutOptions).sha256 as Uint8Array).toString('hex'),
    ).toBe(contentHash);
  });

  it('uses FixedLengthStream so repository-pinned workerd accepts the checksummed R2 upload', async () => {
    const bucket = (env as unknown as { MEDIA_BUCKET: R2Bucket }).MEDIA_BUCKET;
    const bytes = new TextEncoder().encode('repository-pinned fixed-length R2 export');
    const contentHash = await sha256Hex(bytes);
    const checksum = Uint8Array.from(contentHash.match(/.{2}/gu) ?? [], (pair) =>
      Number.parseInt(pair, 16),
    );
    const keyPrefix = `tests/fixed-length-export/${crypto.randomUUID()}`;
    const plainKey = `${keyPrefix}-plain.zip`;
    const fixedKey = `${keyPrefix}-fixed.zip`;
    try {
      await expect(
        bucket.put(
          plainKey,
          new ReadableStream({
            start(controller) {
              controller.enqueue(bytes);
              controller.close();
            },
          }),
          { sha256: checksum },
        ),
      ).rejects.toThrow('must have a known length');

      await putPrivateCanonicalStream(bucket, {
        objectKey: fixedKey,
        chunks: (async function* () {
          yield bytes.subarray(0, 11);
          yield bytes.subarray(11);
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-fixed-length',
        runId: 'run-fixed-length',
        contentHash,
      });

      const stored = await bucket.get(fixedKey);
      if (stored === null) throw new TypeError('Fixed-length R2 fixture was not stored');
      expect(new Uint8Array(await stored.arrayBuffer())).toEqual(bytes);
      expect(stored.size).toBe(bytes.byteLength);
      expect(
        Buffer.from(new Uint8Array(stored.checksums.sha256 ?? new ArrayBuffer(0))).toString('hex'),
      ).toBe(contentHash);
    } finally {
      await bucket.delete([plainKey, fixedKey]);
    }
  });

  it('fails closed when R2 does not retain the expected streamed SHA-256', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async (_key: string, body: ReadableStream) => {
      await new Response(body).arrayBuffer();
      return { size: bytes.byteLength, checksums: {} };
    });

    await expect(
      putPrivateCanonicalStream({ put } as never, {
        objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
        chunks: (async function* () {
          yield bytes;
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        contentHash,
      }),
    ).rejects.toMatchObject({ reason: 'artifact_verification_failed', retryable: false });
  });

  it('preserves a terminal source-integrity failure when R2 consumption fails concurrently', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async (_key: string, body: ReadableStream) => {
      await new Response(body).arrayBuffer();
      throw new Error('fixture R2 stream rejection');
    });
    const integrityFailure = new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Pinned source changed',
    );

    await expect(
      putPrivateCanonicalStream({ put } as never, {
        objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
        chunks: (async function* () {
          yield bytes.subarray(0, 4);
          throw integrityFailure;
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        contentHash,
      }),
    ).rejects.toBe(integrityFailure);
  });

  it('maps a deterministic CRC failure to terminal source integrity', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async (_key: string, body: ReadableStream) => {
      await new Response(body).arrayBuffer();
      throw new Error('fixture R2 rejected the aborted stream');
    });

    await expect(
      putPrivateCanonicalStream({ put } as never, {
        objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
        chunks: (async function* () {
          yield bytes.subarray(0, 4);
          throw new TypeError('Export member changed after validation');
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        contentHash,
      }),
    ).rejects.toMatchObject({ reason: 'artifact_verification_failed', retryable: false });
  });

  it('maps a short deterministic stream to terminal source integrity', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async (_key: string, body: ReadableStream) => {
      await new Response(body).arrayBuffer();
      throw new Error('fixture R2 rejected the short fixed-length stream');
    });

    await expect(
      putPrivateCanonicalStream({ put } as never, {
        objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
        chunks: (async function* () {
          yield bytes.subarray(0, 4);
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        contentHash,
      }),
    ).rejects.toMatchObject({ reason: 'artifact_verification_failed', retryable: false });
  });

  it('keeps a genuine R2 write rejection retryable after the fixed-length source completes', async () => {
    const bytes = new TextEncoder().encode('deterministic export bytes');
    const contentHash = await sha256Hex(bytes);
    const put = vi.fn(async (_key: string, body: ReadableStream) => {
      await new Response(body).arrayBuffer();
      throw new Error('fixture R2 unavailable');
    });

    await expect(
      putPrivateCanonicalStream({ put } as never, {
        objectKey: 'workspaces/workspace-1/runs/run-1/exports/hash.zip',
        chunks: (async function* () {
          yield bytes;
        })(),
        byteSize: bytes.byteLength,
        mimeType: 'application/zip',
        workspaceId: 'workspace-1',
        runId: 'run-1',
        contentHash,
      }),
    ).rejects.toMatchObject({ reason: 'r2_put_failed', retryable: true });
  });
});
