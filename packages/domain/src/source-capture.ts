export const sourceJobKinds = ['website', 'document', 'manual'] as const;
export const sourceJobStatuses = [
  'queued',
  'capturing',
  'awaiting_bytes',
  'captured',
  'duplicate',
  'rejected',
  'failed',
] as const;
export const sourceCaptureMethods = ['https_get', 'document_upload', 'manual'] as const;
export const knowledgeCandidateFields = [
  'page_title',
  'meta_description',
  'canonical_url',
  'heading',
  'visible_excerpt',
  'jsonld_text',
  'document_filename',
  'unknown_gap',
] as const;
export const knowledgeCandidateStatuses = ['observed', 'unknown', 'corrected', 'disputed'] as const;
export const knowledgeCandidateMethods = [
  'html_title',
  'meta_description',
  'canonical_link',
  'heading',
  'visible_text',
  'jsonld_text',
  'document_text',
  'manual',
] as const;
export const supportedDocumentMediaTypes = ['text/plain', 'text/markdown', 'text/html'] as const;
export const sourceFailureCodes = [
  'SOURCE_UNSAFE',
  'SOURCE_UNSUPPORTED',
  'SOURCE_MALFORMED',
  'SOURCE_TOO_LARGE',
  'SOURCE_TIMEOUT',
  'SOURCE_UNREACHABLE',
  'SOURCE_INTERRUPTED',
  'SOURCE_EGRESS_UNAVAILABLE',
] as const;

export type SourceJobKind = (typeof sourceJobKinds)[number];
export type SourceJobStatus = (typeof sourceJobStatuses)[number];
export type SourceCaptureMethod = (typeof sourceCaptureMethods)[number];
export type KnowledgeCandidateField = (typeof knowledgeCandidateFields)[number];
export type KnowledgeCandidateStatus = (typeof knowledgeCandidateStatuses)[number];
export type KnowledgeCandidateMethod = (typeof knowledgeCandidateMethods)[number];
export type SupportedDocumentMediaType = (typeof supportedDocumentMediaTypes)[number];
export type SourceFailureCode = (typeof sourceFailureCodes)[number];

export type SourceJobEvent =
  'lease' | 'await_bytes' | 'persist' | 'duplicate' | 'reject' | 'fail' | 'requeue';

const sourceJobTransitions: Readonly<
  Record<SourceJobStatus, Readonly<Partial<Record<SourceJobEvent, SourceJobStatus>>>>
> = {
  queued: { lease: 'capturing', await_bytes: 'awaiting_bytes', reject: 'rejected', fail: 'failed' },
  capturing: {
    persist: 'captured',
    duplicate: 'duplicate',
    reject: 'rejected',
    fail: 'failed',
    requeue: 'queued',
  },
  awaiting_bytes: { lease: 'capturing', reject: 'rejected', fail: 'failed' },
  captured: {},
  duplicate: {},
  rejected: {},
  failed: { lease: 'capturing' },
};

export class SourceJobTransitionError extends Error {
  readonly code = 'ILLEGAL_SOURCE_JOB_TRANSITION';
  constructor(
    readonly status: SourceJobStatus,
    readonly event: SourceJobEvent,
  ) {
    super(`Illegal source job transition: ${status} + ${event}`);
    this.name = 'SourceJobTransitionError';
  }
}

export function transitionSourceJob(
  status: SourceJobStatus,
  event: SourceJobEvent,
): SourceJobStatus {
  const next = sourceJobTransitions[status][event];
  if (next === undefined) throw new SourceJobTransitionError(status, event);
  return next;
}

export function isTerminalSourceJobStatus(status: SourceJobStatus): boolean {
  return status === 'captured' || status === 'duplicate' || status === 'rejected';
}

export function isSupportedDocumentMediaType(value: string): value is SupportedDocumentMediaType {
  return (supportedDocumentMediaTypes as readonly string[]).includes(value);
}

function containsForbiddenControl(text: string): boolean {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code === 0x09 || code === 0x0a || code === 0x0d) continue;
    if (code <= 0x1f) return true;
  }
  return false;
}

export function sniffDocumentMediaType(
  bytes: Uint8Array,
  declared: string,
): SupportedDocumentMediaType | 'unsupported' | 'malformed' {
  if (bytes.length === 0) return 'malformed';
  const head = bytes.subarray(0, Math.min(bytes.length, 8));
  const ascii = String.fromCharCode(...head);
  if (ascii.startsWith('%PDF') || ascii.startsWith('PK')) return 'unsupported';
  if (head[0] === 0xd0 && head[1] === 0xcf) return 'unsupported';
  if (bytes.includes(0)) return 'malformed';
  const type = declared.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (!isSupportedDocumentMediaType(type)) return 'unsupported';
  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    return 'malformed';
  }
  if (containsForbiddenControl(decoded)) return 'malformed';
  if (type === 'text/html' && !/<[A-Za-z!/]/u.test(decoded.slice(0, 1024))) return 'malformed';
  if (decoded.trim().length === 0) return 'malformed';
  return type;
}

export function websiteContentTypeAllowed(contentType: string | null): boolean {
  if (contentType === null || contentType.length === 0) return true;
  const type = contentType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return type === 'text/html' || type === 'application/xhtml+xml';
}
