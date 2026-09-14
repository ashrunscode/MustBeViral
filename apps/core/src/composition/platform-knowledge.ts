import { mapCompletedSourceCapture, type PlatformPort } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { createPlatformPort } from './platform';
import { runDocumentCapture, runWebsiteCapture } from './source-capture';
import { createSourceCaptureEgress, type SourceCaptureEgress } from './source-egress';
import { acquiredSourceAttemptCount } from './source-machine';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function createKnowledgeAwarePlatformPort(
  bindings: CoreBindings,
  callerJwt: string,
  options?: {
    readonly fetch?: typeof fetch;
    readonly captureEgress?: SourceCaptureEgress;
  },
): PlatformPort {
  const userPort = createPlatformPort(bindings, callerJwt, options?.fetch);
  return {
    async execute(request) {
      const started = await userPort.execute(request);
      if (started.status !== 'ok') return started;
      if (
        request.operation !== 'start_website_capture' &&
        request.operation !== 'start_document_capture'
      ) {
        return started;
      }
      const data = started.data;
      if (!isRecord(data) || data.capture_pending !== true || !isRecord(data.job)) return started;
      const job = data.job;
      const jobId = typeof job.id === 'string' ? job.id : '';
      const workspaceId = typeof job.workspace_id === 'string' ? job.workspace_id : '';
      const brandId = typeof job.brand_id === 'string' ? job.brand_id : '';
      const expectedAttemptCount = acquiredSourceAttemptCount(job);
      if (jobId.length === 0 || expectedAttemptCount === null) {
        return { status: 'error', code: 'INTERNAL_ERROR' };
      }
      try {
        if (request.operation === 'start_website_capture') {
          const url =
            typeof request.input === 'object' && request.input && 'url' in request.input
              ? String((request.input as { url: string }).url)
              : '';
          const completed = await runWebsiteCapture({
            bindings,
            jobId,
            workspaceId,
            brandId,
            url,
            requestId: request.context.request_id,
            expectedAttemptCount,
            ...(options?.fetch === undefined ? {} : { dbFetch: options.fetch }),
            ...(options?.captureEgress === undefined
              ? {}
              : { captureEgress: options.captureEgress }),
          });
          return mapCompletedSourceCapture(completed);
        }
        const input = request.input as {
          filename: string;
          media_type: string;
          text_content?: string;
        };
        if (input.text_content === undefined) return started;
        const completed = await runDocumentCapture({
          bindings,
          jobId,
          workspaceId,
          brandId,
          filename: input.filename,
          declaredType: input.media_type,
          bytes: new TextEncoder().encode(input.text_content),
          requestId: request.context.request_id,
          expectedAttemptCount,
          ...(options?.fetch === undefined ? {} : { dbFetch: options.fetch }),
        });
        return mapCompletedSourceCapture(completed);
      } catch (error) {
        if (error instanceof Error && error.name === 'SourceCaptureEgressUnavailableError') {
          return { status: 'error', code: 'SOURCE_EGRESS_UNAVAILABLE' };
        }
        return { status: 'error', code: 'INTERNAL_ERROR' };
      }
    },
  };
}

export function sourceCaptureEgressForBindings(
  bindings: CoreBindings,
  syntheticFetch?: typeof fetch,
): SourceCaptureEgress {
  return createSourceCaptureEgress(
    bindings,
    syntheticFetch === undefined ? {} : { syntheticFetch },
  );
}
