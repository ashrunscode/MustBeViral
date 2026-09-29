import { mapCompletedSourceCapture, type PlatformPort } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { extractionNeedsBytes, runBrandExtraction } from './brand-extraction';
import { createPlatformPort } from './platform';
import { runDocumentCapture, runWebsiteCapture } from './source-capture';
import { createSourceCaptureEgress, type SourceCaptureEgress } from './source-egress';
import { acquiredSourceAttemptCount, SourceMachineError } from './source-machine';

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
      const finishCapture = async (data: unknown) => {
        if (
          request.operation === 'import_brand_catalog' &&
          isRecord(data) &&
          isRecord(data.job) &&
          (data.job.status === 'captured' || data.job.status === 'duplicate') &&
          typeof data.job.source_id === 'string'
        ) {
          const input = request.input as { workspace_id: string; brand_id: string };
          const sourceId = data.job.source_id;
          const extraction = await userPort.execute({
            operation: 'extract_brand_knowledge',
            input: {
              workspace_id: input.workspace_id,
              brand_id: input.brand_id,
              source_id: sourceId,
            },
            context: request.context,
            idempotencyKey: `catalog-extract:${sourceId}`,
          });
          if (extraction.status !== 'ok') return extraction;
          if (extractionNeedsBytes(extraction.data)) {
            await runBrandExtraction({
              bindings,
              workspaceId: input.workspace_id,
              brandId: input.brand_id,
              sourceId,
              actorId: request.context.actor_id,
              requestId: request.context.request_id,
              ...(options?.fetch === undefined ? {} : { dbFetch: options.fetch }),
            });
          }
        }
        return mapCompletedSourceCapture(data);
      };
      if (request.operation === 'extract_brand_knowledge') {
        if (!extractionNeedsBytes(started.data)) return started;
        const sourceId =
          typeof request.input === 'object' && request.input && 'source_id' in request.input
            ? String((request.input as { source_id: string }).source_id)
            : '';
        const workspaceId =
          typeof request.input === 'object' && request.input && 'workspace_id' in request.input
            ? String((request.input as { workspace_id: string }).workspace_id)
            : '';
        const brandId =
          typeof request.input === 'object' && request.input && 'brand_id' in request.input
            ? String((request.input as { brand_id: string }).brand_id)
            : '';
        if (sourceId.length === 0 || workspaceId.length === 0 || brandId.length === 0) {
          return { status: 'error', code: 'INTERNAL_ERROR' };
        }
        try {
          const completed = await runBrandExtraction({
            bindings,
            workspaceId,
            brandId,
            sourceId,
            actorId: request.context.actor_id,
            requestId: request.context.request_id,
            ...(options?.fetch === undefined ? {} : { dbFetch: options.fetch }),
          });
          return { status: 'ok', data: completed };
        } catch (error) {
          if (error instanceof SourceMachineError) return { status: 'error', code: error.code };
          return { status: 'error', code: 'INTERNAL_ERROR' };
        }
      }
      if (
        request.operation !== 'start_website_capture' &&
        request.operation !== 'start_document_capture' &&
        request.operation !== 'import_brand_catalog'
      ) {
        return started;
      }
      const data = started.data;
      if (!isRecord(data) || !isRecord(data.job)) return started;
      if (data.capture_pending !== true) {
        if (request.operation !== 'import_brand_catalog') return started;
        try {
          return await finishCapture(data);
        } catch (error) {
          return {
            status: 'error',
            code: error instanceof SourceMachineError ? error.code : 'INTERNAL_ERROR',
          };
        }
      }
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
        return await finishCapture(completed);
      } catch (error) {
        if (error instanceof SourceMachineError) return { status: 'error', code: error.code };
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
