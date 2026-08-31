import type { ApiKeyScope } from './scopes';
import {
  CreateApiKeyResourceInputSchema,
  CreateOAuthClientResourceInputSchema,
  ListApiKeysResourceInputSchema,
  ListOAuthClientsResourceInputSchema,
  ListSkillsResourceInputSchema,
  PublishSkillResourceInputSchema,
  RevokeApiKeyResourceInputSchema,
  RevokeOAuthClientResourceInputSchema,
  type ProgrammaticAuthPort,
  type P1bHandlerResult,
} from './p1b';

export interface CredentialGenerator {
  generateApiKey(): Readonly<{ token: string; prefix: string }>;
  generateOAuthClient(): Readonly<{ clientId: string; clientSecret: string }>;
  generateOAuthAccessToken(): Readonly<{ token: string }>;
  hashSecret(value: string): Promise<string>;
}

export function createP1bHandlers(port: ProgrammaticAuthPort, credentials: CredentialGenerator) {
  return {
    async create_api_key(input: unknown): Promise<P1bHandlerResult> {
      const parsed = CreateApiKeyResourceInputSchema.parse(input);
      const generated = credentials.generateApiKey();
      const secretHash = await credentials.hashSecret(generated.token);
      const result = await port.createApiKey({
        ...parsed,
        prefix: generated.prefix,
        secretHash,
      });
      if (result.status !== 'ok') return result;
      return {
        status: 'ok',
        data: {
          ...(result.data as Readonly<Record<string, unknown>>),
          secret: generated.token,
        },
      };
    },
    async list_api_keys(input: unknown): Promise<P1bHandlerResult> {
      return port.listApiKeys(ListApiKeysResourceInputSchema.parse(input));
    },
    async revoke_api_key(input: unknown): Promise<P1bHandlerResult> {
      return port.revokeApiKey(RevokeApiKeyResourceInputSchema.parse(input));
    },
    async create_oauth_client(input: unknown): Promise<P1bHandlerResult> {
      const parsed = CreateOAuthClientResourceInputSchema.parse(input);
      const generated = credentials.generateOAuthClient();
      const clientSecretHash = await credentials.hashSecret(generated.clientSecret);
      const result = await port.createOAuthClient({
        ...parsed,
        clientId: generated.clientId,
        clientSecretHash,
      });
      if (result.status !== 'ok') return result;
      return {
        status: 'ok',
        data: {
          ...(result.data as Readonly<Record<string, unknown>>),
          client_secret: generated.clientSecret,
        },
      };
    },
    async list_oauth_clients(input: unknown): Promise<P1bHandlerResult> {
      return port.listOAuthClients(ListOAuthClientsResourceInputSchema.parse(input));
    },
    async revoke_oauth_client(input: unknown): Promise<P1bHandlerResult> {
      return port.revokeOAuthClient(RevokeOAuthClientResourceInputSchema.parse(input));
    },
    async issue_oauth_token(input: {
      clientId: string;
      clientSecret: string;
    }): Promise<P1bHandlerResult> {
      const clientSecretHash = await credentials.hashSecret(input.clientSecret);
      const generated = credentials.generateOAuthAccessToken();
      const tokenHash = await credentials.hashSecret(generated.token);
      const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
      const result = await port.issueOAuthToken({
        clientId: input.clientId,
        clientSecretHash,
        tokenHash,
        expiresAt,
      });
      if (result.status !== 'ok') return result;
      const payload = result.data as Readonly<{ scopes: readonly ApiKeyScope[] }>;
      return {
        status: 'ok',
        data: {
          access_token: generated.token,
          token_type: 'Bearer',
          expires_in: 3600,
          scope: payload.scopes.join(' '),
        },
      };
    },
    async publish_skill(input: unknown): Promise<P1bHandlerResult> {
      return port.publishSkill(PublishSkillResourceInputSchema.parse(input));
    },
    async list_skills(input: unknown): Promise<P1bHandlerResult> {
      return port.listSkills(ListSkillsResourceInputSchema.parse(input));
    },
  };
}

export type P1bHandlers = ReturnType<typeof createP1bHandlers>;
