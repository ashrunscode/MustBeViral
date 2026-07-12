import { describe, expect, it } from 'vitest';

import { addUsdMicros, usdMicros } from './index';

describe('USD micros', () => {
  it('uses integer arithmetic', () => {
    expect(addUsdMicros(usdMicros(1_250_000), usdMicros(250_000))).toBe(1_500_000);
  });

  it('rejects fractional, negative, and unsafe values', () => {
    expect(() => usdMicros(1.5)).toThrow(RangeError);
    expect(() => usdMicros(-1)).toThrow(RangeError);
    expect(() => usdMicros(Number.MAX_SAFE_INTEGER + 1)).toThrow(RangeError);
  });
});
