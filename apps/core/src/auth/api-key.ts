import type { ApiKeyScope } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import type { AuthenticatedActor } from './actor';

export interface ApiKeyVerifier {
  verify(token: string, bindings: CoreBindings): Promise<AuthenticatedActor>;
}

type PrivilegedBindings = Pick<
  CoreBindings,
  'SUPABASE_URL' | 'SUPABASE_SECRET_KEY' | 'SUPABASE_SERVICE_ROLE_KEY'
>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseVerificationPayload(value: unknown): AuthenticatedActor | null {
  if (!isRecord(value) || value.ok !== true) return null;
  if (typeof value.actor_id !== 'string' || typeof value.workspace_id !== 'string') return null;
  if (!Array.isArray(value.scopes) || !value.scopes.every((scope) => typeof scope === 'string')) {
    return null;
  }
  return {
    actorId: value.actor_id,
    authenticationMethod: 'api_key',
    workspaceId: value.workspace_id,
    scopes: Object.freeze([...(value.scopes as ApiKeyScope[])]),
    ...(typeof value.key_id === 'string' ? { credentialId: value.key_id } : {}),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isApiKeyToken(token: string): boolean {
  return token.startsWith('mbv_sk_');
}

export function createApiKeyVerifier(fetchImplementation: typeof fetch = fetch): ApiKeyVerifier {
  return {
    async verify(token, bindings) {
      if (!isApiKeyToken(token)) throw new Error('Not an API key token');
      const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
      const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
      if (!baseUrl || !privilegedKey) throw new Error('API key verification is not configured');

      const secretHash = await sha256Hex(token);
      const response = await fetchImplementation(`${baseUrl}/rest/v1/rpc/verify_api_key`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: privilegedKey,
          authorization: `Bearer ${privilegedKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ p_secret_hash: secretHash }),
      });
      if (!response.ok) throw new Error('API key verification failed');

      const actor = parseVerificationPayload(await response.json());
      if (actor === null) throw new Error('API key is invalid or revoked');
      return actor;
    },
  };
}

export const apiKeyVerifier = createApiKeyVerifier();

export async function hashApiKeySecret(token: string): Promise<string> {
  return sha256Hex(token);
}

export type { PrivilegedBindings };
