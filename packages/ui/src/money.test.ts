import { describe, expect, it } from 'vitest';

import { formatUsdMicros } from './money';

describe('formatUsdMicros', () => {
  it.each([
    [0n, '$0.00'],
    [1n, '$0.00'],
    [5_000n, '$0.01'],
    [1_234_567n, '$1.23'],
    [4_200_000n, '$4.20'],
    [-1_235_000n, '-$1.24'],
    [9_007_199_254_740_991_000_000n, '$9,007,199,254,740,991.00'],
  ])('formats %s micros as %s without number coercion', (micros, expected) => {
    expect(formatUsdMicros(micros)).toBe(expected);
  });
});
