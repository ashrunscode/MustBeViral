import { z } from 'zod';

import { IdempotencyKeySchema } from './commands';
import { RequestIdSchema } from './http';

import {
  uuid,
  identity,
  workspace,
  brand,
  location,
  studio,
  expected,
  page,
  timeZone,
  actions,
  single,
  list,
  StudioRecordSchema,
  BrandRecordSchema,
  BrandLocationRecordSchema,
  StudioMemberRecordSchema,
  WorkspaceGrantRecordSchema,
} from './platform-models';
import { PLATFORM_SETUP_OPERATIONS } from './platform-setup';
import { PLATFORM_KNOWLEDGE_OPERATIONS } from './platform-knowledge';
export {
  PlatformActionSchema,
  StudioRecordSchema,
  BrandRecordSchema,
  BrandLocationRecordSchema,
  StudioMemberRecordSchema,
  WorkspaceGrantRecordSchema,
} from './platform-models';
export * from './platform-setup';
export * from './platform-knowledge';

/** One registry drives shared validation and REST, client, CLI and MCP projections. */
export const PLATFORM_OPERATIONS = {
  ...PLATFORM_SETUP_OPERATIONS,
  ...PLATFORM_KNOWLEDGE_OPERATIONS,
  create_studio: {
    method: 'POST',
    path: '/studios',
    input: z.object(identity).strict(),
    output: single(StudioRecordSchema),
  },
  list_studios: {
    method: 'GET',
    path: '/studios',
    input: z.object(page).strict(),
    output: list(StudioRecordSchema),
  },
  get_studio: {
    method: 'GET',
    path: '/studios/{studio_id}',
    input: z.object(studio).strict(),
    output: single(StudioRecordSchema),
  },
  update_studio: {
    method: 'PATCH',
    path: '/studios/{studio_id}',
    input: z.object({ ...studio, ...identity, ...expected }).strict(),
    output: single(StudioRecordSchema),
  },
  archive_studio: {
    method: 'POST',
    path: '/studios/{studio_id}/archive',
    input: z.object({ ...studio, ...expected }).strict(),
    output: single(StudioRecordSchema),
  },
  set_studio_member: {
    method: 'POST',
    path: '/studios/{studio_id}/members',
    input: z
      .object({ ...studio, user_id: uuid, role: z.enum(['editor', 'viewer']), ...expected })
      .strict(),
    output: single(StudioRecordSchema),
  },
  revoke_studio_member: {
    method: 'POST',
    path: '/studios/{studio_id}/members/{user_id}/revoke',
    input: z.object({ ...studio, user_id: uuid, ...expected }).strict(),
    output: single(StudioRecordSchema),
  },
  list_studio_members: {
    method: 'GET',
    path: '/studios/{studio_id}/members',
    input: z.object({ ...studio, ...page }).strict(),
    output: list(StudioMemberRecordSchema),
  },
  grant_workspace_access: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/studio-grants',
    input: z.object({ ...workspace, ...studio, brand_id: uuid.optional(), actions }).strict(),
    output: single(WorkspaceGrantRecordSchema),
  },
  revoke_workspace_access: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/studio-grants/{grant_id}/revoke',
    input: z.object({ ...workspace, grant_id: uuid, ...expected }).strict(),
    output: single(WorkspaceGrantRecordSchema),
  },
  list_workspace_access_grants: {
    method: 'GET',
    path: '/studios/{studio_id}/workspace-grants',
    input: z.object({ ...studio, workspace_id: uuid.optional(), ...page }).strict(),
    output: list(WorkspaceGrantRecordSchema),
  },
  create_brand: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands',
    input: z.object({ ...workspace, ...identity }).strict(),
    output: single(BrandRecordSchema),
  },
  list_brands: {
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands',
    input: z.object({ ...workspace, ...page }).strict(),
    output: list(BrandRecordSchema),
  },
  get_brand: {
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}',
    input: z.object(brand).strict(),
    output: single(BrandRecordSchema),
  },
  update_brand: {
    method: 'PATCH',
    path: '/workspaces/{workspace_id}/brands/{brand_id}',
    input: z.object({ ...brand, ...identity, ...expected }).strict(),
    output: single(BrandRecordSchema),
  },
  archive_brand: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/archive',
    input: z.object({ ...brand, ...expected }).strict(),
    output: single(BrandRecordSchema),
  },
  create_brand_location: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/locations',
    input: z.object({ ...brand, ...identity, time_zone: timeZone }).strict(),
    output: single(BrandLocationRecordSchema),
  },
  list_brand_locations: {
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/locations',
    input: z.object({ ...brand, ...page }).strict(),
    output: list(BrandLocationRecordSchema),
  },
  get_brand_location: {
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}',
    input: z.object(location).strict(),
    output: single(BrandLocationRecordSchema),
  },
  update_brand_location: {
    method: 'PATCH',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}',
    input: z.object({ ...location, ...identity, time_zone: timeZone, ...expected }).strict(),
    output: single(BrandLocationRecordSchema),
  },
  archive_brand_location: {
    method: 'POST',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}/archive',
    input: z.object({ ...location, ...expected }).strict(),
    output: single(BrandLocationRecordSchema),
  },
} as const;

export type PlatformOperation = keyof typeof PLATFORM_OPERATIONS;
export type PlatformInput<O extends PlatformOperation> = z.infer<
  (typeof PLATFORM_OPERATIONS)[O]['input']
>;
export type PlatformOutput<O extends PlatformOperation> = z.infer<
  (typeof PLATFORM_OPERATIONS)[O]['output']
>;
export const PLATFORM_OPERATION_NAMES = Object.freeze(
  Object.keys(PLATFORM_OPERATIONS) as PlatformOperation[],
);
export function isPlatformOperation(name: string): name is PlatformOperation {
  return Object.hasOwn(PLATFORM_OPERATIONS, name);
}
export const PlatformContextSchema = z
  .object({ actor_id: uuid, request_id: RequestIdSchema })
  .strict();
export type PlatformContext = z.infer<typeof PlatformContextSchema>;
export const PLATFORM_ERRORS = {
  UNAUTHENTICATED: {
    httpStatus: 401,
    message: 'A valid user session is required.',
    retryable: false,
  },
  FORBIDDEN: {
    httpStatus: 403,
    message: 'You do not have permission for this action.',
    retryable: false,
  },
  NOT_FOUND: {
    httpStatus: 404,
    message: 'The requested resource was not found.',
    retryable: false,
  },
  VALIDATION_FAILED: { httpStatus: 400, message: 'The request is invalid.', retryable: false },
  IDEMPOTENCY_CONFLICT: {
    httpStatus: 409,
    message: 'This idempotency key was used for a different request.',
    retryable: false,
  },
  REVISION_CONFLICT: {
    httpStatus: 409,
    message: 'The resource changed. Reload it before editing.',
    retryable: false,
  },
  RESOURCE_CONFLICT: {
    httpStatus: 409,
    message: 'That resource identifier or access grant is already in use.',
    retryable: false,
  },
  RESOURCE_ARCHIVED: {
    httpStatus: 409,
    message: 'This resource is archived or revoked.',
    retryable: false,
  },
  SOURCE_UNSAFE: {
    httpStatus: 400,
    message: 'That destination is not a permitted public website.',
    retryable: false,
  },
  SOURCE_UNSUPPORTED: {
    httpStatus: 400,
    message: 'That file type is not supported for brand source capture.',
    retryable: false,
  },
  SOURCE_MALFORMED: {
    httpStatus: 400,
    message: 'The source could not be read as a supported document.',
    retryable: false,
  },
  SOURCE_TOO_LARGE: {
    httpStatus: 400,
    message: 'The source exceeds the capture size limit.',
    retryable: false,
  },
  SOURCE_TIMEOUT: {
    httpStatus: 504,
    message: 'The source capture timed out.',
    retryable: true,
  },
  SOURCE_UNREACHABLE: {
    httpStatus: 502,
    message: 'The source could not be retrieved.',
    retryable: true,
  },
  SOURCE_INTERRUPTED: {
    httpStatus: 409,
    message: 'The source capture was interrupted before it finished.',
    retryable: true,
  },
  SOURCE_EGRESS_UNAVAILABLE: {
    httpStatus: 503,
    message: 'Public-only source capture is not configured.',
    retryable: true,
  },
  INTERNAL_ERROR: {
    httpStatus: 500,
    message: 'The request could not be completed.',
    retryable: true,
  },
} as const;
export type PlatformErrorCode = keyof typeof PLATFORM_ERRORS;
export type PlatformResult<T = unknown> =
  | { readonly status: 'ok'; readonly data: T }
  | { readonly status: 'error'; readonly code: PlatformErrorCode };
export interface PlatformPort {
  execute(input: {
    readonly operation: PlatformOperation;
    readonly input: Readonly<Record<string, unknown>>;
    readonly context: PlatformContext;
    readonly idempotencyKey?: string;
  }): Promise<PlatformResult>;
}

export function parsePlatformOperationInput(
  operation: PlatformOperation,
  raw: unknown,
):
  | { readonly status: 'ok'; readonly data: Readonly<Record<string, unknown>> }
  | { readonly status: 'error'; readonly code: 'SOURCE_UNSAFE' | 'VALIDATION_FAILED' } {
  const parsed = PLATFORM_OPERATIONS[operation].input.safeParse(raw);
  if (!parsed.success) {
    const unsafe = parsed.error.issues.some((issue) => issue.message === 'SOURCE_UNSAFE');
    return { status: 'error', code: unsafe ? 'SOURCE_UNSAFE' : 'VALIDATION_FAILED' };
  }
  return { status: 'ok', data: parsed.data as Readonly<Record<string, unknown>> };
}

export function createPlatformHandlers(port: PlatformPort) {
  return {
    async execute<O extends PlatformOperation>(
      operation: O,
      raw: unknown,
      context: PlatformContext,
      idempotencyKey?: string,
    ): Promise<PlatformResult<PlatformOutput<O>>> {
      const definition = PLATFORM_OPERATIONS[operation];
      const parsed = parsePlatformOperationInput(operation, raw);
      if (parsed.status === 'error') return parsed;
      if (
        !PlatformContextSchema.safeParse(context).success ||
        (definition.method !== 'GET' && !IdempotencyKeySchema.safeParse(idempotencyKey).success)
      ) {
        return { status: 'error', code: 'VALIDATION_FAILED' };
      }
      try {
        // The port uses the original authenticated JWT. Postgres rechecks grants before replay or mutation.
        const result = await port.execute({
          operation,
          input: parsed.data,
          context,
          ...(idempotencyKey === undefined ? {} : { idempotencyKey }),
        });
        if (result.status === 'error') return result;
        const output = definition.output.safeParse(result.data);
        if (!output.success) return { status: 'error', code: 'INTERNAL_ERROR' };
        return { status: 'ok', data: output.data as PlatformOutput<O> };
      } catch {
        return { status: 'error', code: 'INTERNAL_ERROR' };
      }
    },
  };
}
export type PlatformHandlers = ReturnType<typeof createPlatformHandlers>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Maps a machine capture receipt after Core expected completion. Start/replay views stay on the port. */
export function mapCompletedSourceCapture(value: unknown): PlatformResult {
  const parsed = PLATFORM_OPERATIONS.start_website_capture.output.safeParse(value);
  if (parsed.success) {
    const job = parsed.data.job;
    if (job.status === 'captured' || job.status === 'duplicate') {
      return { status: 'ok', data: parsed.data };
    }
    if (
      (job.status === 'failed' || job.status === 'rejected') &&
      job.failure_code !== null &&
      Object.hasOwn(PLATFORM_ERRORS, job.failure_code)
    ) {
      return { status: 'error', code: job.failure_code };
    }
    return { status: 'error', code: 'SOURCE_INTERRUPTED' };
  }
  if (isRecord(value) && isRecord(value.job) && typeof value.job.failure_code === 'string') {
    const code = value.job.failure_code;
    if (Object.hasOwn(PLATFORM_ERRORS, code))
      return { status: 'error', code: code as PlatformErrorCode };
  }
  return { status: 'error', code: 'INTERNAL_ERROR' };
}
