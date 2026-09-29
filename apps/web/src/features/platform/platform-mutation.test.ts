import { describe, expect, it } from 'vitest';

import { retainIdempotencyAttempt } from './platform-mutation';

describe('platform mutation idempotency', () => {
  it('reuses the key for an identical uncertain retry and issues a new key for different input', () => {
    const first = retainIdempotencyAttempt(null, 'create:washbodega', () => 'key-a');
    expect(first).toEqual({ signature: 'create:washbodega', key: 'key-a' });
    expect(retainIdempotencyAttempt(first, 'create:washbodega', () => 'key-b')).toEqual(first);
    expect(retainIdempotencyAttempt(first, 'create:unpile', () => 'key-c')).toEqual({
      signature: 'create:unpile',
      key: 'key-c',
    });
  });
});
