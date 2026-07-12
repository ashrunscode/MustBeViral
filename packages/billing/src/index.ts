declare const usdMicrosBrand: unique symbol;

export type UsdMicros = number & { readonly [usdMicrosBrand]: true };

export function usdMicros(value: number): UsdMicros {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('USD micros must be a non-negative safe integer');
  }
  return value as UsdMicros;
}

export function addUsdMicros(left: UsdMicros, right: UsdMicros): UsdMicros {
  return usdMicros(left + right);
}
