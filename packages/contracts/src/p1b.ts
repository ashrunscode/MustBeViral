import { z } from 'zod';

import { HandlerContextSchema, IdempotencyKeySchema, IdentifierSchema } from './commands';
import { WireTimestampSchema } from './http';
import { API_KEY_SCOPES, type ApiKeyScope } from './scopes';

export const ApiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const CreateApiKeyBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    scopes: z.array(ApiKeyScopeSchema).min(1),
  })
  .strict();

export const CreateApiKeyResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
    name: z.string().trim().min(1).max(120),
    scopes: z.array(ApiKeyScopeSchema).min(1),
  })
  .strict();

export const RevokeApiKeyResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    key_id: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const ListApiKeysResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

export const IssueOAuthTokenBodySchema = z
  .object({
    grant_type: z.literal('client_credentials'),
    client_id: z.string().trim().min(8).max(120),
    client_secret: z.string().trim().min(16).max(256),
  })
  .strict();

export const CreateOAuthClientBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    scopes: z.array(ApiKeyScopeSchema).min(1),
  })
  .strict();

export const CreateOAuthClientResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
    name: z.string().trim().min(1).max(120),
    scopes: z.array(ApiKeyScopeSchema).min(1),
  })
  .strict();

export const RevokeOAuthClientResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    client_uuid: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
  })
  .strict();

export const ListOAuthClientsResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

export const PublishSkillBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().min(1).max(32_000),
  })
  .strict();

export const PublishSkillResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
    idempotency_key: IdempotencyKeySchema,
    name: z.string().trim().min(1).max(120),
    title: z.string().trim().min(1).max(200),
    instructions: z.string().trim().min(1).max(32_000),
  })
  .strict();

export const ListSkillsResourceInputSchema = z
  .object({
    context: HandlerContextSchema,
    workspace_id: IdentifierSchema,
  })
  .strict();

export const ApiKeyRecordSchema = z
  .object({
    id: IdentifierSchema,
    name: z.string().min(1),
    prefix: z.string().min(1),
    scopes: z.array(ApiKeyScopeSchema),
    created_at: WireTimestampSchema,
    last_used_at: WireTimestampSchema.nullable(),
    revoked_at: WireTimestampSchema.nullable(),
  })
  .strict();

export const CreateApiKeySuccessSchema = z
  .object({
    key: ApiKeyRecordSchema,
    secret: z.string().regex(/^mbv_sk_[a-f0-9]{64}$/u),
  })
  .strict();

export const ListApiKeysSuccessSchema = z
  .object({
    keys: z.array(ApiKeyRecordSchema),
  })
  .strict();

export const RevokeApiKeySuccessSchema = z
  .object({
    key_id: IdentifierSchema,
    revoked_at: WireTimestampSchema,
  })
  .strict();

export const OAuthClientRecordSchema = z
  .object({
    id: IdentifierSchema,
    client_id: z.string().min(1),
    name: z.string().min(1),
    scopes: z.array(ApiKeyScopeSchema),
    created_at: WireTimestampSchema,
    revoked_at: WireTimestampSchema.nullable(),
  })
  .strict();

export const CreateOAuthClientSuccessSchema = z
  .object({
    client: OAuthClientRecordSchema,
    client_secret: z.string().regex(/^mbv_client_[a-f0-9]{64}$/u),
  })
  .strict();

export const ListOAuthClientsSuccessSchema = z
  .object({
    clients: z.array(OAuthClientRecordSchema),
  })
  .strict();

export const IssueOAuthTokenSuccessSchema = z
  .object({
    access_token: z.string().regex(/^mbv_oauth_[a-f0-9]{64}$/u),
    token_type: z.literal('Bearer'),
    expires_in: z.number().int().positive(),
    scope: z.string().min(1),
  })
  .strict();

export const SkillVersionRecordSchema = z
  .object({
    skill_id: IdentifierSchema,
    skill_version_id: IdentifierSchema,
    name: z.string().min(1),
    version_number: z.number().int().positive(),
    title: z.string().min(1),
    published_at: WireTimestampSchema,
  })
  .strict();

export const PublishSkillSuccessSchema = SkillVersionRecordSchema;

export const ListSkillsSuccessSchema = z
  .object({
    skills: z.array(
      z
        .object({
          id: IdentifierSchema,
          name: z.string().min(1),
          latest_version: SkillVersionRecordSchema.nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export const RevokeOAuthClientSuccessSchema = z
  .object({
    client_uuid: IdentifierSchema,
    revoked_at: WireTimestampSchema,
  })
  .strict();

export const P1B_JWT_MANAGEMENT_OPERATIONS = [
  'create_api_key',
  'list_api_keys',
  'revoke_api_key',
  'create_oauth_client',
  'list_oauth_clients',
  'revoke_oauth_client',
  'publish_skill',
  'list_skills',
] as const;

export type P1bJwtManagementOperation = (typeof P1B_JWT_MANAGEMENT_OPERATIONS)[number];

export const P1B_OPERATION_DATA_SCHEMAS = {
  create_api_key: CreateApiKeySuccessSchema,
  list_api_keys: ListApiKeysSuccessSchema,
  revoke_api_key: RevokeApiKeySuccessSchema,
  create_oauth_client: CreateOAuthClientSuccessSchema,
  list_oauth_clients: ListOAuthClientsSuccessSchema,
  revoke_oauth_client: RevokeOAuthClientSuccessSchema,
  issue_oauth_token: IssueOAuthTokenSuccessSchema,
  publish_skill: PublishSkillSuccessSchema,
  list_skills: ListSkillsSuccessSchema,
} as const;

export type P1bHandlerResult =
  | Readonly<{ status: 'ok'; data: unknown }>
  | Readonly<{ status: 'forbidden' }>
  | Readonly<{ status: 'not_found' }>
  | Readonly<{ status: 'conflict'; reason: 'idempotency' }>
  | Readonly<{ status: 'validation_failed' }>
  | Readonly<{ status: 'unauthenticated' }>;

export interface ProgrammaticAuthPort {
  createApiKey(
    input: z.infer<typeof CreateApiKeyResourceInputSchema> & {
      prefix: string;
      secretHash: string;
    },
  ): Promise<P1bHandlerResult>;
  listApiKeys(input: z.infer<typeof ListApiKeysResourceInputSchema>): Promise<P1bHandlerResult>;
  revokeApiKey(input: z.infer<typeof RevokeApiKeyResourceInputSchema>): Promise<P1bHandlerResult>;
  createOAuthClient(
    input: z.infer<typeof CreateOAuthClientResourceInputSchema> & {
      clientId: string;
      clientSecretHash: string;
    },
  ): Promise<P1bHandlerResult>;
  listOAuthClients(
    input: z.infer<typeof ListOAuthClientsResourceInputSchema>,
  ): Promise<P1bHandlerResult>;
  revokeOAuthClient(
    input: z.infer<typeof RevokeOAuthClientResourceInputSchema>,
  ): Promise<P1bHandlerResult>;
  issueOAuthToken(input: {
    clientId: string;
    clientSecretHash: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<P1bHandlerResult>;
  publishSkill(input: z.infer<typeof PublishSkillResourceInputSchema>): Promise<P1bHandlerResult>;
  listSkills(input: z.infer<typeof ListSkillsResourceInputSchema>): Promise<P1bHandlerResult>;
}

export function scopesToWireValue(scopes: readonly ApiKeyScope[]): string {
  return [...scopes].join(' ');
}
