/** Preserve the supplied instant and microseconds; never assume the workstation timezone. */
export function parseKnowledgeExpiry(value: string): string | null {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|([+-])(\d{2}):(\d{2}))$/u,
  );
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const offsetHour = Number(match[10] ?? 0);
  const offsetMinute = Number(match[11] ?? 0);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1]! ||
    Number(match[4]) > 23 ||
    Number(match[5]) > 59 ||
    Number(match[6]) > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  )
    return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999)
    return null;
  return value;
}

export function knowledgeExpiryInstant(value: string): bigint | null {
  if (parseKnowledgeExpiry(value) === null) return null;
  const fraction = value.match(/\.(\d{1,6})(?:Z|[+-])/u)?.[1] ?? '';
  return (
    BigInt(Math.floor(Date.parse(value) / 1000)) * 1_000_000n + BigInt(fraction.padEnd(6, '0'))
  );
}
