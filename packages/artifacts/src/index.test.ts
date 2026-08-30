import { describe, expect, it } from 'vitest';

import {
  GB04_EXPECTED_EXPORT_MEMBERS,
  createCrc32Accumulator,
  createDeterministicExport,
  createDeterministicExportPlan,
  crc32Bytes,
  gb04ExportFilename,
  providerArtifactObjectKey,
  requirePrivateArtifact,
  sha256Hex,
  streamDeterministicExport,
  verifyProviderArtifactBytes,
  type DeterministicExportMember,
  type DeterministicExportMemberDescriptor,
} from './index';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function storedZipEntries(bytes: Uint8Array): ReadonlyMap<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;
  while (offset + 30 <= bytes.byteLength && view.getUint32(offset, true) === 0x04034b50) {
    const compressedSize = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const bodyStart = nameStart + nameLength + extraLength;
    const bodyEnd = bodyStart + compressedSize;
    if (bodyEnd > bytes.byteLength) throw new RangeError('ZIP entry exceeds archive bounds');
    const name = new TextDecoder().decode(bytes.subarray(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(bodyStart, bodyEnd));
    offset = bodyEnd;
  }
  return entries;
}

function jsonEntry<Result>(entries: ReadonlyMap<string, Uint8Array>, filename: string): Result {
  const bytes = entries.get(filename);
  if (bytes === undefined) throw new TypeError(`ZIP entry ${filename} is missing`);
  return JSON.parse(new TextDecoder().decode(bytes)) as Result;
}

async function exportMember(
  input: Omit<
    DeterministicExportMember,
    'contentHash' | 'artifactKind' | 'accessibilityDescription'
  >,
): Promise<DeterministicExportMember> {
  return {
    ...input,
    artifactKind: 'approved_output',
    accessibilityDescription: `Approved description for ${input.nodeKey}`,
    contentHash: await sha256Hex(input.bytes),
  };
}

function staticConceptMembers(concept: 1 | 2 | 3): Promise<readonly DeterministicExportMember[]> {
  const primaryText = `Meet launch concept ${String(concept)}.`;
  const headline = `A clear launch headline ${String(concept)}`;
  const description = `A concise description ${String(concept)}.`;
  const copySource = new TextEncoder().encode(
    JSON.stringify({
      primary_text: primaryText,
      headline,
      description,
    }),
  );
  return Promise.all([
    exportMember({
      artifactId: `artifact-copy-${String(concept)}`,
      nodeKey: `copy-${String(concept)}`,
      mimeType: 'application/json',
      bytes: copySource,
      copy: { primaryText, headline, description },
      copyQaFindings: [],
    }),
    exportMember({
      artifactId: `artifact-master-${String(concept)}`,
      nodeKey: `master-${String(concept)}`,
      mimeType: 'image/png',
      bytes: png(1080, 1350),
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1350 },
    }),
    exportMember({
      artifactId: `artifact-feed-${String(concept)}`,
      nodeKey: `adaptation-${String(concept)}-1`,
      mimeType: 'image/png',
      bytes: png(1080, 1350),
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1350 },
    }),
    exportMember({
      artifactId: `artifact-square-${String(concept)}`,
      nodeKey: `adaptation-${String(concept)}-2`,
      mimeType: 'image/png',
      bytes: png(1080, 1080),
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1080 },
    }),
    exportMember({
      artifactId: `artifact-stories-${String(concept)}`,
      nodeKey: `adaptation-${String(concept)}-3`,
      mimeType: 'image/png',
      bytes: png(1080, 1920),
      measurement: { kind: 'image', widthPixels: 1080, heightPixels: 1920 },
    }),
  ]);
}

async function gb04Members(): Promise<readonly DeterministicExportMember[]> {
  const [conceptOne, conceptTwo, conceptThree, motion] = await Promise.all([
    staticConceptMembers(1),
    staticConceptMembers(2),
    staticConceptMembers(3),
    exportMember({
      artifactId: 'artifact-motion',
      nodeKey: 'motion-1',
      mimeType: 'video/mp4',
      bytes: Uint8Array.of(0, 0, 0, 8, 109, 100, 97, 116),
      measurement: { kind: 'video', durationMilliseconds: 8_000 },
    }),
  ]);
  return [...conceptOne, ...conceptTwo, ...conceptThree, motion];
}

function exportDescriptors(
  members: readonly DeterministicExportMember[],
): readonly DeterministicExportMemberDescriptor[] {
  return members.map(({ bytes, ...member }) => ({
    ...member,
    byteSize: bytes.byteLength,
    crc32: crc32Bytes(bytes),
  }));
}

const RECEIPT = {
  runId: 'run-1',
  canvasRevisionId: 'revision-1',
  canvasRevisionHash: 'a'.repeat(64),
  quoteId: 'quote-1',
  runStatus: 'partial_succeeded',
  reservation: {
    amountMicros: 1_000_000,
    capturedMicros: 600_000,
    releasedMicros: 400_000,
    refundedMicros: 125_000,
    netMicros: 475_000,
    settlementStatus: 'partially_captured',
  },
  providerJobs: [
    {
      attemptId: 'attempt-1',
      provider: 'fal',
      providerModelId: 'fal/model',
      routeId: 'fal/route',
      status: 'succeeded',
      capturedMicros: 600_000,
    },
  ],
  lineage: [],
} as const;

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

  it('creates a buyer-ready, byte-identical ZIP with semantic files and complete file hashes', async () => {
    const members = await gb04Members();
    const first = await createDeterministicExport({ format: 'zip', members, receipt: RECEIPT });
    const replay = await createDeterministicExport({
      format: 'zip',
      members: [...members].reverse(),
      receipt: RECEIPT,
    });
    expect(first.bytes).toEqual(replay.bytes);
    expect(new TextDecoder().decode(first.bytes)).not.toContain('https://');

    const entries = storedZipEntries(first.bytes);
    expect([...entries.keys()]).toEqual([
      'manifest.json',
      'assets/concept-01/feed-4x5.png',
      'assets/concept-01/master.png',
      'assets/concept-01/reels-motion-9x16.mp4',
      'assets/concept-01/square-1x1.png',
      'assets/concept-01/stories-9x16.png',
      'assets/concept-02/feed-4x5.png',
      'assets/concept-02/master.png',
      'assets/concept-02/square-1x1.png',
      'assets/concept-02/stories-9x16.png',
      'assets/concept-03/feed-4x5.png',
      'assets/concept-03/master.png',
      'assets/concept-03/square-1x1.png',
      'assets/concept-03/stories-9x16.png',
      'copy/concept-01.json',
      'copy/concept-02.json',
      'copy/concept-03.json',
      'qa-report.json',
      'receipt.json',
    ]);
    expect([...entries.keys()].filter((filename) => filename.includes('reels-motion'))).toEqual([
      'assets/concept-01/reels-motion-9x16.mp4',
    ]);
    const fixtureMimeTypes = new Map(members.map((member) => [member.nodeKey, member.mimeType]));
    expect(
      GB04_EXPECTED_EXPORT_MEMBERS.map((expected) =>
        gb04ExportFilename(expected, fixtureMimeTypes.get(expected.nodeKey) ?? ''),
      ).sort(),
    ).toEqual(
      [...entries.keys()]
        .filter(
          (filename) =>
            filename !== 'manifest.json' &&
            filename !== 'qa-report.json' &&
            filename !== 'receipt.json',
        )
        .sort(),
    );
    const manifest = jsonEntry<{
      schema_version: number;
      files: readonly Readonly<{
        filename: string;
        byte_size: number;
        sha256: string;
      }>[];
      qa_report: Readonly<{ overall_status: string }>;
    }>(entries, 'manifest.json');
    expect(manifest.schema_version).toBe(2);
    expect(manifest.qa_report.overall_status).toBe('not_evaluated');
    expect(manifest.files.map((file) => file.filename)).toEqual(
      [...entries.keys()].filter((filename) => filename !== 'manifest.json'),
    );
    for (const file of manifest.files) {
      const bytes = entries.get(file.filename);
      expect(bytes).toBeDefined();
      expect(file.byte_size).toBe(bytes?.byteLength);
      expect(file.sha256).toBe(await sha256Hex(bytes ?? new Uint8Array()));
    }
    expect(jsonEntry<Record<string, unknown>>(entries, 'copy/concept-01.json')).toMatchObject({
      concept_id: 'concept-01',
      primary_text: 'Meet launch concept 1.',
      headline: 'A clear launch headline 1',
      description: 'A concise description 1.',
    });
    expect(jsonEntry<Record<string, unknown>>(entries, 'receipt.json')).toMatchObject({
      run_id: 'run-1',
      quote_id: 'quote-1',
      reservation: {
        amount_micros: '1000000',
        captured_micros: '600000',
        released_micros: '400000',
        refunded_micros: '125000',
        net_micros: '475000',
        settlement_status: 'partially_captured',
      },
      provider_jobs: [
        {
          attempt_id: 'attempt-1',
          provider: 'fal',
          provider_model_id: 'fal/model',
          route_id: 'fal/route',
          status: 'succeeded',
          captured_micros: '600000',
        },
      ],
    });
    const qa = jsonEntry<{
      overall_status: string;
      checks: readonly Readonly<{ check: string; status: string }>[];
    }>(entries, 'qa-report.json');
    expect(qa.overall_status).toBe('not_evaluated');
    expect(qa.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ check: 'required_dimensions', status: 'passed' }),
        expect.objectContaining({ check: 'readable_safe_areas', status: 'not_evaluated' }),
        expect.objectContaining({ check: 'prohibited_claims', status: 'not_evaluated' }),
      ]),
    );
  });

  it('rejects a missing GB-04 member', async () => {
    const members = (await gb04Members()).filter((member) => member.nodeKey !== 'copy-3');
    await expect(
      createDeterministicExport({ format: 'zip', members, receipt: RECEIPT }),
    ).rejects.toThrow('missing=[copy-3]');
  });

  it('publishes one canonical, collision-free GB-04 member descriptor', () => {
    expect(GB04_EXPECTED_EXPORT_MEMBERS).toHaveLength(16);
    expect(new Set(GB04_EXPECTED_EXPORT_MEMBERS.map(({ nodeKey }) => nodeKey)).size).toBe(16);
    const resolvedFilenames = GB04_EXPECTED_EXPORT_MEMBERS.flatMap((member) =>
      member.mimeTypes.map((mimeType) => gb04ExportFilename(member, mimeType)),
    );
    expect(resolvedFilenames).not.toContain(undefined);
    expect(new Set(resolvedFilenames).size).toBe(resolvedFilenames.length);
    expect(
      GB04_EXPECTED_EXPORT_MEMBERS.filter(({ role }) => role === 'motion').map(
        ({ nodeKey, filenameTemplate }) => [nodeKey, filenameTemplate],
      ),
    ).toEqual([['motion-1', 'assets/concept-01/reels-motion-9x16.mp4']]);
  });

  it('rejects extra or duplicate GB-04 members', async () => {
    const members = await gb04Members();
    const motionOne = members.find((member) => member.nodeKey === 'motion-1');
    const copyOne = members.find((member) => member.nodeKey === 'copy-1');
    if (motionOne === undefined || copyOne === undefined)
      throw new TypeError('Fixture is incomplete');

    await expect(
      createDeterministicExport({
        format: 'zip',
        members: [
          ...members,
          { ...motionOne, artifactId: 'artifact-motion-2', nodeKey: 'motion-2' },
        ],
        receipt: RECEIPT,
      }),
    ).rejects.toThrow('unexpected=[motion-2]');
    await expect(
      createDeterministicExport({
        format: 'zip',
        members: [...members, { ...copyOne, artifactId: 'artifact-copy-duplicate' }],
        receipt: RECEIPT,
      }),
    ).rejects.toThrow('duplicate=[copy-1]');
  });

  it.each([
    ['copy-1', 'text/plain', 'normalized JSON copy'],
    ['master-1', 'video/mp4', 'must use image/jpeg, image/png, or image/webp'],
    ['adaptation-2-2', 'video/mp4', 'must use image/jpeg, image/png, or image/webp'],
    ['motion-1', 'image/png', 'must use video/mp4'],
  ] as const)('rejects incompatible MIME for %s', async (nodeKey, mimeType, message) => {
    const members = (await gb04Members()).map((member) =>
      member.nodeKey === nodeKey ? { ...member, mimeType } : member,
    );
    await expect(
      createDeterministicExport({ format: 'zip', members, receipt: RECEIPT }),
    ).rejects.toThrow(message);
  });

  it('fails closed when approved member bytes do not match the immutable source hash', async () => {
    const members = (await gb04Members()).map((member) =>
      member.nodeKey === 'master-1' ? { ...member, contentHash: '0'.repeat(64) } : member,
    );
    await expect(
      createDeterministicExport({
        format: 'zip',
        members,
        receipt: RECEIPT,
      }),
    ).rejects.toThrow('immutable content hash');
  });

  it('streams a logically greater-than-128-MiB GB-04 set with one lazy source open at a time', async () => {
    const sourceChunk = new Uint8Array(1024 * 1024);
    const chunksPerSource = 11;
    const sourceByteSize = sourceChunk.byteLength * chunksPerSource;
    const crc = createCrc32Accumulator();
    for (let index = 0; index < chunksPerSource; index += 1) crc.update(sourceChunk);
    const sourceCrc32 = crc.digest();
    const base = exportDescriptors(await gb04Members());
    const descriptors = base.map((member) =>
      member.mimeType === 'application/json'
        ? member
        : { ...member, byteSize: sourceByteSize, crc32: sourceCrc32 },
    );
    const plan = await createDeterministicExportPlan({
      format: 'zip',
      members: descriptors,
      receipt: RECEIPT,
    });
    expect(plan.byteSize).toBeGreaterThan(128 * 1024 * 1024);

    let activeSources = 0;
    let maximumActiveSources = 0;
    let openedSources = 0;
    let observedByteSize = 0;
    for await (const chunk of streamDeterministicExport(plan, () =>
      (async function* () {
        openedSources += 1;
        activeSources += 1;
        maximumActiveSources = Math.max(maximumActiveSources, activeSources);
        try {
          for (let index = 0; index < chunksPerSource; index += 1) yield sourceChunk;
        } finally {
          activeSources -= 1;
        }
      })(),
    )) {
      observedByteSize += chunk.byteLength;
    }

    expect(observedByteSize).toBe(plan.byteSize);
    expect(openedSources).toBe(13);
    expect(maximumActiveSources).toBe(1);
    expect(activeSources).toBe(0);
  });

  it('fails a streamed archive when a pinned source changes after validation', async () => {
    const members = await gb04Members();
    const bytesByArtifactId = new Map(members.map((member) => [member.artifactId, member.bytes]));
    const plan = await createDeterministicExportPlan({
      format: 'zip',
      members: exportDescriptors(members),
      receipt: RECEIPT,
    });

    await expect(async () => {
      const streamed = streamDeterministicExport(plan, (artifactId) =>
        (async function* () {
          const bytes = bytesByArtifactId.get(artifactId);
          if (bytes === undefined) throw new TypeError('Fixture artifact is missing');
          yield artifactId === 'artifact-master-1' ? new Uint8Array(bytes.byteLength) : bytes;
        })(),
      );
      while (!(await streamed.next()).done) {
        // The sink intentionally retains no chunk.
      }
    }).rejects.toThrow('changed after validation');
  });
});
