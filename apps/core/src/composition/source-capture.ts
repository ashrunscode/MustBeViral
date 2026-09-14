import {
  SOURCE_CAPTURE_DEADLINE_MS,
  SOURCE_CAPTURE_MAX_BYTES,
  SOURCE_CAPTURE_MAX_REDIRECTS,
  captureLogHost,
  classifyPublicHttpsUrl,
  classifyRedirectTarget,
  sniffDocumentMediaType,
  websiteContentTypeAllowed,
} from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { extractKnowledgeCandidates } from './source-extract';
import {
  createSourceCaptureEgress,
  SourceCaptureEgressUnavailableError,
  type SourceCaptureEgress,
} from './source-egress';
import { PrivilegedSourceMachinePort, SourceMachineError } from './source-machine';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const digest = await crypto.subtle.digest('SHA-256', copy);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function ignoreLater(promise: Promise<unknown>): void {
  void promise.then(
    () => undefined,
    () => undefined,
  );
}

function cancelBestEffort(cancel: () => Promise<unknown>): void {
  ignoreLater(cancel());
}

async function raceAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw new SourceMachineError('SOURCE_TIMEOUT', true);
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new SourceMachineError('SOURCE_TIMEOUT', true));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, aborted]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
}

export async function readBoundedStream(
  stream: ReadableStream<Uint8Array> | null,
  signal: AbortSignal,
  declaredLength?: number,
): Promise<Uint8Array> {
  if (
    declaredLength !== undefined &&
    Number.isFinite(declaredLength) &&
    declaredLength > SOURCE_CAPTURE_MAX_BYTES
  ) {
    throw new SourceMachineError('SOURCE_TOO_LARGE', false);
  }
  if (stream === null) return new Uint8Array();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new SourceMachineError('SOURCE_TIMEOUT', true);
      const result = await raceAbort(reader.read(), signal);
      if (result.done) break;
      if (!result.value) continue;
      size += result.value.byteLength;
      if (size > SOURCE_CAPTURE_MAX_BYTES) throw new SourceMachineError('SOURCE_TOO_LARGE', false);
      chunks.push(result.value);
    }
  } catch (error) {
    cancelBestEffort(() => reader.cancel());
    throw error;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Already cancelled or released after overflow/timeout/redirect.
    }
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function readBoundedBody(response: Response, signal: AbortSignal): Promise<Uint8Array> {
  const length = Number(response.headers.get('content-length'));
  return await readBoundedStream(
    response.body,
    signal,
    Number.isFinite(length) ? length : undefined,
  );
}

function discardBody(response: Response): void {
  if (response.body) cancelBestEffort(() => response.body!.cancel());
}

export async function fetchPublicWebsite(
  egress: SourceCaptureEgress,
  requestUrl: string,
  signal: AbortSignal,
): Promise<
  Readonly<{
    bytes: Uint8Array;
    finalUrl: string;
    status: number;
    mediaType: string;
    hops: readonly Record<string, string | number>[];
  }>
> {
  const classified = classifyPublicHttpsUrl(requestUrl);
  if (!classified.ok) throw new SourceMachineError('SOURCE_UNSAFE', false);
  let current = classified.href;
  const hops: Record<string, string | number>[] = [];
  for (let i = 0; i <= SOURCE_CAPTURE_MAX_REDIRECTS; i += 1) {
    let response: Response;
    const pending = egress.fetch(current, {
      method: 'GET',
      headers: {
        accept: 'text/html,application/xhtml+xml;q=0.9',
        'user-agent': 'MustBeViralBrandCapture/1.0',
      },
      redirect: 'manual',
      signal,
    });
    ignoreLater(
      pending.then((late) => {
        if (signal.aborted) discardBody(late);
      }),
    );
    try {
      response = await raceAbort(pending, signal);
    } catch (error) {
      if (error instanceof SourceMachineError && error.code === 'SOURCE_TIMEOUT') throw error;
      if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
        throw new SourceMachineError('SOURCE_TIMEOUT', true);
      }
      throw new SourceMachineError('SOURCE_UNREACHABLE', true);
    }
    if (response.status >= 300 && response.status < 400) {
      discardBody(response);
      if (i === SOURCE_CAPTURE_MAX_REDIRECTS) throw new SourceMachineError('SOURCE_UNSAFE', false);
      const next = classifyRedirectTarget(current, response.headers.get('location'));
      if (!next.ok) throw new SourceMachineError('SOURCE_UNSAFE', false);
      hops.push({ from: captureLogHost(current), to: next.hostname, status: response.status });
      current = next.href;
      continue;
    }
    if (response.status !== 200) {
      discardBody(response);
      throw new SourceMachineError('SOURCE_UNREACHABLE', true);
    }
    if (!websiteContentTypeAllowed(response.headers.get('content-type'))) {
      discardBody(response);
      throw new SourceMachineError('SOURCE_UNSUPPORTED', false);
    }
    const bytes = await readBoundedBody(response, signal);
    if (bytes.length === 0) throw new SourceMachineError('SOURCE_MALFORMED', false);
    const sniff = sniffDocumentMediaType(bytes, 'text/html');
    if (sniff === 'unsupported') throw new SourceMachineError('SOURCE_UNSUPPORTED', false);
    if (sniff === 'malformed') throw new SourceMachineError('SOURCE_MALFORMED', false);
    return { bytes, finalUrl: current, status: 200, mediaType: 'text/html', hops };
  }
  throw new SourceMachineError('SOURCE_UNSAFE', false);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function receiptKeepsNewSource(receipt: unknown, sourceId: string): boolean {
  if (!isRecord(receipt) || !isRecord(receipt.job)) return false;
  return receipt.job.status === 'captured' && receipt.job.source_id === sourceId;
}

function receiptExplicitlyUnreferenced(receipt: unknown, sourceId: string): boolean {
  if (!isRecord(receipt) || !isRecord(receipt.job)) return false;
  if (receiptKeepsNewSource(receipt, sourceId)) return false;
  const status = receipt.job.status;
  return (
    status === 'duplicate' || status === 'rejected' || status === 'failed' || status === 'capturing'
  );
}

function deleteOwnedKeyBestEffort(bucket: R2Bucket, key: string): void {
  cancelBestEffort(() => bucket.delete(key));
}

export async function persistCapturedSource(input: {
  readonly bindings: CoreBindings;
  readonly jobId: string;
  readonly workspaceId: string;
  readonly brandId: string;
  readonly kind: 'website' | 'document';
  readonly originUrl: string;
  readonly finalUrl: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
  readonly filename?: string;
  readonly httpStatus?: number;
  readonly hops?: readonly Record<string, string | number>[];
  readonly requestId: string;
  readonly expectedAttemptCount: number;
  readonly dbFetch?: typeof fetch;
}): Promise<unknown> {
  const sourceId = crypto.randomUUID();
  const objectKey = `brand-sources/${input.workspaceId}/${input.brandId}/${sourceId}`;
  const candidates = await extractKnowledgeCandidates({
    kind: input.kind,
    mediaType: input.mediaType,
    bytes: input.bytes,
    ...(input.filename === undefined ? {} : { filename: input.filename }),
  });
  await input.bindings.MEDIA_BUCKET.put(objectKey, input.bytes, {
    httpMetadata: { contentType: input.mediaType },
  });
  const machine = new PrivilegedSourceMachinePort(input.bindings, input.dbFetch);
  const receipt = await machine.recordCapture(
    input.jobId,
    {
      source_id: sourceId,
      origin_url: input.originUrl,
      final_url: input.finalUrl,
      media_type: input.mediaType,
      byte_size: input.bytes.byteLength,
      content_sha256: await sha256Hex(input.bytes),
      r2_key: objectKey,
      http_status: input.httpStatus ?? 200,
      redirect_hops: input.hops ?? [],
      captured_at: new Date().toISOString(),
      candidates,
    },
    input.requestId,
    input.expectedAttemptCount,
  );
  if (receiptExplicitlyUnreferenced(receipt, sourceId)) {
    deleteOwnedKeyBestEffort(input.bindings.MEDIA_BUCKET, objectKey);
  }
  return receipt;
}

export async function runWebsiteCapture(input: {
  readonly bindings: CoreBindings;
  readonly jobId: string;
  readonly workspaceId: string;
  readonly brandId: string;
  readonly url: string;
  readonly requestId: string;
  readonly expectedAttemptCount: number;
  readonly dbFetch?: typeof fetch;
  readonly captureEgress?: SourceCaptureEgress;
}): Promise<unknown> {
  const classified = classifyPublicHttpsUrl(input.url);
  const machine = new PrivilegedSourceMachinePort(input.bindings, input.dbFetch);
  if (!classified.ok) {
    return await machine.failJob(
      input.jobId,
      'SOURCE_UNSAFE',
      input.requestId,
      input.expectedAttemptCount,
    );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_CAPTURE_DEADLINE_MS);
  try {
    const egress = input.captureEgress ?? createSourceCaptureEgress(input.bindings);
    const fetched = await fetchPublicWebsite(egress, classified.href, controller.signal);
    return await persistCapturedSource({
      bindings: input.bindings,
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      kind: 'website',
      originUrl: input.url,
      finalUrl: fetched.finalUrl,
      mediaType: fetched.mediaType,
      bytes: fetched.bytes,
      httpStatus: fetched.status,
      hops: fetched.hops,
      requestId: input.requestId,
      expectedAttemptCount: input.expectedAttemptCount,
      ...(input.dbFetch === undefined ? {} : { dbFetch: input.dbFetch }),
    });
  } catch (error) {
    if (error instanceof SourceCaptureEgressUnavailableError) {
      return await machine.failJob(
        input.jobId,
        'SOURCE_EGRESS_UNAVAILABLE',
        input.requestId,
        input.expectedAttemptCount,
      );
    }
    const failure =
      error instanceof SourceMachineError
        ? error
        : new SourceMachineError('SOURCE_UNREACHABLE', true);
    return await machine.failJob(
      input.jobId,
      failure.code === 'NOT_FOUND' ? 'SOURCE_INTERRUPTED' : failure.code,
      input.requestId,
      input.expectedAttemptCount,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function runDocumentCapture(input: {
  readonly bindings: CoreBindings;
  readonly jobId: string;
  readonly workspaceId: string;
  readonly brandId: string;
  readonly filename: string;
  readonly declaredType: string;
  readonly bytes: Uint8Array;
  readonly requestId: string;
  readonly expectedAttemptCount: number;
  readonly dbFetch?: typeof fetch;
}): Promise<unknown> {
  const machine = new PrivilegedSourceMachinePort(input.bindings, input.dbFetch);
  const sniff = sniffDocumentMediaType(input.bytes, input.declaredType);
  if (sniff === 'unsupported')
    return await machine.failJob(
      input.jobId,
      'SOURCE_UNSUPPORTED',
      input.requestId,
      input.expectedAttemptCount,
    );
  if (sniff === 'malformed')
    return await machine.failJob(
      input.jobId,
      'SOURCE_MALFORMED',
      input.requestId,
      input.expectedAttemptCount,
    );
  if (input.bytes.byteLength > SOURCE_CAPTURE_MAX_BYTES) {
    return await machine.failJob(
      input.jobId,
      'SOURCE_TOO_LARGE',
      input.requestId,
      input.expectedAttemptCount,
    );
  }
  try {
    return await persistCapturedSource({
      bindings: input.bindings,
      jobId: input.jobId,
      workspaceId: input.workspaceId,
      brandId: input.brandId,
      kind: 'document',
      originUrl: '',
      finalUrl: '',
      mediaType: sniff,
      bytes: input.bytes,
      filename: input.filename,
      requestId: input.requestId,
      expectedAttemptCount: input.expectedAttemptCount,
      ...(input.dbFetch === undefined ? {} : { dbFetch: input.dbFetch }),
    });
  } catch (error) {
    const failure =
      error instanceof SourceMachineError ? error : new SourceMachineError('INTERNAL_ERROR', true);
    return await machine.failJob(
      input.jobId,
      failure.code === 'NOT_FOUND' ? 'SOURCE_INTERRUPTED' : failure.code,
      input.requestId,
      input.expectedAttemptCount,
    );
  }
}

export function captureLogLine(
  event: string,
  requestId: string,
  host: string,
  extra: Readonly<Record<string, unknown>> = {},
): void {
  console.log(JSON.stringify({ level: 'info', event, request_id: requestId, host, ...extra }));
}
