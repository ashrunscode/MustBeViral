import { Jwt } from 'hono/utils/jwt';

import type { CoreBindings } from '../bindings';
import type { AuthenticatedActor } from './actor';

export type { AuthenticatedActor };

export interface SupabaseJwtVerifier {
  verify(token: string, bindings: CoreBindings): Promise<AuthenticatedActor>;
}

type VerificationKey = NonNullable<Parameters<typeof Jwt.verifyWithJwks>[1]['keys']>[number];

interface CachedJwks {
  readonly expiresAt: number;
  readonly keys: readonly VerificationKey[];
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;
const jwksCache = new Map<string, CachedJwks>();

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isVerificationKey(value: unknown): value is VerificationKey {
  return (
    isRecord(value) &&
    typeof value.kid === 'string' &&
    value.kid.length > 0 &&
    typeof value.kty === 'string' &&
    value.kty.length > 0
  );
}

async function getVerificationKeys(
  jwksUri: string,
  fetchImplementation: typeof fetch,
  now: () => number,
): Promise<readonly VerificationKey[]> {
  const cached = jwksCache.get(jwksUri);
  if (cached !== undefined && cached.expiresAt > now()) return cached.keys;

  const response = await fetchImplementation(jwksUri, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Supabase JWKS is unavailable');
  const payload = (await response.json()) as unknown;
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.keys) ||
    !payload.keys.every(isVerificationKey)
  ) {
    throw new Error('Supabase JWKS response is invalid');
  }
  const keys = Object.freeze([...payload.keys]);
  // Only public verification material is retained; no token or caller state enters this cache.
  jwksCache.set(jwksUri, { expiresAt: now() + JWKS_CACHE_TTL_MS, keys });
  return keys;
}

export function clearSupabaseJwksCacheForTests(): void {
  jwksCache.clear();
}

export function createSupabaseJwtVerifier(
  fetchImplementation: typeof fetch = fetch,
  now: () => number = Date.now,
): SupabaseJwtVerifier {
  return {
    async verify(token, bindings) {
      const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
      if (baseUrl === undefined || baseUrl.length === 0) {
        throw new Error('Supabase JWT issuer is not configured');
      }
      const jwksUri = `${baseUrl}/auth/v1/.well-known/jwks.json`;
      const keys = await getVerificationKeys(jwksUri, fetchImplementation, now);
      const payload = await Jwt.verifyWithJwks(token, {
        keys: [...keys],
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
}

export const supabaseJwtVerifier = createSupabaseJwtVerifier();
