import { Jwt } from 'hono/utils/jwt';

import type { CoreBindings } from '../bindings';

export interface AuthenticatedActor {
  readonly actorId: string;
  readonly authenticationMethod: 'supabase_jwt';
}

export interface SupabaseJwtVerifier {
  verify(token: string, bindings: CoreBindings): Promise<AuthenticatedActor>;
}

export const supabaseJwtVerifier: SupabaseJwtVerifier = {
  async verify(token, bindings) {
    const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
    if (baseUrl === undefined || baseUrl.length === 0) {
      throw new Error('Supabase JWT issuer is not configured');
    }
    const payload = await Jwt.verifyWithJwks(token, {
      jwks_uri: `${baseUrl}/auth/v1/.well-known/jwks.json`,
      allowedAlgorithms: ['RS256', 'ES256'],
      verification: {
        iss: `${baseUrl}/auth/v1`,
        aud: bindings.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
        exp: true,
        nbf: true,
        iat: true,
      },
    });
    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Supabase JWT subject is missing');
    }
    return { actorId: payload.sub, authenticationMethod: 'supabase_jwt' };
  },
};
