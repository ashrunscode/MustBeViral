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
  readonly contentHash: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
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
  }>;
  readonly providerJobs: readonly Readonly<{
    attemptId: string;
    provider: string;
    providerModelId: string;
    routeId: string;
    status: string;
    captureMicros: number;
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

export function createDeterministicExport(
  input: Readonly<{
    format: 'json' | 'zip';
    members: readonly DeterministicExportMember[];
    receipt: DeterministicExportReceipt;
  }>,
): DeterministicExport {
  const members = [...input.members].sort((left, right) =>
    left.artifactId.localeCompare(right.artifactId),
  );
  if (members.length === 0) throw new TypeError('An export requires at least one approved member');
  const manifest = {
    schema_version: 1,
    run_id: input.receipt.runId,
    assets: members.map((member, index) => ({
      artifact_id: member.artifactId,
      artifact_kind: member.artifactKind,
      filename: `assets/${String(index + 1).padStart(3, '0')}-${member.artifactId}.${extensionForMimeType(member.mimeType)}`,
      mime_type: member.mimeType,
      byte_size: member.bytes.byteLength,
      content_hash: member.contentHash,
    })),
    receipt: {
      canvas_revision_id: input.receipt.canvasRevisionId,
      canvas_revision_hash: input.receipt.canvasRevisionHash,
      quote_id: input.receipt.quoteId,
      run_status: input.receipt.runStatus,
      reservation: input.receipt.reservation,
      provider_jobs: [...input.receipt.providerJobs].sort((left, right) =>
        left.attemptId.localeCompare(right.attemptId),
      ),
      lineage: [...input.receipt.lineage].sort((left, right) =>
        `${left.childArtifactId}:${left.parentArtifactId}:${left.relationship}`.localeCompare(
          `${right.childArtifactId}:${right.parentArtifactId}:${right.relationship}`,
        ),
      ),
    },
  };
  const manifestBytes = jsonBytes(manifest);
  if (input.format === 'json') {
    return { bytes: manifestBytes, fileExtension: 'json', mimeType: 'application/json' };
  }
  const files = [
    { name: 'manifest.json', bytes: manifestBytes },
    ...members.map((member, index) => ({
      name: manifest.assets[index]?.filename ?? `assets/${String(index + 1)}.bin`,
      bytes: member.bytes,
    })),
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
