declare const crypto: {
  readonly subtle: {
    digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer>;
  };
};

declare class TextEncoder {
  encode(value?: string): Uint8Array;
}

export const CANONICAL_ARTIFACT_VISIBILITY = 'private' as const;
export const ARTIFACT_LINEAGE_RELATIONSHIPS = [
  'input_to_output',
  'adaptation',
  'motion_source',
  'export_member',
  'revision_source',
] as const;

export type ArtifactVisibility = typeof CANONICAL_ARTIFACT_VISIBILITY;
export type ArtifactLineageRelationship = (typeof ARTIFACT_LINEAGE_RELATIONSHIPS)[number];

export type VerifiedProviderMeasurement =
  | Readonly<{
      kind: 'image';
      widthPixels: number;
      heightPixels: number;
    }>
  | Readonly<{
      kind: 'video';
      durationMilliseconds: number;
    }>;

export interface VerifiedProviderArtifact {
  readonly byteSize: number;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly measurement: VerifiedProviderMeasurement;
}

export interface DeterministicExportMember {
  readonly artifactId: string;
  readonly artifactKind: string;
  readonly nodeKey: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly accessibilityDescription: string;
  readonly measurement?: VerifiedProviderMeasurement;
  readonly copy?: Readonly<{
    readonly primaryText: string;
    readonly headline: string;
    readonly description: string;
  }>;
  readonly copyQaFindings?: readonly Readonly<{
    readonly code: string;
    readonly severity: 'hard' | 'soft';
    readonly message: string;
  }>[];
}

export interface DeterministicExportReceipt {
  readonly runId: string;
  readonly canvasRevisionId: string;
  readonly canvasRevisionHash: string;
  readonly quoteId: string;
  readonly runStatus: string;
  readonly reservation: Readonly<{
    amountMicros: number;
    capturedMicros: number;
    releasedMicros: number;
    refundedMicros: number;
    netMicros: number;
    settlementStatus: 'active' | 'partially_captured' | 'captured' | 'released' | 'refunded';
  }>;
  readonly providerJobs: readonly Readonly<{
    attemptId: string;
    provider: string;
    providerModelId: string;
    routeId: string;
    status: string;
    capturedMicros: number;
  }>[];
  readonly lineage: readonly Readonly<{
    parentArtifactId: string;
    childArtifactId: string;
    relationship: ArtifactLineageRelationship;
  }>[];
}

export interface DeterministicExport {
  readonly bytes: Uint8Array;
  readonly fileExtension: 'json' | 'zip';
  readonly mimeType: 'application/json' | 'application/zip';
}

export function requirePrivateArtifact(value: string): ArtifactVisibility {
  if (value !== CANONICAL_ARTIFACT_VISIBILITY) {
    throw new Error('Canonical media must remain private');
  }
  return value;
}

function ownedArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', ownedArrayBuffer(bytes))));
}

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u16le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
}

function u24le(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8) | ((bytes[offset + 2] ?? 0) << 16);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) * 0x1000000 +
    ((bytes[offset + 1] ?? 0) << 16) +
    ((bytes[offset + 2] ?? 0) << 8) +
    (bytes[offset + 3] ?? 0)
  );
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function pngDimensions(bytes: Uint8Array): Readonly<{ widthPixels: number; heightPixels: number }> {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (
    bytes.length < 24 ||
    signature.some((value, index) => bytes[index] !== value) ||
    ascii(bytes, 12, 4) !== 'IHDR'
  ) {
    throw new TypeError('Provider image bytes are not a valid PNG');
  }
  return { widthPixels: u32be(bytes, 16), heightPixels: u32be(bytes, 20) };
}

function jpegDimensions(
  bytes: Uint8Array,
): Readonly<{ widthPixels: number; heightPixels: number }> {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new TypeError('Provider image bytes are not a valid JPEG');
  }
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset];
    offset += 1;
    if (marker === undefined || marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const segmentLength = u16be(bytes, offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (startOfFrameMarkers.has(marker)) {
      if (segmentLength < 7) break;
      return {
        heightPixels: u16be(bytes, offset + 3),
        widthPixels: u16be(bytes, offset + 5),
      };
    }
    offset += segmentLength;
  }
  throw new TypeError('Provider JPEG dimensions could not be verified');
}

function webpDimensions(
  bytes: Uint8Array,
): Readonly<{ widthPixels: number; heightPixels: number }> {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP') {
    throw new TypeError('Provider image bytes are not a valid WebP');
  }
  const kind = ascii(bytes, 12, 4);
  if (kind === 'VP8X') {
    return {
      widthPixels: u24le(bytes, 24) + 1,
      heightPixels: u24le(bytes, 27) + 1,
    };
  }
  if (kind === 'VP8L' && bytes[20] === 0x2f) {
    return {
      widthPixels: 1 + (bytes[21] ?? 0) + (((bytes[22] ?? 0) & 0x3f) << 8),
      heightPixels:
        1 +
        (((bytes[22] ?? 0) & 0xc0) >> 6) +
        ((bytes[23] ?? 0) << 2) +
        (((bytes[24] ?? 0) & 0x0f) << 10),
    };
  }
  if (kind === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      widthPixels: u16le(bytes, 26) & 0x3fff,
      heightPixels: u16le(bytes, 28) & 0x3fff,
    };
  }
  throw new TypeError('Provider WebP dimensions could not be verified');
}

function u64beSafe(bytes: Uint8Array, offset: number): number {
  const high = u32be(bytes, offset);
  const low = u32be(bytes, offset + 4);
  const value = high * 0x1_0000_0000 + low;
  if (!Number.isSafeInteger(value)) throw new RangeError('MP4 duration exceeds safe precision');
  return value;
}

function mp4DurationMilliseconds(bytes: Uint8Array): number {
  if (bytes.length < 16) throw new TypeError('Provider video bytes are not a valid MP4');
  let moovStart = -1;
  let moovEnd = -1;
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    const size = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const boxEnd = size === 0 ? bytes.length : offset + size;
    if (size < 8 || boxEnd > bytes.length) break;
    if (type === 'moov') {
      moovStart = offset + 8;
      moovEnd = boxEnd;
      break;
    }
    offset = boxEnd;
  }
  if (moovStart < 0) throw new TypeError('Provider MP4 movie metadata is missing');

  offset = moovStart;
  while (offset + 8 <= moovEnd) {
    const size = u32be(bytes, offset);
    const type = ascii(bytes, offset + 4, 4);
    const boxEnd = offset + size;
    if (size < 8 || boxEnd > moovEnd) break;
    if (type === 'mvhd') {
      const data = offset + 8;
      const version = bytes[data];
      const timescaleOffset = version === 1 ? data + 20 : data + 12;
      const durationOffset = version === 1 ? data + 24 : data + 16;
      const timescale = u32be(bytes, timescaleOffset);
      const duration =
        version === 1 ? u64beSafe(bytes, durationOffset) : u32be(bytes, durationOffset);
      if (timescale <= 0 || duration <= 0) {
        throw new TypeError('Provider MP4 duration is invalid');
      }
      const milliseconds = Math.ceil((duration * 1000) / timescale);
      if (!Number.isSafeInteger(milliseconds) || milliseconds <= 0) {
        throw new TypeError('Provider MP4 duration is invalid');
      }
      return milliseconds;
    }
    offset = boxEnd;
  }
  throw new TypeError('Provider MP4 duration could not be verified');
}

function normalizedMimeType(value: string): string {
  const mimeType = value.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (mimeType.length < 1 || mimeType.length > 160) {
    throw new TypeError('Provider artifact content type is invalid');
  }
  return mimeType;
}

export async function verifyProviderArtifactBytes(
  bytes: Uint8Array,
  contentType: string,
): Promise<VerifiedProviderArtifact> {
  if (bytes.byteLength === 0 || !Number.isSafeInteger(bytes.byteLength)) {
    throw new TypeError('Provider artifact bytes are empty or too large');
  }
  const mimeType = normalizedMimeType(contentType);
  let measurement: VerifiedProviderMeasurement;
  if (mimeType === 'image/png') {
    measurement = { kind: 'image', ...pngDimensions(bytes) };
  } else if (mimeType === 'image/jpeg') {
    measurement = { kind: 'image', ...jpegDimensions(bytes) };
  } else if (mimeType === 'image/webp') {
    measurement = { kind: 'image', ...webpDimensions(bytes) };
  } else if (mimeType === 'video/mp4') {
    measurement = { kind: 'video', durationMilliseconds: mp4DurationMilliseconds(bytes) };
  } else {
    throw new TypeError(`Provider artifact MIME type is unsupported: ${mimeType}`);
  }
  if (
    (measurement.kind === 'image' &&
      (measurement.widthPixels <= 0 || measurement.heightPixels <= 0)) ||
    (measurement.kind === 'video' && measurement.durationMilliseconds <= 0)
  ) {
    throw new TypeError('Provider artifact measurement is invalid');
  }
  return {
    byteSize: bytes.byteLength,
    contentHash: await sha256Hex(bytes),
    mimeType,
    measurement,
  };
}

export function providerArtifactObjectKey(
  input: Readonly<{
    workspaceId: string;
    runId: string;
    attemptId: string;
  }>,
): string {
  return `workspaces/${input.workspaceId}/runs/${input.runId}/attempts/${input.attemptId}/provider-output`;
}

function extensionForMimeType(mimeType: string): string {
  const extensions: Readonly<Record<string, string>> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'application/json': 'json',
  };
  return extensions[mimeType] ?? 'bin';
}

type ExportQaStatus = 'passed' | 'failed' | 'not_evaluated';

interface SemanticExportMember {
  readonly member: DeterministicExportMember;
  readonly concept: number;
  readonly role: 'copy' | 'master' | 'adaptation' | 'motion';
  readonly placement:
    'copy' | 'master' | 'feed-4x5' | 'square-1x1' | 'stories-9x16' | 'reels-motion-9x16';
  readonly filename: string;
}

interface HashedExportFile {
  readonly filename: string;
  readonly kind: 'asset' | 'copy' | 'qa_report' | 'receipt';
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly contentHash: string;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function conceptLabel(concept: number): string {
  return `concept-${String(concept).padStart(2, '0')}`;
}

function positiveIndex(value: string, field: string): number {
  const index = Number(value);
  if (!Number.isSafeInteger(index) || index <= 0 || index > 99) {
    throw new TypeError(`Export member ${field} is outside the supported launch-pack range`);
  }
  return index;
}

const GB04_EXPORT_NODE_KEYS = [
  'copy-1',
  'copy-2',
  'copy-3',
  'master-1',
  'master-2',
  'master-3',
  'adaptation-1-1',
  'adaptation-1-2',
  'adaptation-1-3',
  'adaptation-2-1',
  'adaptation-2-2',
  'adaptation-2-3',
  'adaptation-3-1',
  'adaptation-3-2',
  'adaptation-3-3',
  'motion-1',
] as const;

const GB04_EXPORT_NODE_KEY_SET = new Set<string>(GB04_EXPORT_NODE_KEYS);
const GB04_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function assertExactGb04MemberSet(members: readonly DeterministicExportMember[]): void {
  const counts = new Map<string, number>();
  for (const member of members) {
    counts.set(member.nodeKey, (counts.get(member.nodeKey) ?? 0) + 1);
  }
  const missing = GB04_EXPORT_NODE_KEYS.filter((nodeKey) => !counts.has(nodeKey));
  const unexpected = [...counts.keys()]
    .filter((nodeKey) => !GB04_EXPORT_NODE_KEY_SET.has(nodeKey))
    .sort(compareText);
  const duplicate = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([nodeKey]) => nodeKey)
    .sort(compareText);
  if (missing.length === 0 && unexpected.length === 0 && duplicate.length === 0) return;
  throw new TypeError(
    `GB-04 export requires the exact launch-pack member set; missing=[${missing.join(',')}]; unexpected=[${unexpected.join(',')}]; duplicate=[${duplicate.join(',')}]`,
  );
}

function requireGb04ImageMimeType(member: DeterministicExportMember): void {
  if (!GB04_IMAGE_MIME_TYPES.has(member.mimeType)) {
    throw new TypeError(
      `Visual export member ${member.nodeKey} must use image/jpeg, image/png, or image/webp`,
    );
  }
}

function semanticExportMember(member: DeterministicExportMember): SemanticExportMember {
  const copy = /^copy-(\d+)$/u.exec(member.nodeKey);
  if (copy !== null) {
    const concept = positiveIndex(copy[1] ?? '', 'copy concept');
    if (member.mimeType !== 'application/json' || member.copy === undefined) {
      throw new TypeError(`Copy export member ${member.nodeKey} is not normalized JSON copy`);
    }
    return {
      member,
      concept,
      role: 'copy',
      placement: 'copy',
      filename: `copy/${conceptLabel(concept)}.json`,
    };
  }

  const master = /^master-(\d+)$/u.exec(member.nodeKey);
  if (master !== null) {
    const concept = positiveIndex(master[1] ?? '', 'master concept');
    requireGb04ImageMimeType(member);
    return {
      member,
      concept,
      role: 'master',
      placement: 'master',
      filename: `assets/${conceptLabel(concept)}/master.${extensionForMimeType(member.mimeType)}`,
    };
  }

  const adaptation = /^adaptation-(\d+)-([123])$/u.exec(member.nodeKey);
  if (adaptation !== null) {
    const concept = positiveIndex(adaptation[1] ?? '', 'adaptation concept');
    requireGb04ImageMimeType(member);
    const placementIndex = Number(adaptation[2]);
    const placement =
      placementIndex === 1 ? 'feed-4x5' : placementIndex === 2 ? 'square-1x1' : 'stories-9x16';
    return {
      member,
      concept,
      role: 'adaptation',
      placement,
      filename: `assets/${conceptLabel(concept)}/${placement}.${extensionForMimeType(member.mimeType)}`,
    };
  }

  const motion = /^motion-(\d+)$/u.exec(member.nodeKey);
  if (motion !== null) {
    const concept = positiveIndex(motion[1] ?? '', 'motion concept');
    if (concept !== 1) {
      throw new TypeError('The Reels motion placement is reserved for concept 01');
    }
    if (member.mimeType !== 'video/mp4') {
      throw new TypeError('Reels motion export member motion-1 must use video/mp4');
    }
    return {
      member,
      concept,
      role: 'motion',
      placement: 'reels-motion-9x16',
      filename: `assets/${conceptLabel(concept)}/reels-motion-9x16.${extensionForMimeType(member.mimeType)}`,
    };
  }

  throw new TypeError(`Export member ${member.nodeKey} has no buyer-facing launch-pack role`);
}

function copyBytes(member: SemanticExportMember): Uint8Array {
  const copy = member.member.copy;
  if (member.role !== 'copy' || copy === undefined) {
    throw new TypeError(`Export member ${member.member.nodeKey} is not a copy set`);
  }
  return jsonBytes({
    schema_version: 1,
    concept_id: conceptLabel(member.concept),
    primary_text: copy.primaryText,
    headline: copy.headline,
    description: copy.description,
    source_artifact: {
      artifact_id: member.member.artifactId,
      content_hash: member.member.contentHash,
    },
  });
}

function receiptDocument(receipt: DeterministicExportReceipt) {
  return {
    schema_version: 1,
    run_id: receipt.runId,
    canvas_revision_id: receipt.canvasRevisionId,
    canvas_revision_hash: receipt.canvasRevisionHash,
    quote_id: receipt.quoteId,
    run_status: receipt.runStatus,
    reservation: {
      amount_micros: String(receipt.reservation.amountMicros),
      captured_micros: String(receipt.reservation.capturedMicros),
      released_micros: String(receipt.reservation.releasedMicros),
      refunded_micros: String(receipt.reservation.refundedMicros),
      net_micros: String(receipt.reservation.netMicros),
      settlement_status: receipt.reservation.settlementStatus,
    },
    provider_jobs: [...receipt.providerJobs]
      .sort((left, right) => compareText(left.attemptId, right.attemptId))
      .map((job) => ({
        attempt_id: job.attemptId,
        provider: job.provider,
        provider_model_id: job.providerModelId,
        route_id: job.routeId,
        status: job.status,
        captured_micros: String(job.capturedMicros),
      })),
    lineage: [...receipt.lineage]
      .sort((left, right) =>
        compareText(
          `${left.childArtifactId}:${left.parentArtifactId}:${left.relationship}`,
          `${right.childArtifactId}:${right.parentArtifactId}:${right.relationship}`,
        ),
      )
      .map((entry) => ({
        parent_artifact_id: entry.parentArtifactId,
        child_artifact_id: entry.childArtifactId,
        relationship: entry.relationship,
      })),
  };
}

function expectedAdaptationDimensions(placement: SemanticExportMember['placement']): Readonly<{
  widthPixels: number;
  heightPixels: number;
}> | null {
  if (placement === 'feed-4x5') return { widthPixels: 1080, heightPixels: 1350 };
  if (placement === 'square-1x1') return { widthPixels: 1080, heightPixels: 1080 };
  if (placement === 'stories-9x16') return { widthPixels: 1080, heightPixels: 1920 };
  return null;
}

function qaReport(
  runId: string,
  members: readonly SemanticExportMember[],
): Readonly<{
  schema_version: 1;
  run_id: string;
  overall_status: ExportQaStatus;
  checks: readonly Readonly<Record<string, unknown>>[];
}> {
  const checks: Readonly<Record<string, unknown>>[] = [];
  for (const semantic of members) {
    const { member } = semantic;
    checks.push({
      check: 'source_artifact_integrity',
      scope: semantic.filename,
      status: 'passed',
      evidence: {
        artifact_id: member.artifactId,
        sha256: member.contentHash,
        byte_size: member.bytes.byteLength,
        mime_type: member.mimeType,
      },
    });

    if (semantic.role === 'adaptation') {
      const expected = expectedAdaptationDimensions(semantic.placement);
      const measurement = member.measurement;
      if (expected === null || measurement?.kind !== 'image') {
        checks.push({
          check: 'required_dimensions',
          scope: semantic.filename,
          status: 'not_evaluated',
          reason: 'Verified image dimensions were not available to the export builder.',
        });
      } else {
        const passed =
          measurement.widthPixels === expected.widthPixels &&
          measurement.heightPixels === expected.heightPixels;
        checks.push({
          check: 'required_dimensions',
          scope: semantic.filename,
          status: passed ? 'passed' : 'failed',
          expected: {
            width_pixels: expected.widthPixels,
            height_pixels: expected.heightPixels,
          },
          observed: {
            width_pixels: measurement.widthPixels,
            height_pixels: measurement.heightPixels,
          },
        });
      }
    } else if (semantic.role === 'motion') {
      const measurement = member.measurement;
      if (measurement?.kind !== 'video') {
        checks.push({
          check: 'required_duration',
          scope: semantic.filename,
          status: 'not_evaluated',
          reason: 'Verified video duration was not available to the export builder.',
        });
      } else {
        const passed =
          measurement.durationMilliseconds >= 6_000 && measurement.durationMilliseconds <= 10_000;
        checks.push({
          check: 'required_duration',
          scope: semantic.filename,
          status: passed ? 'passed' : 'failed',
          expected: { minimum_milliseconds: 6_000, maximum_milliseconds: 10_000 },
          observed: { duration_milliseconds: measurement.durationMilliseconds },
        });
      }
      checks.push({
        check: 'required_dimensions',
        scope: semantic.filename,
        status: 'not_evaluated',
        reason: 'The current verified MP4 measurement records duration but not frame dimensions.',
      });
    } else if (semantic.role === 'master') {
      checks.push({
        check: 'required_dimensions',
        scope: semantic.filename,
        status: 'not_evaluated',
        reason: 'P0 does not pin a buyer-facing master-static pixel size.',
      });
    } else {
      const findings = member.copyQaFindings;
      checks.push({
        check: 'copy_structure',
        scope: semantic.filename,
        status:
          member.copy !== undefined &&
          member.copy.primaryText.length > 0 &&
          member.copy.headline.length > 0
            ? 'passed'
            : 'failed',
      });
      checks.push({
        check: 'copy_format_policy',
        scope: semantic.filename,
        status:
          findings === undefined
            ? 'not_evaluated'
            : findings.some((finding) => finding.severity === 'hard')
              ? 'failed'
              : 'passed',
        ...(findings === undefined
          ? { reason: 'No deterministic copy-policy evaluation was supplied.' }
          : { findings }),
      });
    }
  }

  checks.push(
    {
      check: 'readable_safe_areas',
      scope: 'launch_pack',
      status: 'not_evaluated',
      reason: 'No deterministic visual safe-area evaluator is registered for this export.',
    },
    {
      check: 'brand_constraints',
      scope: 'launch_pack',
      status: 'not_evaluated',
      reason: 'Brand compliance requires a recorded evaluator decision that is not available here.',
    },
    {
      check: 'supplied_claims',
      scope: 'launch_pack',
      status: 'not_evaluated',
      reason: 'The export builder does not infer claim support from generated media or copy.',
    },
    {
      check: 'prohibited_claims',
      scope: 'launch_pack',
      status: 'not_evaluated',
      reason: 'No durable prohibited-claim evaluator result was supplied to this export.',
    },
    {
      check: 'missing_evidence',
      scope: 'launch_pack',
      status: 'not_evaluated',
      reason:
        'Missing-evidence review remains a human evaluation until a durable evaluator exists.',
    },
  );
  const statuses = checks.map((check) => check.status);
  return {
    schema_version: 1,
    run_id: runId,
    overall_status: statuses.includes('failed')
      ? 'failed'
      : statuses.includes('not_evaluated')
        ? 'not_evaluated'
        : 'passed',
    checks,
  };
}

async function hashedFile(input: Omit<HashedExportFile, 'contentHash'>): Promise<HashedExportFile> {
  return { ...input, contentHash: await sha256Hex(input.bytes) };
}

function jsonBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(value)}\n`);
}

function u16leBytes(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32leBytes(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  );
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffff_ffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb8_8320 : 0);
    }
  }
  return (crc ^ 0xffff_ffff) >>> 0;
}

function deterministicZip(files: readonly Readonly<{ name: string; bytes: Uint8Array }>[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;
  const utf8Flag = 0x0800;
  const dosDate = 0x0021;

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const checksum = crc32(file.bytes);
    const localHeader = concatenate([
      u32leBytes(0x04034b50),
      u16leBytes(20),
      u16leBytes(utf8Flag),
      u16leBytes(0),
      u16leBytes(0),
      u16leBytes(dosDate),
      u32leBytes(checksum),
      u32leBytes(file.bytes.byteLength),
      u32leBytes(file.bytes.byteLength),
      u16leBytes(name.byteLength),
      u16leBytes(0),
      name,
    ]);
    localParts.push(localHeader, file.bytes);
    centralParts.push(
      concatenate([
        u32leBytes(0x02014b50),
        u16leBytes(20),
        u16leBytes(20),
        u16leBytes(utf8Flag),
        u16leBytes(0),
        u16leBytes(0),
        u16leBytes(dosDate),
        u32leBytes(checksum),
        u32leBytes(file.bytes.byteLength),
        u32leBytes(file.bytes.byteLength),
        u16leBytes(name.byteLength),
        u16leBytes(0),
        u16leBytes(0),
        u16leBytes(0),
        u16leBytes(0),
        u32leBytes(0),
        u32leBytes(localOffset),
        name,
      ]),
    );
    localOffset += localHeader.byteLength + file.bytes.byteLength;
  }
  const central = concatenate(centralParts);
  const end = concatenate([
    u32leBytes(0x06054b50),
    u16leBytes(0),
    u16leBytes(0),
    u16leBytes(files.length),
    u16leBytes(files.length),
    u32leBytes(central.byteLength),
    u32leBytes(localOffset),
    u16leBytes(0),
  ]);
  return concatenate([...localParts, central, end]);
}

export async function createDeterministicExport(
  input: Readonly<{
    format: 'json' | 'zip';
    members: readonly DeterministicExportMember[];
    receipt: DeterministicExportReceipt;
  }>,
): Promise<DeterministicExport> {
  assertExactGb04MemberSet(input.members);
  const members = input.members
    .map(semanticExportMember)
    .sort((left, right) => compareText(left.filename, right.filename));
  if (members.length === 0) throw new TypeError('An export requires at least one approved member');
  if (new Set(members.map(({ member }) => member.artifactId)).size !== members.length) {
    throw new TypeError('An export cannot contain the same approved artifact more than once');
  }
  if (new Set(members.map((member) => member.filename)).size !== members.length) {
    throw new TypeError('Approved export members resolve to duplicate buyer-facing filenames');
  }

  const buyerFiles = await Promise.all(
    members.map(async (semantic): Promise<HashedExportFile> => {
      const sourceHash = await sha256Hex(semantic.member.bytes);
      if (sourceHash !== semantic.member.contentHash) {
        throw new TypeError(
          `Export member ${semantic.member.artifactId} does not match its immutable content hash`,
        );
      }
      return await hashedFile({
        filename: semantic.filename,
        kind: semantic.role === 'copy' ? 'copy' : 'asset',
        mimeType: semantic.role === 'copy' ? 'application/json' : semantic.member.mimeType,
        bytes: semantic.role === 'copy' ? copyBytes(semantic) : semantic.member.bytes,
      });
    }),
  );
  const receipt = receiptDocument(input.receipt);
  const receiptFile = await hashedFile({
    filename: 'receipt.json',
    kind: 'receipt',
    mimeType: 'application/json',
    bytes: jsonBytes(receipt),
  });
  const qa = qaReport(input.receipt.runId, members);
  const qaFile = await hashedFile({
    filename: 'qa-report.json',
    kind: 'qa_report',
    mimeType: 'application/json',
    bytes: jsonBytes(qa),
  });
  const nonManifestFiles = [...buyerFiles, qaFile, receiptFile].sort((left, right) =>
    compareText(left.filename, right.filename),
  );
  const manifest = {
    schema_version: 2,
    run_id: input.receipt.runId,
    assets: members.map((semantic) => {
      const file = buyerFiles.find((candidate) => candidate.filename === semantic.filename);
      if (file === undefined) throw new TypeError('Export member file mapping is incomplete');
      return {
        artifact_id: semantic.member.artifactId,
        artifact_kind: semantic.member.artifactKind,
        node_key: semantic.member.nodeKey,
        concept_id: conceptLabel(semantic.concept),
        role: semantic.role,
        placement: semantic.placement,
        filename: semantic.filename,
        mime_type: file.mimeType,
        byte_size: file.bytes.byteLength,
        sha256: file.contentHash,
        source_content_hash: semantic.member.contentHash,
        accessibility_description: semantic.member.accessibilityDescription,
      };
    }),
    files: nonManifestFiles.map((file) => ({
      filename: file.filename,
      kind: file.kind,
      mime_type: file.mimeType,
      byte_size: file.bytes.byteLength,
      sha256: file.contentHash,
    })),
    receipt: {
      ...receipt,
      filename: receiptFile.filename,
      sha256: receiptFile.contentHash,
    },
    qa_report: {
      filename: qaFile.filename,
      sha256: qaFile.contentHash,
      overall_status: qa.overall_status,
    },
  };
  const manifestBytes = jsonBytes(manifest);
  if (input.format === 'json') {
    return { bytes: manifestBytes, fileExtension: 'json', mimeType: 'application/json' };
  }
  const files = [
    { name: 'manifest.json', bytes: manifestBytes },
    ...nonManifestFiles.map((file) => ({ name: file.filename, bytes: file.bytes })),
  ];
  return {
    bytes: deterministicZip(files),
    fileExtension: 'zip',
    mimeType: 'application/zip',
  };
}

export async function exportArtifactObjectKey(
  input: Readonly<{
    workspaceId: string;
    runId: string;
    format: 'json' | 'zip';
    bytes: Uint8Array;
  }>,
): Promise<string> {
  const contentHash = await sha256Hex(input.bytes);
  return `workspaces/${input.workspaceId}/runs/${input.runId}/exports/${contentHash}.${input.format}`;
}

export * from './access-token';
