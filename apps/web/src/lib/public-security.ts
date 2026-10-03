type PublicSecuritySources = Readonly<{
  supabase?: string | undefined;
  core?: string | undefined;
  collaboration?: string | undefined;
  development: boolean;
}>;

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
const cspDelimiters = new Set([';', "'", '"', '<', '>']);

/** Normalize public service URLs before putting them in a CSP; never include input in errors. */
function serviceOrigin(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined;
  try {
    if (
      [...value].some((character) => {
        const code = character.charCodeAt(0);
        return code <= 32 || code === 127 || cspDelimiters.has(character);
      })
    )
      throw new Error();
    const url = new URL(value);
    if (
      url.username !== '' ||
      url.password !== '' ||
      (!loopbackHosts.has(url.hostname) && !/^[a-z0-9.-]+$/iu.test(url.hostname)) ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopbackHosts.has(url.hostname)))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new Error('Invalid public security origin');
  }
}

/** Static pages need inline Next scripts/styles; eval and hot reload are development-only. */
export function publicSecurityHeaders(
  sources: PublicSecuritySources,
): { key: string; value: string }[] {
  const supabase = serviceOrigin(sources.supabase);
  const core = serviceOrigin(sources.core);
  const collaboration = serviceOrigin(sources.collaboration);
  const connections = ["'self'", supabase, core, collaboration].filter(
    (origin): origin is string => origin !== undefined,
  );
  if (collaboration !== undefined) {
    const socket = new URL(collaboration);
    socket.protocol = socket.protocol === 'https:' ? 'wss:' : 'ws:';
    connections.push(socket.origin);
  }
  if (sources.development) connections.push('ws://localhost:*', 'ws://127.0.0.1:*');
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${sources.development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    `connect-src ${[...new Set(connections)].join(' ')}`,
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self'",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  return [
    { key: 'Content-Security-Policy', value: policy },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  ];
}
