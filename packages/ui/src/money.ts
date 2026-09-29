const USD_MICROS_PER_CENT = 10_000n;
const USD_CENTS_PER_DOLLAR = 100n;

function groupThousands(value: bigint): string {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/gu, ',');
}

/** Formats integer USD micros without converting through a floating-point number. */
export function formatUsdMicros(micros: bigint): string {
  const negative = micros < 0n;
  const absoluteMicros = negative ? -micros : micros;
  const roundedCents = (absoluteMicros + USD_MICROS_PER_CENT / 2n) / USD_MICROS_PER_CENT;
  const dollars = roundedCents / USD_CENTS_PER_DOLLAR;
  const cents = roundedCents % USD_CENTS_PER_DOLLAR;
  return `${negative ? '-' : ''}$${groupThousands(dollars)}.${cents.toString().padStart(2, '0')}`;
}
