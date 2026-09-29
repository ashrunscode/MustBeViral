import {
  createPlatformHandlers,
  PLATFORM_ERRORS,
  PLATFORM_OPERATIONS,
  PLATFORM_OPERATION_NAMES,
  platformPathKeys,
  type PlatformHandlers,
  type PlatformOperation,
  type PlatformResult,
} from '@mustbeviral/contracts';
import { Hono, type Context } from 'hono';

import type { CoreHonoEnvironment } from '../bindings';
import type { AuthenticatedActor } from '../auth/actor';
import { createRequestAuthenticator } from '../auth/authenticate';
import type { SupabaseJwtVerifier } from '../auth/supabase-jwt';
import { createKnowledgeAwarePlatformPort } from '../composition/platform-knowledge';
import { jsonSafe, safeError, safeSuccess } from '../http/responses';

export interface PlatformRouteDependencies {
  readonly jwt: SupabaseJwtVerifier;
  readonly platformHandlers?: PlatformHandlers;
}

export async function invokePlatform(
  context: Context<CoreHonoEnvironment>,
  actor: AuthenticatedActor,
  callerJwt: string | undefined,
  operation: PlatformOperation,
  input: unknown,
  idempotencyKey: string | undefined,
  handlers?: PlatformHandlers,
): Promise<PlatformResult> {
  if (actor.authenticationMethod !== 'supabase_jwt' || callerJwt === undefined)
    return { status: 'error', code: 'FORBIDDEN' };
  try {
    return await (
      handlers ?? createPlatformHandlers(createKnowledgeAwarePlatformPort(context.env, callerJwt))
    ).execute(
      operation,
      input,
      { actor_id: actor.actorId, request_id: context.get('requestId') },
      idempotencyKey,
    );
  } catch {
    return { status: 'error', code: 'INTERNAL_ERROR' };
  }
}

export function platformEnvelope(context: Context<CoreHonoEnvironment>, result: PlatformResult) {
  if (result.status === 'ok') return safeSuccess(context, jsonSafe(result.data));
  const error = PLATFORM_ERRORS[result.code];
  return safeError(context, result.code, error.message, error.retryable);
}

export function createPlatformRoute(
  dependencies: PlatformRouteDependencies,
): Hono<CoreHonoEnvironment> {
  const router = new Hono<CoreHonoEnvironment>();
  for (const operation of PLATFORM_OPERATION_NAMES) {
    const definition = PLATFORM_OPERATIONS[operation];
    router.on(
      definition.method,
      definition.path.replace(/\{([a-z_]+)\}/gu, ':$1'),
      async (context) => {
        const token = /^Bearer ([^\s]+)$/u.exec(context.req.header('authorization') ?? '')?.[1];
        if (token === undefined)
          return context.json(
            safeError(context, 'UNAUTHENTICATED', PLATFORM_ERRORS.UNAUTHENTICATED.message),
            401,
          );
        const authenticator = createRequestAuthenticator(dependencies.jwt);
        let authentication;
        try {
          authentication = await authenticator.authenticate(token, context.env);
        } catch {
          return context.json(
            safeError(context, 'UNAUTHENTICATED', PLATFORM_ERRORS.UNAUTHENTICATED.message),
            401,
          );
        }
        let input: Record<string, unknown>;
        try {
          if (definition.method === 'GET') {
            const params = new URL(context.req.url).searchParams;
            input = {};
            for (const [key, value] of params) {
              if (Object.hasOwn(input, key)) throw new TypeError('Duplicate query field');
              input[key] =
                key === 'limit'
                  ? /^[0-9]+$/u.test(value)
                    ? Number(value)
                    : value
                  : key === 'include_archived'
                    ? value === 'true'
                      ? true
                      : value === 'false'
                        ? false
                        : value
                    : value;
            }
          } else {
            const text = await context.req.text();
            const maximumBytes = 'rpc' in definition ? 65536 : 8192;
            if (new TextEncoder().encode(text).length > maximumBytes)
              throw new TypeError('Invalid request size');
            const body: unknown = JSON.parse(text);
            if (typeof body !== 'object' || body === null || Array.isArray(body))
              throw new TypeError('Invalid body');
            input = body as Record<string, unknown>;
          }
          for (const key of platformPathKeys(operation)) {
            if (Object.hasOwn(input, key)) throw new TypeError('Duplicate resource field');
            input[key] = context.req.param(key);
          }
        } catch {
          return context.json(
            safeError(context, 'VALIDATION_FAILED', PLATFORM_ERRORS.VALIDATION_FAILED.message),
            400,
          );
        }
        const result = await invokePlatform(
          context,
          authentication.actor,
          authentication.callerJwt,
          operation,
          input,
          context.req.header('idempotency-key'),
          dependencies.platformHandlers,
        );
        const status =
          result.status === 'ok'
            ? operation.startsWith('create_') || operation === 'grant_workspace_access'
              ? 201
              : 200
            : PLATFORM_ERRORS[result.code].httpStatus;
        return context.json(platformEnvelope(context, result), status);
      },
    );
  }
  return router;
}
