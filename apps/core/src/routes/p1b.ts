import {
  CreateApiKeyBodySchema,
  CreateOAuthClientBodySchema,
  HandlerContextSchema,
  IssueOAuthTokenBodySchema,
  PublishSkillBodySchema,
  createP1bHandlers,
  type HandlerContext,
  type P1bHandlers,
} from '@mustbeviral/contracts';
import { Hono, type Context } from 'hono';

import { workerCredentialGenerator } from '../auth/credential-format';
import type { AuthenticatedActor } from '../auth/actor';
import { createRequestAuthenticator } from '../auth/authenticate';
import type { SupabaseJwtVerifier } from '../auth/supabase-jwt';
import type { CoreHonoEnvironment } from '../bindings';
import {
  createProgrammaticAuthPort,
  createPrivilegedProgrammaticAuthPort,
} from '../composition/programmatic-auth';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';
import { p1bResultSemantics } from '../transport/p1b-semantics';

export interface P1bRouteDependencies {
  readonly jwt: SupabaseJwtVerifier;
  readonly handlers?: P1bHandlers;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function bearerToken(context: Context<CoreHonoEnvironment>): string | null {
  const authorization = context.req.header('authorization');
  const match = authorization === undefined ? null : /^Bearer ([^\s]+)$/u.exec(authorization);
  return match?.[1] ?? null;
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

function requireIdempotencyKey(context: Context<CoreHonoEnvironment>): string {
  const key = context.req.header('idempotency-key');
  if (key === undefined || key.length < 1 || key.length > 200) {
    throw new TypeError('A valid Idempotency-Key header is required');
  }
  return key;
}

async function requireJwtActor(
  context: Context<CoreHonoEnvironment>,
  dependencies: P1bRouteDependencies,
): Promise<Readonly<{ actor: AuthenticatedActor; callerJwt: string }>> {
  const token = bearerToken(context);
  if (token === null) {
    throw new TypeError('UNAUTHENTICATED');
  }
  const authenticator = createRequestAuthenticator(dependencies.jwt);
  let authenticated: Awaited<ReturnType<typeof authenticator.authenticate>>;
  try {
    authenticated = await authenticator.authenticate(token, context.env);
  } catch {
    throw new TypeError('UNAUTHENTICATED');
  }
  if (
    authenticated.actor.authenticationMethod !== 'supabase_jwt' ||
    authenticated.callerJwt === undefined
  ) {
    throw new TypeError('FORBIDDEN');
  }
  return { actor: authenticated.actor, callerJwt: authenticated.callerJwt };
}

function resolveHandlers(
  context: Context<CoreHonoEnvironment>,
  callerJwt: string,
  dependencies: P1bRouteDependencies,
): P1bHandlers {
  return (
    dependencies.handlers ??
    createP1bHandlers(createProgrammaticAuthPort(context.env, callerJwt), workerCredentialGenerator)
  );
}

function mapResult(
  context: Context<CoreHonoEnvironment>,
  result: unknown,
  status: 200 | 201,
): Response {
  const semantic = p1bResultSemantics(result as Parameters<typeof p1bResultSemantics>[0]);
  if (semantic.ok) {
    return context.json(safeSuccess(context, jsonSafe(semantic.data)), status);
  }
  return context.json(
    safeError(
      context,
      semantic.error.code,
      semantic.error.message,
      semantic.error.retryable,
      semantic.error.details,
    ),
    semantic.error.httpStatus as 400 | 401 | 403 | 404 | 409 | 500,
  );
}

function handlerContext(
  actor: AuthenticatedActor,
  workspaceId: string,
  requestId: string,
): HandlerContext {
  return HandlerContextSchema.parse({
    workspace_id: workspaceId,
    actor_id: actor.actorId,
    request_id: requestId,
  });
}

export function createP1bRoute(dependencies: P1bRouteDependencies): Hono<CoreHonoEnvironment> {
  const router = new Hono<CoreHonoEnvironment>();

  router.post('/oauth/token', async (context) => {
    try {
      const body = IssueOAuthTokenBodySchema.parse(await readJsonObject(context));
      const privilegedPort = createPrivilegedProgrammaticAuthPort(context.env);
      const handlers = createP1bHandlers(
        {
          createApiKey: async () => ({ status: 'validation_failed' }),
          listApiKeys: async () => ({ status: 'validation_failed' }),
          revokeApiKey: async () => ({ status: 'validation_failed' }),
          createOAuthClient: async () => ({ status: 'validation_failed' }),
          listOAuthClients: async () => ({ status: 'validation_failed' }),
          revokeOAuthClient: async () => ({ status: 'validation_failed' }),
          issueOAuthToken: privilegedPort.issueOAuthToken.bind(privilegedPort),
          publishSkill: async () => ({ status: 'validation_failed' }),
          listSkills: async () => ({ status: 'validation_failed' }),
        },
        workerCredentialGenerator,
      );
      const result = await handlers.issue_oauth_token({
        clientId: body.client_id,
        clientSecret: body.client_secret,
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'This credential is not authorized for the requested operation.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.post('/workspaces/:id/api-keys', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const body = CreateApiKeyBodySchema.parse(await readJsonObject(context));
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.create_api_key({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
        idempotency_key: requireIdempotencyKey(context),
        ...body,
      });
      return mapResult(context, result, 201);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.get('/workspaces/:id/api-keys', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.list_api_keys({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.post('/api-keys/:id/revoke', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const keyId = context.req.param('id');
      const workspaceId = context.req.header('x-workspace-id') ?? '';
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.revoke_api_key({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        key_id: keyId,
        idempotency_key: requireIdempotencyKey(context),
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.post('/workspaces/:id/oauth-clients', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const body = CreateOAuthClientBodySchema.parse(await readJsonObject(context));
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.create_oauth_client({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
        idempotency_key: requireIdempotencyKey(context),
        ...body,
      });
      return mapResult(context, result, 201);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.get('/workspaces/:id/oauth-clients', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.list_oauth_clients({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.post('/oauth-clients/:id/revoke', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const clientUuid = context.req.param('id');
      const workspaceId = context.req.header('x-workspace-id') ?? '';
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.revoke_oauth_client({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        client_uuid: clientUuid,
        idempotency_key: requireIdempotencyKey(context),
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.post('/workspaces/:id/skills/publish', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const body = PublishSkillBodySchema.parse(await readJsonObject(context));
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.publish_skill({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
        idempotency_key: requireIdempotencyKey(context),
        ...body,
      });
      return mapResult(context, result, 201);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  router.get('/workspaces/:id/skills', async (context) => {
    try {
      const { actor, callerJwt } = await requireJwtActor(context, dependencies);
      const workspaceId = context.req.param('id');
      const handlers = resolveHandlers(context, callerJwt, dependencies);
      const result = await handlers.list_skills({
        context: handlerContext(actor, workspaceId, context.get('requestId')),
        workspace_id: workspaceId,
      });
      return mapResult(context, result, 200);
    } catch (error) {
      if (error instanceof TypeError && error.message === 'UNAUTHENTICATED') {
        return context.json(
          safeError(context, 'UNAUTHENTICATED', 'A valid bearer token is required.'),
          401,
        );
      }
      if (error instanceof TypeError && error.message === 'FORBIDDEN') {
        return context.json(
          safeError(
            context,
            'FORBIDDEN',
            'Programmatic credential management requires a browser session.',
          ),
          403,
        );
      }
      return context.json(safeError(context, 'VALIDATION_FAILED', 'The request is invalid.'), 400);
    }
  });

  return router;
}
