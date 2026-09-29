import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Jwt } from 'hono/utils/jwt';

import {
  clearSupabaseJwksCacheForTests,
  createSupabaseJwtVerifier,
} from '../../src/auth/supabase-jwt';

const bindings = {
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_JWT_AUDIENCE: 'authenticated',
} as unknown as PlatformBindings;

type VerificationKey = NonNullable<Parameters<typeof Jwt.verifyWithJwks>[1]['keys']>[number];

async function signedToken(): Promise<Readonly<{ publicKey: VerificationKey; token: string }>> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  if (!('privateKey' in pair)) throw new TypeError('Expected an asymmetric fixture key pair');
  const [privateKey, publicKey] = await Promise.all([
    crypto.subtle.exportKey('jwk', pair.privateKey),
    crypto.subtle.exportKey('jwk', pair.publicKey),
  ]);
  if (privateKey instanceof ArrayBuffer || publicKey instanceof ArrayBuffer) {
    throw new TypeError('Expected JSON Web Key fixtures');
  }
  const keyId = 'fixture-es256-key';
  const now = Math.floor(Date.now() / 1000);
  const signingKey: VerificationKey = {
    ...privateKey,
    alg: 'ES256',
    kid: keyId,
    use: 'sig',
  };
  return {
    publicKey: { ...publicKey, alg: 'ES256', kid: keyId, use: 'sig' },
    token: await Jwt.sign(
      {
        sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
        iss: 'https://project.supabase.co/auth/v1',
        aud: 'authenticated',
        iat: now,
        exp: now + 3600,
      },
      signingKey,
      'ES256',
    ),
  };
}

describe('Supabase JWT verification-key cache', () => {
  beforeEach(() => clearSupabaseJwksCacheForTests());
  afterEach(() => {
    clearSupabaseJwksCacheForTests();
    vi.restoreAllMocks();
  });

  it('reuses public JWKS material across requests until its TTL expires', async () => {
    const fixture = await signedToken();
    let clock = Date.now();
    const fetchImplementation = vi.fn<typeof fetch>(async () =>
      Response.json({ keys: [fixture.publicKey] }),
    );
    const verifier = createSupabaseJwtVerifier(fetchImplementation, () => clock);

    await expect(verifier.verify(fixture.token, bindings)).resolves.toEqual({
      actorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      authenticationMethod: 'supabase_jwt',
    });
    await expect(verifier.verify(fixture.token, bindings)).resolves.toMatchObject({
      authenticationMethod: 'supabase_jwt',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(1);

    clock += 5 * 60 * 1000 + 1;
    await expect(verifier.verify(fixture.token, bindings)).resolves.toMatchObject({
      authenticationMethod: 'supabase_jwt',
    });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
