import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import nextConfig from '../../next.config';

async function globalHeaders() {
  const rules = await nextConfig.headers?.();
  const rule = rules?.find(({ source }) => source === '/:path*');
  expect(rule, 'all routes need the security policy').toBeDefined();
  return new Map(rule?.headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

function directives(value: string | undefined) {
  return new Map(
    (value ?? '')
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const [name, ...sources] = part.trim().split(/\s+/u);
        return [name, sources];
      }),
  );
}

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
  vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', undefined);
  vi.stubEnv('NEXT_PUBLIC_COLLABORATION_API_URL', undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe('public security headers', () => {
  it('protects documents and assets without making static pages depend on a nonce', async () => {
    const headers = await globalHeaders();
    const csp = directives(headers.get('content-security-policy'));
    expect(csp.get('default-src')).toEqual(["'self'"]);
    expect(csp.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(csp.get('frame-ancestors')).toEqual(["'none'"]);
    expect(csp.get('object-src')).toEqual(["'none'"]);
    expect(csp.get('base-uri')).toEqual(["'self'"]);
    expect(csp.get('form-action')).toEqual(["'self'"]);
    expect(csp.get('font-src')).toEqual(["'self'"]);
    expect(csp.get('img-src')).toEqual(expect.arrayContaining(["'self'", 'data:', 'blob:']));
    expect(csp.get('media-src')).toEqual(expect.arrayContaining(["'self'", 'blob:']));
    expect(csp.get('worker-src')).toEqual(expect.arrayContaining(["'self'", 'blob:']));
    expect(headers.get('content-security-policy')).not.toMatch(/nonce-|unsafe-eval|https:\*/u);
    expect(headers.get('x-content-type-options')).toBe('nosniff');
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(headers.get('permissions-policy')).toBe(
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    expect(nextConfig.poweredByHeader).toBe(false);
    expect(headers.has('cache-control')).toBe(false);
  });

  it('normalizes only the configured public service origins, including collaboration sockets', async () => {
    // Synthetic public endpoint fixtures, never a deployed environment or customer URL.
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.synthetic.example/auth/v1');
    vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', 'https://core.synthetic.example/api?fixture=1');
    vi.stubEnv('NEXT_PUBLIC_COLLABORATION_API_URL', 'https://collab.synthetic.example/session');
    const headers = await globalHeaders();
    const csp = directives(headers.get('content-security-policy'));
    expect(csp.get('connect-src')).toEqual([
      "'self'",
      'https://supabase.synthetic.example',
      'https://core.synthetic.example',
      'https://collab.synthetic.example',
      'wss://collab.synthetic.example',
    ]);
    expect(headers.get('content-security-policy')).not.toContain('fixture=1');
    expect(headers.get('content-security-policy')).not.toContain('/auth/v1');
  });

  it('allows the existing loopback harness without upgrading its local HTTP transport', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', 'http://127.0.0.1:8789');
    vi.stubEnv('NEXT_PUBLIC_COLLABORATION_API_URL', 'http://localhost:8788');
    const csp = directives((await globalHeaders()).get('content-security-policy'));
    expect(csp.get('connect-src')).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:54321',
        'http://127.0.0.1:8789',
        'http://localhost:8788',
        'ws://localhost:8788',
      ]),
    );
    expect(csp.has('upgrade-insecure-requests')).toBe(false);
  });

  it('allows eval and loopback hot reload only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    let csp = directives((await globalHeaders()).get('content-security-policy'));
    expect(csp.get('script-src')).toContain("'unsafe-eval'");
    expect(csp.get('connect-src')).toEqual(
      expect.arrayContaining(['ws://localhost:*', 'ws://127.0.0.1:*']),
    );
    vi.stubEnv('NODE_ENV', 'production');
    csp = directives((await globalHeaders()).get('content-security-policy'));
    expect(csp.get('script-src')).not.toContain("'unsafe-eval'");
    expect(csp.get('connect-src')).toEqual(["'self'"]);
  });

  it.each([
    'not a URL',
    'javascript:alert(1)',
    'https://user:fixture@example.test',
    'https://example.test;script-src.example',
    'https://example.test/\r\nscript-src *',
    'http://remote.synthetic.example',
    'wss://remote.synthetic.example',
  ])('rejects unsafe service input without echoing it: %s', async (value) => {
    vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', value);
    await expect(nextConfig.headers?.()).rejects.toThrow('Invalid public security origin');
  });
});
