import { describe, expect, it } from 'vitest';

import {
  createDeterministicExport,
  providerArtifactObjectKey,
  requirePrivateArtifact,
  verifyProviderArtifactBytes,
} from './index';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

describe('artifact visibility', () => {
  it('fails closed for public canonical media', () => {
    expect(requirePrivateArtifact('private')).toBe('private');
    expect(() => requirePrivateArtifact('public')).toThrow('must remain private');
  });

  it('verifies provider media bytes before returning immutable metadata', async () => {
    const verified = await verifyProviderArtifactBytes(png(1080, 1350), 'image/png');
    expect(verified).toMatchObject({
      byteSize: 24,
      mimeType: 'image/png',
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1350 },
    });
    expect(verified.contentHash).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('uses a deterministic private provider object key with no delivery URL', () => {
    const key = providerArtifactObjectKey({
      workspaceId: 'workspace-1',
      runId: 'run-1',
      attemptId: 'attempt-1',
    });
    expect(key).toBe('workspaces/workspace-1/runs/run-1/attempts/attempt-1/provider-output');
    expect(key).not.toContain('https://');
  });

  it('creates byte-identical exports for the same approved set regardless of input order', () => {
    const receipt = {
      runId: 'run-1',
      canvasRevisionId: 'revision-1',
      canvasRevisionHash: 'a'.repeat(64),
      quoteId: 'quote-1',
      runStatus: 'partial_succeeded',
      reservation: {
        amountMicros: 1_000_000,
        capturedMicros: 600_000,
        releasedMicros: 400_000,
      },
      providerJobs: [
        {
          attemptId: 'attempt-1',
          provider: 'fal',
          providerModelId: 'fal/model',
          routeId: 'fal/route',
          status: 'succeeded',
          captureMicros: 600_000,
        },
      ],
      lineage: [],
    } as const;
    const members = [
      {
        artifactId: 'artifact-b',
        artifactKind: 'approved_output',
        contentHash: 'b'.repeat(64),
        mimeType: 'image/png',
        bytes: png(1080, 1350),
      },
      {
        artifactId: 'artifact-a',
        artifactKind: 'approved_output',
        contentHash: 'a'.repeat(64),
        mimeType: 'image/png',
        bytes: png(1080, 1080),
      },
    ];
    const first = createDeterministicExport({ format: 'zip', members, receipt });
    const replay = createDeterministicExport({
      format: 'zip',
      members: [...members].reverse(),
      receipt,
    });
    expect(first.bytes).toEqual(replay.bytes);
    expect(new TextDecoder().decode(first.bytes)).not.toContain('https://');
  });
});
