export const SOURCE_CAPTURE_MAX_BYTES = 2 * 1024 * 1024;
export const SOURCE_CAPTURE_DEADLINE_MS = 10_000;
export const SOURCE_CAPTURE_MAX_REDIRECTS = 3;
export const SOURCE_CAPTURE_LEASE_SECONDS = 20;
export const SOURCE_CAPTURE_MAX_ATTEMPTS = 3;
export const SOURCE_DOCUMENT_TEXT_MAX_CHARS = 32_768;
export const SOURCE_CANDIDATE_PAGE_MAX = 50;
export const SOURCE_CANDIDATES_PER_CAPTURE_MAX = 40;
export const SOURCE_CAPTURE_RETRYABLE_FAILURES = [
  'SOURCE_TIMEOUT',
  'SOURCE_UNREACHABLE',
  'SOURCE_INTERRUPTED',
  'SOURCE_EGRESS_UNAVAILABLE',
] as const;

const BLOCKED_HOST_EXACT = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
  'kubernetes',
  'unix',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.intranet',
  '.home.arpa',
] as const;

export type SourceUrlDenial =
  'credentials' | 'protocol' | 'port' | 'hostname' | 'private_address' | 'malformed';

export type SourceUrlClassification =
  | { readonly ok: true; readonly href: string; readonly hostname: string }
  | { readonly ok: false; readonly reason: SourceUrlDenial };

function ipv4ToInt(parts: readonly number[]): number {
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

function parseIpv4(value: string): readonly [number, number, number, number] | null {
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/u.test(value)) return null;
  const parts = value.split('.').map((part) => Number(part));
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }
  return [parts[0]!, parts[1]!, parts[2]!, parts[3]!];
}

function inCidr(
  parts: readonly [number, number, number, number],
  network: readonly [number, number, number, number],
  prefix: number,
): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(parts) & mask) === (ipv4ToInt(network) & mask);
}

function ipv4IsDenied(parts: readonly [number, number, number, number]): boolean {
  return (
    inCidr(parts, [0, 0, 0, 0], 8) ||
    inCidr(parts, [10, 0, 0, 0], 8) ||
    inCidr(parts, [100, 64, 0, 0], 10) ||
    inCidr(parts, [127, 0, 0, 0], 8) ||
    inCidr(parts, [169, 254, 0, 0], 16) ||
    inCidr(parts, [172, 16, 0, 0], 12) ||
    inCidr(parts, [192, 0, 0, 0], 24) ||
    inCidr(parts, [192, 0, 2, 0], 24) ||
    inCidr(parts, [192, 168, 0, 0], 16) ||
    inCidr(parts, [198, 18, 0, 0], 15) ||
    inCidr(parts, [198, 51, 100, 0], 24) ||
    inCidr(parts, [203, 0, 113, 0], 24) ||
    inCidr(parts, [224, 0, 0, 0], 4) ||
    inCidr(parts, [240, 0, 0, 0], 4)
  );
}

function parseIpv6(hostname: string): readonly number[] | null {
  const value =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;
  if (!value.includes(':')) return null;
  const lower = value.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    const mapped = parseIpv4(lower.slice('::ffff:'.length));
    if (mapped)
      return [
        0,
        0,
        0,
        0,
        0,
        0xffff,
        (mapped[0]! << 8) | mapped[1]!,
        (mapped[2]! << 8) | mapped[3]!,
      ];
  }
  const [head, tail] = lower.split('::');
  const parseGroup = (group: string): number[] =>
    group.length === 0 ? [] : group.split(':').map((part) => Number.parseInt(part, 16));
  const start = parseGroup(head ?? '');
  const end = tail === undefined ? [] : parseGroup(tail);
  if (start.some((part) => Number.isNaN(part)) || end.some((part) => Number.isNaN(part)))
    return null;
  if (start.length + end.length > 8) return null;
  const mid = Array.from({ length: 8 - start.length - end.length }, () => 0);
  const groups = [...start, ...mid, ...end];
  return groups.length === 8 ? groups : null;
}

function ipv4FromGroups(high: number, low: number): readonly [number, number, number, number] {
  return [high >> 8, high & 0xff, low >> 8, low & 0xff];
}

function ipv6IsDenied(groups: readonly number[]): boolean {
  const first = groups[0]!;
  const second = groups[1]!;
  const isZeroPrefix = groups.slice(0, 5).every((group) => group === 0);
  if (groups.every((group) => group === 0)) return true;
  if (groups.slice(0, 7).every((group) => group === 0) && groups[7] === 1) return true;
  if (isZeroPrefix && groups[5] === 0xffff)
    return ipv4IsDenied(ipv4FromGroups(groups[6]!, groups[7]!));
  if (isZeroPrefix && groups[5] === 0) return ipv4IsDenied(ipv4FromGroups(groups[6]!, groups[7]!));
  if ((first & 0xfe00) === 0xfc00) return true;
  if ((first & 0xffc0) === 0xfe80) return true;
  if ((first & 0xffc0) === 0xfec0) return true;
  if ((first & 0xff00) === 0xff00) return true;
  if (first === 0x64 && second === 0xff9b)
    return ipv4IsDenied(ipv4FromGroups(groups[6]!, groups[7]!)) || true;
  if (first === 0x2002) return ipv4IsDenied(ipv4FromGroups(second, groups[2]!)) || true;
  if (first === 0x100 && second === 0) return true;
  if (first === 0x2001 && second === 2) return true;
  if (first === 0x2001 && second === 0xdb8) return true;
  if ((first & 0xe000) !== 0x2000) return true;
  return false;
}

function hostnameIsDenied(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/gu, '')
    .toLowerCase()
    .replace(/\.+$/u, '');
  if (BLOCKED_HOST_EXACT.has(host)) return true;
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix));
}

function addressIsDenied(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/gu, '');
  const ipv4 = parseIpv4(host);
  if (ipv4) return ipv4IsDenied(ipv4);
  const ipv6 = parseIpv6(hostname);
  if (ipv6) return ipv6IsDenied(ipv6);
  return hostnameIsDenied(host);
}

export function classifyPublicHttpsUrl(value: string): SourceUrlClassification {
  if (value !== value.trim() || /\s/u.test(value)) return { ok: false, reason: 'malformed' };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'protocol' };
  if (parsed.username.length > 0 || parsed.password.length > 0)
    return { ok: false, reason: 'credentials' };
  if (parsed.port.length > 0 && parsed.port !== '443') return { ok: false, reason: 'port' };
  if (parsed.hostname.length === 0) return { ok: false, reason: 'hostname' };
  if (addressIsDenied(parsed.hostname.replace(/\.+$/u, '')))
    return { ok: false, reason: 'private_address' };
  parsed.hash = '';
  return { ok: true, href: parsed.href, hostname: parsed.hostname.toLowerCase() };
}

export function classifyRedirectTarget(
  currentHref: string,
  location: string | null,
): SourceUrlClassification {
  if (location === null || location.trim().length === 0 || location.length > 2048) {
    return { ok: false, reason: 'malformed' };
  }
  let resolved: URL;
  try {
    resolved = new URL(location, currentHref);
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (resolved.protocol === 'http:') return { ok: false, reason: 'protocol' };
  return classifyPublicHttpsUrl(resolved.href);
}

export function captureLogHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return 'invalid-host';
  }
}

export function dnsAnswerIsDenied(address: string): boolean {
  return addressIsDenied(address);
}
