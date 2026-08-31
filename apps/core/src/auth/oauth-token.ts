import type { ApiKeyScope } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import type { AuthenticatedActor } from './actor';

export interface OAuthTokenVerifier {
  verify(token: string, bindings: CoreBindings): Promise<AuthenticatedActor>;
}

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
    authenticationMethod: 'oauth_token',
    workspaceId: value.workspace_id,
    scopes: Object.freeze([...(value.scopes as ApiKeyScope[])]),
    ...(typeof value.token_id === 'string' ? { credentialId: value.token_id } : {}),
  };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isOAuthAccessToken(token: string): boolean {
  return token.startsWith('mbv_oauth_');
}

export function createOAuthTokenVerifier(
  fetchImplementation: typeof fetch = fetch,
): OAuthTokenVerifier {
  return {
    async verify(token, bindings) {
      if (!isOAuthAccessToken(token)) throw new Error('Not an OAuth access token');
      const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
      const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
      if (!baseUrl || !privilegedKey) throw new Error('OAuth token verification is not configured');

      const tokenHash = await sha256Hex(token);
      const response = await fetchImplementation(
        `${baseUrl}/rest/v1/rpc/verify_oauth_access_token`,
        {
          method: 'POST',
          headers: {
            accept: 'application/json',
            apikey: privilegedKey,
            authorization: `Bearer ${privilegedKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ p_token_hash: tokenHash }),
        },
      );
      if (!response.ok) throw new Error('OAuth token verification failed');

      const actor = parseVerificationPayload(await response.json());
      if (actor === null) throw new Error('OAuth token is invalid, expired, or revoked');
      return actor;
    },
  };
}

export const oauthTokenVerifier = createOAuthTokenVerifier();

export async function hashOAuthAccessToken(token: string): Promise<string> {
  return sha256Hex(token);
}
