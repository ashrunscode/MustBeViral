declare const usdMicrosBrand: unique symbol;

export type UsdMicros = bigint & { readonly [usdMicrosBrand]: true };

export const ZERO_USD_MICROS = 0n as UsdMicros;

export function usdMicros(value: bigint): UsdMicros {
  if (typeof value !== 'bigint' || value < 0n) {
    throw new RangeError('USD micros must be a non-negative bigint');
  }
  return value as UsdMicros;
}

export function positiveUsdMicros(value: bigint): UsdMicros {
  const amount = usdMicros(value);
  if (amount === 0n) {
    throw new RangeError('USD micros must be greater than zero');
  }
  return amount;
}

export function addUsdMicros(left: UsdMicros, right: UsdMicros): UsdMicros {
  return usdMicros(left + right);
}

export function multiplyUsdMicros(unitPrice: UsdMicros, units: bigint): UsdMicros {
  if (typeof units !== 'bigint' || units < 0n) {
    throw new RangeError('Pricing units must be a non-negative bigint');
  }
  return usdMicros(unitPrice * units);
}

export function usdMicrosToSafeInteger(amount: UsdMicros): number {
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('USD micros exceed the database invariant safe-integer boundary');
  }
  return Number(amount);
}
