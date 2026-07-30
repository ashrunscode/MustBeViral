import { describe, expect, it } from 'vitest';

import type { CoreBindings } from '../../src/bindings';
import {
  ConfirmationSigningUnavailableError,
  mintConfirmationToken,
  verifyConfirmationToken,
  type ConfirmationClaims,
} from '../../src/composition/confirmation-token';

// The consent gate on real money. Before this existed, any string of 16+ characters passed, so an
// agent holding a quote id could self-confirm spend - contradicting the MCP contract rule that
// tool descriptions cannot imply autonomous spending.

const KEY = { CONFIRMATION_SIGNING_KEY: 'k'.repeat(32) };
const OTHER_KEY = { CONFIRMATION_SIGNING_KEY: 'x'.repeat(32) };
const NO_KEY: Pick<CoreBindings, 'CONFIRMATION_SIGNING_KEY'> = {};

const CLAIMS: ConfirmationClaims = {
  quoteId: 'quote-1',
  workspaceId: 'workspace-1',
  actorId: 'actor-1',
  maximumChargeMicros: 4_550_000n,
};

describe('confirmation tokens', () => {
  it('round-trips: a minted token verifies for the same claims', async () => {
    const token = await mintConfirmationToken(KEY, CLAIMS);
    await expect(verifyConfirmationToken(KEY, token, CLAIMS)).resolves.toBe(true);
  });

  it.each([
    ['a different quote', { ...CLAIMS, quoteId: 'quote-2' }],
    ['a different workspace', { ...CLAIMS, workspaceId: 'workspace-2' }],
    ['a different actor', { ...CLAIMS, actorId: 'actor-2' }],
    ['a different amount', { ...CLAIMS, maximumChargeMicros: 4_550_001n }],
  ])('rejects a token replayed against %s', async (_label, claims) => {
    const token = await mintConfirmationToken(KEY, CLAIMS);
    await expect(verifyConfirmationToken(KEY, token, claims)).resolves.toBe(false);
  });

  it('rejects a token minted under a different key', async () => {
    const token = await mintConfirmationToken(OTHER_KEY, CLAIMS);
    await expect(verifyConfirmationToken(KEY, token, CLAIMS)).resolves.toBe(false);
  });

  it.each([
    ['the old 16-character fabrication', 'aaaaaaaaaaaaaaaa'],
    ['an empty string', ''],
    ['a version-only token', 'confirm-v1.'],
    ['garbage base64url', 'confirm-v1.!!!not-base64!!!'],
    ['a truncated signature', 'confirm-v1.YWJj'],
  ])('rejects %s', async (_label, token) => {
    await expect(verifyConfirmationToken(KEY, token, CLAIMS)).resolves.toBe(false);
  });

  it('fails closed when the signing key is absent: mint throws, verify refuses', async () => {
    await expect(mintConfirmationToken(NO_KEY, CLAIMS)).rejects.toBeInstanceOf(
      ConfirmationSigningUnavailableError,
    );
    const token = await mintConfirmationToken(KEY, CLAIMS);
    await expect(verifyConfirmationToken(NO_KEY, token, CLAIMS)).resolves.toBe(false);
  });

  it('fails closed on a key shorter than 32 characters', async () => {
    const shortKey = { CONFIRMATION_SIGNING_KEY: 'short' };
    await expect(mintConfirmationToken(shortKey, CLAIMS)).rejects.toBeInstanceOf(
      ConfirmationSigningUnavailableError,
    );
  });

  it('refuses claims that could smuggle a delimiter into the canonical payload', async () => {
    await expect(
      mintConfirmationToken(KEY, { ...CLAIMS, quoteId: 'quote|1' }),
    ).rejects.toBeInstanceOf(RangeError);
  });
});
