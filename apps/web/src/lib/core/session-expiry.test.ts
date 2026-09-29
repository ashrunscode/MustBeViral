import { MustBeViralClientError } from '@mustbeviral/contracts';
import { describe, expect, it } from 'vitest';

import { isSessionExpiredFailure } from './session-expiry';

describe('Core session-expiry classifier', () => {
  it('classifies a missing browser token and an expired Core bearer session', () => {
    expect(
      isSessionExpiredFailure(
        new MustBeViralClientError('A session is required.', 'AUTH_REQUIRED'),
      ),
    ).toBe(true);
    expect(isSessionExpiredFailure({ code: 'UNAUTHENTICATED' })).toBe(true);
  });

  it('does not relabel configuration, authorization, or transport failures', () => {
    expect(
      isSessionExpiredFailure(new MustBeViralClientError('Bad response.', 'INVALID_RESPONSE')),
    ).toBe(false);
    expect(isSessionExpiredFailure({ code: 'FORBIDDEN' })).toBe(false);
    expect(isSessionExpiredFailure(new Error('offline'))).toBe(false);
  });
});
