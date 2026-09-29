import {
  PLATFORM_ERRORS,
  SOURCE_CAPTURE_DEADLINE_MS,
  SOURCE_CAPTURE_MAX_BYTES,
  createPlatformHandlers,
  mapCompletedSourceCapture,
  sniffDocumentMediaType,
  type PlatformErrorCode,
} from '@mustbeviral/contracts';
import { Hono } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';
import { createRequestAuthenticator } from '../auth/authenticate';
import type { SupabaseJwtVerifier } from '../auth/supabase-jwt';
import { createKnowledgeAwarePlatformPort } from '../composition/platform-knowledge';
import { persistCapturedSource, readBoundedStream } from '../composition/source-capture';
import {
  acquiredSourceAttemptCount,
  PrivilegedSourceMachinePort,
  SourceMachineError,
} from '../composition/source-machine';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function envelope(context: Parameters<typeof safeError>[0], code: PlatformErrorCode) {
  const error = PLATFORM_ERRORS[code];
  return context.json(safeError(context, code, error.message, error.retryable), error.httpStatus);
}

export function createSourceContentRoute(jwt: SupabaseJwtVerifier): Hono<CoreHonoEnvironment> {
  const router = new Hono<CoreHonoEnvironment>();
  router.put(
    '/workspaces/:workspace_id/brands/:brand_id/source-jobs/:job_id/content',
    async (context) => {
      const token = /^Bearer ([^\s]+)$/u.exec(context.req.header('authorization') ?? '')?.[1];
      if (token === undefined) return envelope(context, 'UNAUTHENTICATED');
      const authenticator = createRequestAuthenticator(jwt);
      let authentication;
      try {
        authentication = await authenticator.authenticate(token, context.env);
      } catch {
        return envelope(context, 'UNAUTHENTICATED');
      }
      if (
        authentication.actor.authenticationMethod !== 'supabase_jwt' ||
        authentication.callerJwt === undefined
      ) {
        return envelope(context, 'FORBIDDEN');
      }
      const workspaceId = context.req.param('workspace_id');
      const brandId = context.req.param('brand_id');
      const jobId = context.req.param('job_id');
      if (!UUID.test(workspaceId) || !UUID.test(brandId) || !UUID.test(jobId)) {
        return envelope(context, 'VALIDATION_FAILED');
      }
      const requestId = context.get('requestId');
      const handlers = createPlatformHandlers(
        createKnowledgeAwarePlatformPort(context.env, authentication.callerJwt),
      );
      const claimed = await handlers.execute(
        'claim_document_upload',
        { workspace_id: workspaceId, brand_id: brandId, job_id: jobId },
        { actor_id: authentication.actor.actorId, request_id: requestId },
        requestId,
      );
      if (claimed.status !== 'ok') {
        if (context.req.raw.body)
          void context.req.raw.body.cancel().then(
            () => undefined,
            () => undefined,
          );
        return envelope(context, claimed.code);
      }
      const job = claimed.data.job;
      if (!claimed.data.capture_pending) {
        if (context.req.raw.body)
          void context.req.raw.body.cancel().then(
            () => undefined,
            () => undefined,
          );
        return context.json(safeSuccess(context, jsonSafe(claimed.data)));
      }
      if (job.status !== 'capturing' || job.kind !== 'document') {
        if (context.req.raw.body)
          void context.req.raw.body.cancel().then(
            () => undefined,
            () => undefined,
          );
        return envelope(context, 'VALIDATION_FAILED');
      }
      const expectedAttemptCount = acquiredSourceAttemptCount(job);
      if (expectedAttemptCount === null) {
        if (context.req.raw.body)
          void context.req.raw.body.cancel().then(
            () => undefined,
            () => undefined,
          );
        return envelope(context, 'INTERNAL_ERROR');
      }
      const machine = new PrivilegedSourceMachinePort(context.env);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), SOURCE_CAPTURE_DEADLINE_MS);
      try {
        const declared = Number(context.req.header('content-length'));
        const bytes = await readBoundedStream(
          context.req.raw.body,
          controller.signal,
          Number.isFinite(declared) ? declared : undefined,
        );
        if (bytes.byteLength === 0) {
          await machine.failJob(jobId, 'SOURCE_MALFORMED', requestId, expectedAttemptCount);
          return envelope(context, 'SOURCE_MALFORMED');
        }
        if (bytes.byteLength > SOURCE_CAPTURE_MAX_BYTES) {
          await machine.failJob(jobId, 'SOURCE_TOO_LARGE', requestId, expectedAttemptCount);
          return envelope(context, 'SOURCE_TOO_LARGE');
        }
        const sniff = sniffDocumentMediaType(bytes, job.media_type);
        if (sniff === 'unsupported') {
          await machine.failJob(jobId, 'SOURCE_UNSUPPORTED', requestId, expectedAttemptCount);
          return envelope(context, 'SOURCE_UNSUPPORTED');
        }
        if (sniff === 'malformed') {
          await machine.failJob(jobId, 'SOURCE_MALFORMED', requestId, expectedAttemptCount);
          return envelope(context, 'SOURCE_MALFORMED');
        }
        const completed = await persistCapturedSource({
          bindings: context.env,
          jobId,
          workspaceId,
          brandId,
          kind: 'document',
          originUrl: '',
          finalUrl: '',
          mediaType: sniff,
          bytes,
          filename: job.filename,
          requestId,
          expectedAttemptCount,
        });
        const mapped = mapCompletedSourceCapture(completed);
        if (mapped.status !== 'ok') return envelope(context, mapped.code);
        return context.json(safeSuccess(context, jsonSafe(mapped.data)));
      } catch (error) {
        const failure =
          error instanceof SourceMachineError
            ? error
            : new SourceMachineError('INTERNAL_ERROR', true);
        const code = failure.code === 'NOT_FOUND' ? 'SOURCE_INTERRUPTED' : failure.code;
        if (code !== 'INTERNAL_ERROR') {
          await machine
            .failJob(jobId, code, requestId, expectedAttemptCount)
            .catch(() => undefined);
          if (
            code === 'SOURCE_TIMEOUT' ||
            code === 'SOURCE_TOO_LARGE' ||
            code === 'SOURCE_MALFORMED' ||
            code === 'SOURCE_UNSUPPORTED'
          ) {
            return envelope(context, code);
          }
        }
        return envelope(
          context,
          code === 'INTERNAL_ERROR' ? 'INTERNAL_ERROR' : (code as PlatformErrorCode),
        );
      } finally {
        clearTimeout(timer);
      }
    },
  );
  return router;
}
