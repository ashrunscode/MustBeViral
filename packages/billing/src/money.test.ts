import { describe, expect, it } from 'vitest';

import {
  ZERO_USD_MICROS,
  addUsdMicros,
  multiplyUsdMicros,
  positiveUsdMicros,
  usdMicros,
  usdMicrosToSafeInteger,
} from './money';

describe('USD micros', () => {
  it('uses bigint arithmetic exclusively', () => {
    const total = addUsdMicros(usdMicros(1_250_000n), usdMicros(250_000n));
    expect(total).toBe(1_500_000n);
    expect(typeof total).toBe('bigint');
    expect(ZERO_USD_MICROS).toBe(0n);
  });

  it('multiplies integer unit prices without rounding', () => {
    expect(multiplyUsdMicros(usdMicros(146_000n), 10n)).toBe(1_460_000n);
  });

  it('rejects number and negative values', () => {
    expect(() => usdMicros(1 as unknown as bigint)).toThrow(RangeError);
    expect(() => usdMicros(-1n)).toThrow(RangeError);
    expect(() => multiplyUsdMicros(usdMicros(1n), -1n)).toThrow(RangeError);
  });

  it('distinguishes non-negative values from positive ledger movements', () => {
    expect(usdMicros(0n)).toBe(0n);
    expect(() => positiveUsdMicros(0n)).toThrow(RangeError);
  });

  it('adapts exact safe values to packages/db invariant numbers', () => {
    expect(usdMicrosToSafeInteger(usdMicros(100_000_000n))).toBe(100_000_000);
    expect(() => usdMicrosToSafeInteger(usdMicros(BigInt(Number.MAX_SAFE_INTEGER) + 1n))).toThrow(
      RangeError,
    );
  });
});
