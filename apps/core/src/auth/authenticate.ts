import {
  scopesAuthorizeOperation,
  type P0AuthenticatedRestOperation,
} from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import type { AuthenticatedActor } from './actor';
import { apiKeyVerifier, isApiKeyToken } from './api-key';
import { isOAuthAccessToken, oauthTokenVerifier } from './oauth-token';
import type { SupabaseJwtVerifier } from './supabase-jwt';

export interface RequestAuthenticator {
  authenticate(
    token: string,
    bindings: CoreBindings,
  ): Promise<Readonly<{ actor: AuthenticatedActor; callerJwt?: string }>>;
  authorizeOperation(actor: AuthenticatedActor, operation: P0AuthenticatedRestOperation): boolean;
}

export function createRequestAuthenticator(jwt: SupabaseJwtVerifier): RequestAuthenticator {
  return {
    async authenticate(token: string, bindings: CoreBindings) {
      if (isApiKeyToken(token)) {
        return { actor: await apiKeyVerifier.verify(token, bindings) };
      }
      if (isOAuthAccessToken(token)) {
        return { actor: await oauthTokenVerifier.verify(token, bindings) };
      }
      return { actor: await jwt.verify(token, bindings), callerJwt: token };
    },
    authorizeOperation(actor: AuthenticatedActor, operation: P0AuthenticatedRestOperation) {
      if (actor.authenticationMethod === 'supabase_jwt') return true;
      const grantedScopes = actor.scopes ?? [];
      return scopesAuthorizeOperation(grantedScopes, operation);
    },
  };
}
