import {
  ApplyCanvasPatchInputSchema,
  CancelRunInputSchema,
  CreateArtifactUploadBodySchema,
  CreateArtifactUploadResourceInputSchema,
  CreateCanvasBodySchema,
  CreateCanvasResourceInputSchema,
  CreateExportBodySchema,
  CreateExportResourceInputSchema,
  CreateProjectBodySchema,
  CreateProjectResourceInputSchema,
  CreateWorkspaceBodySchema,
  CreateWorkspaceResourceInputSchema,
  ExplainModelResourceInputSchema,
  GetArtifactResourceInputSchema,
  GetCanvasContextInputSchema,
  GetRunInputSchema,
  GetProjectResourceInputSchema,
  GetReceiptResourceInputSchema,
  GetWorkspaceResourceInputSchema,
  QuoteRunInputSchema,
  StartRunInputSchema,
  ValidateGraphInputSchema,
  type HandlerContext,
  type P0HandlerResult,
  type P0RestHandlers,
} from '@mustbeviral/contracts';
import { Hono, type Context } from 'hono';
import type { VerifiedFalWebhook } from '../../../../packages/provider/src/webhook';

import type { AuthenticatedActor, SupabaseJwtVerifier } from '../auth/supabase-jwt';
import type { CoreBindings, CoreHonoEnvironment } from '../bindings';
import { artifactContentHeaders, serveArtifactContent } from '../composition/artifact-access';
import { ArtifactMachineError } from '../composition/artifact-machine';
import { createFalWebhookVerifierPort } from '../composition/fal-webhook';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';
import { p0ResultSemantics } from '../transport/semantics';
import { V1_ROUTE_TABLE, type V1Operation, type V1RouteDefinition } from './v1-table';

export interface WorkspaceResolutionPort {
  resolve(
    input: Readonly<{
      actor: AuthenticatedActor;
      operation: V1Operation;
      pathId: string | undefined;
      body: Readonly<Record<string, unknown>>;
    }>,
  ): Promise<string | null>;
}

export type VerifiedFalWebhookIdentity = VerifiedFalWebhook;

export interface FalWebhookVerifierPort {
  verifyAndMap(
    input: Readonly<{
      rawBody: Uint8Array;
      headers: Readonly<Record<string, string | undefined>>;
    }>,
  ): Promise<VerifiedFalWebhookIdentity>;
  markProcessed(provider: 'fal', eventId: string): Promise<boolean>;
  release(provider: 'fal', eventId: string): Promise<boolean>;
}

export interface V1Dependencies {
  readonly handlers: P0RestHandlers;
  readonly jwt: SupabaseJwtVerifier;
  readonly workspaces: WorkspaceResolutionPort;
  readonly falWebhook?: FalWebhookVerifierPort;
  readonly falWebhookIngest?: (
    event: VerifiedFalWebhookIdentity,
    bindings: CoreBindings,
    requestId: string,
  ) => Promise<P0HandlerResult>;
  readonly requestFactory?: RequestDependencyFactory;
}

export interface RequestScopedDependencies {
  readonly handlers: P0RestHandlers;
  readonly workspaces: WorkspaceResolutionPort;
}

export interface RequestDependencyFactory {
  create(
    input: Readonly<{
      actor: AuthenticatedActor;
      bindings: CoreBindings;
      callerJwt: string;
    }>,
  ): Promise<RequestScopedDependencies | null>;
}

interface ProviderBoundaryError extends Error {
  readonly code?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonObject(
  context: Context<CoreHonoEnvironment>,
): Promise<Readonly<Record<string, unknown>>> {
  const text = await context.req.text();
  if (text.length === 0) return {};
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed)) throw new TypeError('Request body must be a JSON object');
  return parsed;
}

function bearerToken(context: Context<CoreHonoEnvironment>): string | null {
  const authorization = context.req.header('authorization');
  if (authorization === undefined) return null;
  const match = /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
}

function successStatus(route: V1RouteDefinition): 200 | 201 | 202 {
  if (route.auth === 'fal_signature') return 202;
  if (
    route.operation === 'create_workspace' ||
    route.operation === 'create_project' ||
    route.operation === 'create_canvas' ||
    route.operation === 'start_run' ||
    route.operation === 'create_artifact_upload' ||
    route.operation === 'create_export'
  ) {
    return 201;
  }
  return 200;
}

function mapResult(
  context: Context<CoreHonoEnvironment>,
  route: V1RouteDefinition,
  result: P0HandlerResult,
): Response {
  const semantic = p0ResultSemantics(result);
  if (semantic.ok) {
    return context.json(safeSuccess(context, jsonSafe(semantic.data)), successStatus(route));
  }
  return context.json(
    safeError(
      context,
      semantic.error.code,
      semantic.error.message,
      semantic.error.retryable,
      semantic.error.details,
    ),
    semantic.error.httpStatus,
  );
}

function requireIdempotencyKey(
  context: Context<CoreHonoEnvironment>,
  route: V1RouteDefinition,
): string | undefined {
  if (!route.mutation || route.auth !== 'supabase_jwt') return undefined;
  const key = context.req.header('idempotency-key');
  if (key === undefined || key.length < 1 || key.length > 200) {
    throw new TypeError('A valid Idempotency-Key header is required');
  }
  return key;
}

function parseClientInput(
  operation: V1Operation,
  context: HandlerContext,
  pathId: string | undefined,
  body: Readonly<Record<string, unknown>>,
  idempotencyKey: string | undefined,
): unknown {
  const id = pathId ?? '';
  switch (operation) {
    case 'create_workspace':
      return CreateWorkspaceResourceInputSchema.parse({
        context,
        ...CreateWorkspaceBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      });
    case 'get_workspace':
      return GetWorkspaceResourceInputSchema.parse({ context, workspace_id: id });
    case 'create_project':
      return CreateProjectResourceInputSchema.parse({
        context,
        workspace_id: id,
        ...CreateProjectBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      });
    case 'get_project':
      return GetProjectResourceInputSchema.parse({ context, project_id: id });
    case 'create_canvas':
      return CreateCanvasResourceInputSchema.parse({
        context,
        project_id: id,
        ...CreateCanvasBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      });
    case 'get_canvas_context':
      return GetCanvasContextInputSchema.parse({ context, canvas_id: id });
    case 'apply_canvas_patch':
      return ApplyCanvasPatchInputSchema.parse({
        context,
        canvas_id: id,
        ...body,
        idempotency_key: idempotencyKey,
      });
    case 'validate_graph':
      return ValidateGraphInputSchema.parse({ context, canvas_id: id });
    case 'quote_run':
      return QuoteRunInputSchema.parse({
        context,
        canvas_id: id,
        ...body,
        idempotency_key: idempotencyKey,
      });
    case 'start_run':
      return StartRunInputSchema.parse({
        context,
        quote_id: id,
        ...body,
        idempotency_key: idempotencyKey,
      });
    case 'get_run':
      return GetRunInputSchema.parse({ context, run_id: id });
    case 'cancel_run':
      return CancelRunInputSchema.parse({
        context,
        run_id: id,
        ...body,
        idempotency_key: idempotencyKey,
      });
    case 'create_artifact_upload':
      return CreateArtifactUploadResourceInputSchema.parse({
        context,
        ...CreateArtifactUploadBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      });
    case 'get_artifact':
      return GetArtifactResourceInputSchema.parse({ context, artifact_id: id });
    case 'create_export':
      return CreateExportResourceInputSchema.parse({
        context,
        run_id: id,
        ...CreateExportBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      });
    case 'explain_model':
      return ExplainModelResourceInputSchema.parse({ context, model_id: id });
    case 'get_receipt':
      return GetReceiptResourceInputSchema.parse({ context, run_id: id });
    case 'ingest_fal_webhook':
      throw new TypeError('Webhook input uses signed provider identity');
  }
}

async function handleFalWebhook(
  context: Context<CoreHonoEnvironment>,
  route: V1RouteDefinition,
  dependencies: V1Dependencies,
): Promise<Response> {
  const falWebhook =
    dependencies.falWebhook ?? createFalWebhookVerifierPort(context.env, context.get('requestId'));
  const rawBody = new Uint8Array(await context.req.arrayBuffer());
  let identity: VerifiedFalWebhookIdentity;
  try {
    identity = await falWebhook.verifyAndMap({
      rawBody,
      headers: Object.fromEntries(context.req.raw.headers.entries()),
    });
  } catch (error) {
    const providerError = error as ProviderBoundaryError;
    if (
      providerError.code === 'provider_error' &&
      providerError.details?.reason === 'webhook_replayed'
    ) {
      return context.json(safeSuccess(context, { accepted: true, idempotent: true }), 200);
    }
    if (
      providerError.code === 'provider_error' &&
      providerError.details?.reason === 'webhook_in_progress'
    ) {
      return context.json(
        safeError(
          context,
          'PROVIDER_REJECTED',
          'The provider event is already being processed.',
          true,
        ),
        503,
      );
    }
    if (
      providerError.code === 'provider_error' &&
      providerError.details?.reason === 'webhook_dedup_unavailable'
    ) {
      return context.json(
        safeError(
          context,
          'INTERNAL_ERROR',
          'Webhook replay protection is temporarily unavailable.',
          true,
        ),
        503,
      );
    }
    if (providerError.code === 'payload_invalid') {
      return context.json(
        safeError(context, 'VALIDATION_FAILED', 'The provider event payload is invalid.'),
        400,
      );
    }
    return context.json(
      safeError(context, 'UNAUTHENTICATED', 'Webhook signature verification failed.'),
      401,
    );
  }

  // Terminal means "retrying this exact event can never succeed". Deliberately narrow: anything
  // unrecognised is treated as retryable, because wrongly calling a transient failure terminal
  // silently discards an event fal has already charged for, while wrongly retrying a terminal one
  // only costs log noise until the stale-claim window or the reaper intervenes.
  const isTerminalIngestFailure = (cause: unknown): boolean =>
    cause instanceof ArtifactMachineError && !cause.retryable;

  let result: P0HandlerResult;
  try {
    result =
      dependencies.falWebhookIngest === undefined
        ? await dependencies.handlers.ingest_fal_webhook({
            identity: {
              provider: identity.provider,
              event_id: identity.eventId,
              dedup_key: identity.eventId,
            },
            event: identity,
          })
        : await dependencies.falWebhookIngest(identity, context.env, context.get('requestId'));
  } catch (cause) {
    // Retryable and terminal ingest failures need opposite handling, and conflating them produced
    // an unbounded redelivery loop. fal redelivers on any non-2xx, so returning a retryable 503 for
    // a cause that can never succeed means the same event is reprocessed forever - and because
    // ingest captures money before advancing the attempt, that loop sat on top of captured funds.
    if (isTerminalIngestFailure(cause)) {
      // Stop redelivery: the claim is marked processed rather than released, so fal is answered once
      // and the poisoned event is not handed back. The failure is durable in the Worker log with the
      // request id, and the run's reservation is left for the reaper rather than silently released.
      try {
        await falWebhook.markProcessed(identity.provider, identity.eventId);
      } catch {
        // Best effort. If this fails the event stays claimed and the stale-claim window applies,
        // which is strictly better than releasing it back into the loop.
      }
      console.log(
        JSON.stringify({
          level: 'error',
          event: 'core.webhook.terminal_ingest_failure',
          request_id: context.get('requestId'),
          provider: identity.provider,
          provider_event_id: identity.eventId,
          reason: cause instanceof ArtifactMachineError ? cause.reason : 'unknown',
          detail: cause instanceof Error ? cause.message : String(cause),
        }),
      );
      // 202: the event was accepted and will not be retried. It is not a success.
      return context.json(safeSuccess(context, { accepted: true, processed: false }), 202);
    }
    try {
      await falWebhook.release(identity.provider, identity.eventId);
    } catch {
      // Preserve the original ingest failure. The five-minute stale window remains a recovery path
      // when the best-effort release RPC itself is unavailable.
    }
    return context.json(
      safeError(context, 'INTERNAL_ERROR', 'Webhook processing is temporarily unavailable.', true),
      503,
    );
  }

  if (result.status !== 'ok') {
    try {
      await falWebhook.release(identity.provider, identity.eventId);
    } catch {
      // The original handler result remains authoritative for this response.
    }
    return mapResult(context, route, result);
  }

  try {
    const marked = await falWebhook.markProcessed(identity.provider, identity.eventId);
    if (!marked) {
      return context.json(
        safeError(
          context,
          'INTERNAL_ERROR',
          'Webhook processing could not be durably acknowledged.',
          true,
        ),
        503,
      );
    }
  } catch {
    return context.json(
      safeError(
        context,
        'INTERNAL_ERROR',
        'Webhook processing could not be durably acknowledged.',
        true,
      ),
      503,
    );
  }

  return mapResult(context, route, result);
}

async function handleClientRoute(
  context: Context<CoreHonoEnvironment>,
  route: V1RouteDefinition,
  dependencies: V1Dependencies,
): Promise<Response> {
  const token = bearerToken(context);
  if (token === null) {
    return context.json(
      safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
      401,
    );
  }
  let actor: AuthenticatedActor;
  try {
    actor = await dependencies.jwt.verify(token, context.env);
  } catch {
    return context.json(
      safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
      401,
    );
  }
  try {
    const scopedDependencies =
      (await dependencies.requestFactory?.create({
        actor,
        bindings: context.env,
        callerJwt: token,
      })) ?? dependencies;
    const body = route.method === 'POST' ? await readJsonObject(context) : {};
    const idempotencyKey = requireIdempotencyKey(context, route);
    const pathId = context.req.param('id');
    const workspaceId = await scopedDependencies.workspaces.resolve({
      actor,
      operation: route.operation,
      pathId,
      body,
    });
    if (workspaceId === null) {
      return context.json(
        safeError(context, 'FORBIDDEN', 'Access to this resource is forbidden.'),
        403,
      );
    }
    if (route.providerTouching && !providerRunsEnabled(context.env)) {
      return context.json(
        safeError(context, 'MODEL_UNAVAILABLE', 'Provider-backed execution is not enabled.'),
        503,
      );
    }
    const handlerContext: HandlerContext = {
      workspace_id: workspaceId,
      actor_id: actor.actorId,
      request_id: context.get('requestId'),
    };
    const input = parseClientInput(route.operation, handlerContext, pathId, body, idempotencyKey);
    const result = await scopedDependencies.handlers[route.operation](input);
    return mapResult(context, route, result);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      (error as Error).name === 'ZodError'
    ) {
      console.error(
        JSON.stringify({
          level: 'warn',
          event: 'core.request.validation_failed',
          request_id: context.get('requestId'),
          operation: route.operation,
          error_name: (error as Error).name,
          error_message: (error as Error).message,
        }),
      );
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
    throw error;
  }
}

export function createV1Route(dependencies: V1Dependencies): Hono<CoreHonoEnvironment> {
  const router = new Hono<CoreHonoEnvironment>();
  for (const route of V1_ROUTE_TABLE) {
    router.on(route.method, route.path, (context) =>
      route.auth === 'fal_signature'
        ? handleFalWebhook(context, route, dependencies)
        : handleClientRoute(context, route, dependencies),
    );
  }
  // Deliberately outside V1_ROUTE_TABLE and not a V1Operation: authentication is the signed
  // capability token itself, so this route must never enter the JWT, workspace-resolution or
  // idempotency machinery. fal's image fetcher sends no headers, which is why the capability
  // rides in the query string.
  router.get('/artifacts/:id/content', async (context) => {
    const token = context.req.query('token');
    if (token === undefined || token.length === 0) {
      return context.json(
        safeError(context, 'UNAUTHENTICATED', 'An artifact access token is required.'),
        401,
      );
    }
    const result = await serveArtifactContent(
      context.env,
      context.req.param('id'),
      token,
      Math.floor(Date.now() / 1000),
    );
    if (result.status !== 200) {
      // Structured log line, never the token: this is the observable evidence of who fetched what.
      console.log(
        JSON.stringify({
          level: 'warn',
          event: 'core.artifact_access.refused',
          request_id: context.get('requestId'),
          artifact_id: context.req.param('id'),
          status: result.status,
        }),
      );
      const message =
        result.status === 410
          ? 'The artifact access token has expired.'
          : result.status === 404
            ? 'The artifact bytes are not available.'
            : 'The artifact access token is invalid.';
      const code =
        result.status === 404 ? 'NOT_FOUND' : result.status === 410 ? 'EXPIRED' : 'UNAUTHENTICATED';
      return context.json(safeError(context, code, message), result.status);
    }
    console.log(
      JSON.stringify({
        level: 'info',
        event: 'core.artifact_access.served',
        request_id: context.get('requestId'),
        artifact_id: result.claims.artifactId,
        purpose: result.claims.purpose,
        byte_size: result.claims.byteSize,
        expires_at_epoch_seconds: result.claims.expiresAtEpochSeconds,
      }),
    );
    return new Response(result.body, {
      status: 200,
      headers: artifactContentHeaders(result.claims),
    });
  });
  return router;
}

export function providerRunsEnabled(bindings: CoreBindings): boolean {
  return bindings.PROVIDER_RUNS_ENABLED === 'true' && Boolean(bindings.FAL_KEY);
}
