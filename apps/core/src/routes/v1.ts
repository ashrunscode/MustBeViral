import {
  ApplyCanvasPatchInputSchema,
  CancelRunInputSchema,
  CreateArtifactUploadBodySchema,
  CreateCanvasBodySchema,
  CreateExportBodySchema,
  CreateProjectBodySchema,
  CreateWorkspaceBodySchema,
  GetCanvasContextInputSchema,
  GetRunInputSchema,
  QuoteRunInputSchema,
  StartRunInputSchema,
  ValidateGraphInputSchema,
  type HandlerContext,
  type P0HandlerResult,
  type P0RestHandlers,
} from '@mustbeviral/contracts';
import { Hono, type Context } from 'hono';

import type { AuthenticatedActor, SupabaseJwtVerifier } from '../auth/supabase-jwt';
import type { CoreBindings, CoreHonoEnvironment } from '../bindings';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';
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

export interface VerifiedFalWebhookIdentity {
  readonly provider: 'fal';
  readonly eventId: string;
  readonly receivedAtEpochSeconds: number;
  readonly attempt: Readonly<{ providerJobId: string; status: unknown }>;
}

export interface FalWebhookVerifierPort {
  verifyAndMap(
    input: Readonly<{
      rawBody: Uint8Array;
      headers: Readonly<Record<string, string | undefined>>;
    }>,
  ): Promise<VerifiedFalWebhookIdentity>;
}

export interface V1Dependencies {
  readonly handlers: P0RestHandlers;
  readonly jwt: SupabaseJwtVerifier;
  readonly workspaces: WorkspaceResolutionPort;
  readonly falWebhook?: FalWebhookVerifierPort;
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

function resultData(result: P0HandlerResult): unknown {
  return Object.fromEntries(Object.entries(result).filter(([key]) => key !== 'status'));
}

function conflictCode(result: P0HandlerResult): string {
  if (result.reason === 'idempotency') return 'IDEMPOTENCY_CONFLICT';
  if (result.reason === 'quote_stale') return 'QUOTE_STALE';
  if (result.reason === 'run_state') return 'RUN_NOT_CANCELABLE';
  return 'REVISION_CONFLICT';
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
  if (result.status === 'ok') {
    return context.json(safeSuccess(context, jsonSafe(resultData(result))), successStatus(route));
  }
  if (result.status === 'forbidden') {
    return context.json(
      safeError(context, 'FORBIDDEN', 'Access to this resource is forbidden.'),
      403,
    );
  }
  if (result.status === 'not_found') {
    return context.json(
      safeError(context, 'NOT_FOUND', 'The requested resource was not found.'),
      404,
    );
  }
  if (result.status === 'conflict') {
    return context.json(
      safeError(
        context,
        conflictCode(result),
        'The requested state change conflicts with current state.',
      ),
      409,
    );
  }
  if (result.status === 'expired_quote') {
    return context.json(
      safeError(context, 'QUOTE_EXPIRED', 'The referenced quote has expired.'),
      409,
    );
  }
  if (result.status === 'cap_exceeded') {
    const balance = result.tier === 'available_balance';
    return context.json(
      safeError(
        context,
        balance ? 'INSUFFICIENT_BALANCE' : 'BUDGET_EXCEEDED',
        balance ? 'Available balance is insufficient.' : 'The configured budget cap was exceeded.',
      ),
      balance ? 402 : 409,
    );
  }
  if (result.status === 'graph_invalid') {
    return context.json(safeError(context, 'GRAPH_INVALID', 'The canvas graph is invalid.'), 422);
  }
  return context.json(
    safeError(context, 'MODEL_UNAVAILABLE', 'Provider-backed execution is not enabled.', false),
    503,
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
      return { context, ...CreateWorkspaceBodySchema.parse(body), idempotency_key: idempotencyKey };
    case 'get_workspace':
      return { context, workspace_id: id };
    case 'create_project':
      return {
        context,
        workspace_id: id,
        ...CreateProjectBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      };
    case 'get_project':
      return { context, project_id: id };
    case 'create_canvas':
      return {
        context,
        project_id: id,
        ...CreateCanvasBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      };
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
      return {
        context,
        ...CreateArtifactUploadBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      };
    case 'get_artifact':
      return { context, artifact_id: id };
    case 'create_export':
      return {
        context,
        run_id: id,
        ...CreateExportBodySchema.parse(body),
        idempotency_key: idempotencyKey,
      };
    case 'explain_model':
      return { context, model_id: id };
    case 'get_receipt':
      return { context, run_id: id };
    case 'ingest_fal_webhook':
      throw new TypeError('Webhook input uses signed provider identity');
  }
}

async function handleFalWebhook(
  context: Context<CoreHonoEnvironment>,
  route: V1RouteDefinition,
  dependencies: V1Dependencies,
): Promise<Response> {
  if (dependencies.falWebhook === undefined) {
    return context.json(
      safeError(context, 'UNAUTHENTICATED', 'Webhook authentication is unavailable.'),
      401,
    );
  }
  const rawBody = new Uint8Array(await context.req.arrayBuffer());
  try {
    const identity = await dependencies.falWebhook.verifyAndMap({
      rawBody,
      headers: Object.fromEntries(context.req.raw.headers.entries()),
    });
    const result = await dependencies.handlers.ingest_fal_webhook({
      identity: {
        provider: identity.provider,
        event_id: identity.eventId,
        dedup_key: identity.eventId,
      },
      event: identity,
    });
    return mapResult(context, route, result);
  } catch (error) {
    const providerError = error as ProviderBoundaryError;
    if (
      providerError.code === 'provider_error' &&
      providerError.details?.reason === 'webhook_replayed'
    ) {
      return context.json(
        safeError(context, 'PROVIDER_REJECTED', 'The provider event was already processed.'),
        409,
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
    const body = route.method === 'POST' ? await readJsonObject(context) : {};
    const idempotencyKey = requireIdempotencyKey(context, route);
    const pathId = context.req.param('id');
    const workspaceId = await dependencies.workspaces.resolve({
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
    const result = await dependencies.handlers[route.operation](input);
    return mapResult(context, route, result);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      error instanceof TypeError ||
      (error as Error).name === 'ZodError'
    ) {
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
  return router;
}

export function providerRunsEnabled(bindings: CoreBindings): boolean {
  return bindings.PROVIDER_RUNS_ENABLED === 'true' && Boolean(bindings.FAL_KEY);
}
