import { extractRepresentativeAssertions, sniffDocumentMediaType } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { PrivilegedSourceMachinePort } from './source-machine';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function runBrandExtraction(input: {
  readonly bindings: CoreBindings;
  readonly workspaceId: string;
  readonly brandId: string;
  readonly sourceId: string;
  readonly requestId: string;
  readonly dbFetch?: typeof fetch;
}): Promise<unknown> {
  const key = `brand-sources/${input.workspaceId}/${input.brandId}/${input.sourceId}`;
  const object = await input.bindings.MEDIA_BUCKET.get(key);
  if (object === null) throw new Error('SOURCE_BYTES_MISSING');
  const bytes = new Uint8Array(await object.arrayBuffer());
  const declared =
    object.httpMetadata?.contentType?.split(';', 1)[0]?.trim().toLowerCase() ?? 'text/html';
  const sniff = sniffDocumentMediaType(bytes, declared);
  if (sniff === 'unsupported' || sniff === 'malformed') throw new Error('SOURCE_MALFORMED');
  const text = new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes);
  const assertions = extractRepresentativeAssertions({ mediaType: sniff, text });
  const machine = new PrivilegedSourceMachinePort(input.bindings, input.dbFetch);
  return await machine.recordExtraction(input.sourceId, assertions, input.requestId);
}

export function extractionNeedsBytes(data: unknown): boolean {
  return isRecord(data) && data.extract_pending === true;
}
