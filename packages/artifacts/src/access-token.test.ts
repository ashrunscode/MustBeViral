import { describe, expect, it } from 'vitest';

import {
  ArtifactAccessSigningUnavailableError,
  mintArtifactAccessToken,
  verifyArtifactAccessToken,
  type ArtifactAccessClaims,
} from './access-token';

// A capability for exactly one private object. The bucket has zero external readers; these tokens
// are the only path to artifact bytes, so what they refuse matters as much as what they permit.

const KEY = 'artifact-access-signing-key-fixture-32ch';
const OTHER_KEY = 'artifact-access-different-key-fixture-32';

const CLAIMS: ArtifactAccessClaims = {
  purpose: 'provider_input',
  artifactId: 'artifact-1',
  objectKey: 'workspaces/w1/runs/r1/attempts/a1/provider-output',
  contentHash: 'a'.repeat(64),
  byteSize: 107_176,
  mimeType: 'image/jpeg',
  expiresAtEpochSeconds: 2_000_000,
};

const NOW = 1_999_000;

describe('artifact access tokens', () => {
  it('round-trips: a minted token verifies and returns the exact claims', async () => {
    const token = await mintArtifactAccessToken(KEY, CLAIMS);
    const verification = await verifyArtifactAccessToken(KEY, token, NOW);
    expect(verification.valid).toBe(true);
    if (verification.valid) expect(verification.claims).toEqual(CLAIMS);
  });

  it('rejects an expired token', async () => {
    const token = await mintArtifactAccessToken(KEY, CLAIMS);
    const verification = await verifyArtifactAccessToken(KEY, token, CLAIMS.expiresAtEpochSeconds);
    expect(verification).toEqual({ valid: false, reason: 'expired' });
  });

  it('rejects a token signed under a different key', async () => {
    const token = await mintArtifactAccessToken(OTHER_KEY, CLAIMS);
    const verification = await verifyArtifactAccessToken(KEY, token, NOW);
    expect(verification).toEqual({ valid: false, reason: 'signature' });
  });

  it('rejects a payload tampered to point at a different object', async () => {
    // The exact-key property under test: rewriting the object key inside the payload must break
    // the signature, because the key is inside the signed bytes.
    const token = await mintArtifactAccessToken(KEY, CLAIMS);
    const [payload, signature] = token.split('.') as [string, string];
    const decoded = Buffer.from(payload.replace(/-/gu, '+').replace(/_/gu, '/'), 'base64').toString(
      'utf8',
    );
    const swapped = decoded.replace('provider-output', 'someone-elses-object');
    const reEncoded = Buffer.from(swapped, 'utf8')
      .toString('base64')
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_')
      .replace(/=/gu, '');
    const verification = await verifyArtifactAccessToken(KEY, `${reEncoded}.${signature}`, NOW);
    expect(verification).toEqual({ valid: false, reason: 'signature' });
  });

  it.each([
    ['an empty string', ''],
    ['a single segment', 'not-a-token'],
    ['three segments', 'a.b.c'],
    ['garbage base64', '!!!.###'],
    ['a truncated signature', 'djF8YQ.YWJj'],
  ])('rejects %s as malformed', async (_label, token) => {
    const verification = await verifyArtifactAccessToken(KEY, token, NOW);
    expect(verification.valid).toBe(false);
  });

  it('fails closed without a signing key: mint throws, verify refuses', async () => {
    await expect(mintArtifactAccessToken(undefined, CLAIMS)).rejects.toBeInstanceOf(
      ArtifactAccessSigningUnavailableError,
    );
    const token = await mintArtifactAccessToken(KEY, CLAIMS);
    const verification = await verifyArtifactAccessToken(undefined, token, NOW);
    expect(verification).toEqual({ valid: false, reason: 'unconfigured' });
  });

  it('refuses claims that could smuggle a delimiter into the canonical payload', async () => {
    await expect(
      mintArtifactAccessToken(KEY, { ...CLAIMS, mimeType: 'image/jpeg|text/html' }),
    ).rejects.toBeInstanceOf(RangeError);
  });

  it('refuses an unknown purpose at mint time', async () => {
    await expect(
      mintArtifactAccessToken(KEY, {
        ...CLAIMS,
        purpose: 'admin_everything' as ArtifactAccessClaims['purpose'],
      }),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
