import { readFileSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { createRequire } from 'node:module';
import type { NextConfig } from 'next';
import { NextRequest, type ProxyConfig } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createServerClient: vi.fn(), getClaims: vi.fn() }));
vi.mock('@supabase/ssr', () => ({ createServerClient: mocks.createServerClient }));

import { config as proxyConfig, proxy } from '../../../proxy';
import { DOCUMENT_LANG_HEADER } from '../document-lang';
import { refreshSupabaseSession } from './proxy';

// Next 16.2.10's test declaration names a missing matcher export, and its build-parser declaration
// imports an uninstalled @swc/core type. Use the real installed functions with verified narrow
// signatures below. No dependency, application type or compiler check changes are needed.
function installedNextFunction(modulePath: string, name: string): (...args: never[]) => unknown {
  const sdkExports: unknown = createRequire(import.meta.url)(modulePath);
  if (sdkExports === null || typeof sdkExports !== 'object' || !(name in sdkExports)) {
    throw new Error('The installed Next test function is unavailable');
  }
  const value: unknown = (sdkExports as Record<string, unknown>)[name];
  if (typeof value !== 'function')
    throw new Error('The installed Next test function is unavailable');
  return value as (...args: never[]) => unknown;
}
const unstable_doesMiddlewareMatch = installedNextFunction(
  'next/experimental/testing/server',
  'unstable_doesMiddlewareMatch',
) as (options: {
  config: Pick<ProxyConfig, 'matcher'>;
  url: string;
  headers?: IncomingHttpHeaders;
  cookies?: Record<string, string>;
  nextConfig?: NextConfig;
}) => boolean;
const parseModule = installedNextFunction(
  'next/dist/build/analysis/parse-module',
  'parseModule',
) as (filename: string, source: string) => Promise<unknown>;
const extractExportedConstValue = installedNextFunction(
  'next/dist/build/analysis/extract-const-value',
  'extractExportedConstValue',
) as (
  module: unknown,
  name: string,
) => { value: unknown } | { unsupported: string; path?: string } | null;
const loadBindings = installedNextFunction(
  'next/dist/build/swc',
  'loadBindings',
) as () => Promise<unknown>;

type CookieWrite = Readonly<{
  name: string;
  value: string;
  options?: Readonly<{ path?: string; httpOnly?: boolean; secure?: boolean; sameSite?: 'lax' }>;
}>;
type CookieBridge = Readonly<{
  cookies: {
    getAll: () => readonly { name: string; value: string }[];
    setAll: (cookies: readonly CookieWrite[]) => void;
  };
}>;

function request(path: string, cookie?: string, host = 'mustbeviral.com') {
  return new NextRequest(`https://${host}${path}`, {
    headers: { host, ...(cookie === undefined ? {} : { cookie }) },
  });
}

function expectPrivate(response: Response) {
  expect(response.headers.get('cache-control')).toContain('private');
  expect(response.headers.get('cache-control')).toContain('no-store');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('MBV_LOCAL_GOLDEN_PREVIEW', undefined);
  // Local-only public configuration and cookie fixtures; no real token or remote client.
  vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://mustbeviral.com');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.synthetic.example');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key-fixture');
  vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', 'https://core.synthetic.example');
  vi.stubEnv('NEXT_PUBLIC_COLLABORATION_API_URL', undefined);
  mocks.getClaims.mockResolvedValue({ data: null, error: null });
  mocks.createServerClient.mockImplementation(() => ({ auth: { getClaims: mocks.getClaims } }));
});

afterEach(() => vi.unstubAllEnvs());

describe('static public pages with verified landing redirects', () => {
  it.each([
    '/',
    '/es',
    '/es/',
    '/pricing',
    '/software',
    '/software/pricing',
    '/privacy',
    '/terms',
    '/advertising',
    '/sitemap.xml',
    '/robots.txt',
    '/llms.txt',
  ])('keeps a guest request to %s free of session work and private caching', async (path) => {
    const response = await refreshSupabaseSession(request(path));
    expect(response.status).toBe(200);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(response.headers.has('cache-control')).toBe(false);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it('renders a guest landing without configuration and overwrites a spoofed language hint', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
    const incoming = request('/');
    incoming.headers.set(DOCUMENT_LANG_HEADER, 'es');
    const response = await refreshSupabaseSession(incoming);
    expect(response.headers.get(`x-middleware-request-${DOCUMENT_LANG_HEADER}`)).toBe('en');
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each(['/', '/es', '/es/'])(
    'redirects a verified nonempty subject from %s to Studio privately',
    async (path) => {
      mocks.getClaims.mockResolvedValue({
        data: { claims: { sub: 'synthetic-subject' } },
        error: null,
      });
      const response = await refreshSupabaseSession(
        request(path, 'sb-fixture-auth-token.0=fixture-chunk'),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('https://mustbeviral.com/studio');
      expect(mocks.getClaims).toHaveBeenCalledTimes(1);
      expectPrivate(response);
    },
  );

  it.each([
    'preferences=fixture',
    'sb-fixture-auth-token-code-verifier=fixture',
    'sb-fixture-auth-token=',
  ])('ignores a cookie that is not a session: %s', async (cookie) => {
    const response = await refreshSupabaseSession(request('/', cookie));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.has('cache-control')).toBe(false);
  });

  it.each([null, '', '   ', 12])(
    'does not authenticate a missing or malformed subject: %s',
    async (sub) => {
      mocks.getClaims.mockResolvedValue({ data: { claims: { sub } }, error: null });
      const response = await refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture'));
      expect(response.status).toBe(200);
      expect(response.headers.has('location')).toBe(false);
      expect(mocks.getClaims).toHaveBeenCalledTimes(1);
      expectPrivate(response);
    },
  );

  it('fails closed on a claims error without returning provider details', async () => {
    mocks.getClaims.mockResolvedValue({
      data: { claims: { sub: 'synthetic-subject' } },
      error: { message: 'provider-detail-fixture' },
    });
    const response = await refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture'));
    expect(response.status).toBe(200);
    expect(response.headers.has('location')).toBe(false);
    expect(JSON.stringify([...response.headers])).not.toContain('provider-detail-fixture');
    expectPrivate(response);
  });

  it('recovers from a thrown claims failure as a private guest landing', async () => {
    mocks.getClaims.mockRejectedValue(new Error('synthetic claims service unavailable'));
    const response = await refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture'));
    expect(response.status).toBe(200);
    expect(response.headers.has('location')).toBe(false);
    expectPrivate(response);
  });

  it('keeps a cookie-bearing landing available when public configuration is absent', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', undefined);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', undefined);
    const response = await refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expectPrivate(response);
  });

  it('does not refresh other marketing pages even with an existing session', async () => {
    const response = await refreshSupabaseSession(
      request('/software', 'sb-fixture-auth-token=fixture'),
    );
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
    expect(response.headers.has('set-cookie')).toBe(false);
    expectPrivate(response);
  });

  it('bridges every refreshed cookie with options into the landing redirect and request', async () => {
    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, bridge: CookieBridge) => ({
        auth: {
          getClaims: async () => {
            expect(bridge.cookies.getAll()).toEqual([
              { name: 'sb-fixture-auth-token.0', value: 'fixture-old' },
            ]);
            bridge.cookies.setAll([
              {
                name: 'sb-fixture-auth-token.0',
                value: 'fixture-new',
                options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
              },
            ]);
            bridge.cookies.setAll([
              {
                name: 'sb-fixture-auth-token.1',
                value: 'fixture-second',
                options: { path: '/', httpOnly: true, secure: true, sameSite: 'lax' },
              },
            ]);
            return { data: { claims: { sub: 'synthetic-subject' } }, error: null };
          },
        },
      }),
    );
    const incoming = request('/', 'sb-fixture-auth-token.0=fixture-old');
    const response = await refreshSupabaseSession(incoming);
    expect(response.status).toBe(307);
    expect(incoming.cookies.get('sb-fixture-auth-token.0')?.value).toBe('fixture-new');
    expect(incoming.cookies.get('sb-fixture-auth-token.1')?.value).toBe('fixture-second');
    expect(response.cookies.getAll()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'sb-fixture-auth-token.0',
          value: 'fixture-new',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        }),
        expect.objectContaining({
          name: 'sb-fixture-auth-token.1',
          value: 'fixture-second',
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
        }),
      ]),
    );
    expectPrivate(response);
  });

  it('does not share response cookies between overlapping requests', async () => {
    mocks.createServerClient.mockImplementation(
      (_url: string, _key: string, bridge: CookieBridge) => ({
        auth: {
          getClaims: async () => {
            const value = bridge.cookies.getAll()[0]?.value ?? '';
            await Promise.resolve();
            bridge.cookies.setAll([
              {
                name: 'sb-fixture-auth-token',
                value: `${value}-refreshed`,
                options: { path: '/', httpOnly: true },
              },
            ]);
            return value === 'fixture-a'
              ? { data: { claims: { sub: 'synthetic-subject' } }, error: null }
              : { data: null, error: null };
          },
        },
      }),
    );
    const [signedIn, guest] = await Promise.all([
      refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture-a')),
      refreshSupabaseSession(request('/', 'sb-fixture-auth-token=fixture-b')),
    ]);
    expect(signedIn.status).toBe(307);
    expect(guest.status).toBe(200);
    expect(signedIn.cookies.get('sb-fixture-auth-token')?.value).toBe('fixture-a-refreshed');
    expect(guest.cookies.get('sb-fixture-auth-token')?.value).toBe('fixture-b-refreshed');
    expectPrivate(signedIn);
    expectPrivate(guest);
  });
});

describe('protected routes and canonical host', () => {
  it('lets the installed Next build parser extract the exact matcher configuration', async () => {
    await loadBindings();
    const source = readFileSync(new URL('../../../proxy.ts', import.meta.url), 'utf8');
    const parsedProxy = await parseModule('proxy.ts', source);
    expect(extractExportedConstValue(parsedProxy, 'config')).toEqual({ value: proxyConfig });
  });

  it.each(['', '   '])(
    'denies an empty subject at Studio and preserves the return path: %s',
    async (sub) => {
      mocks.getClaims.mockResolvedValue({ data: { claims: { sub } }, error: null });
      const response = await refreshSupabaseSession(
        request('/studio/workspace/canvas?canvas=fixture', 'sb-fixture-auth-token=fixture'),
      );
      expect(response.status).toBe(307);
      const location = new URL(response.headers.get('location') ?? 'https://invalid.test');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('next')).toBe('/studio/workspace/canvas?canvas=fixture');
      expectPrivate(response);
    },
  );

  it('never enables the local preview bypass in production', async () => {
    vi.stubEnv('MBV_LOCAL_GOLDEN_PREVIEW', '1');
    const response = await refreshSupabaseSession(request('/studio'));
    expect(response.status).toBe(307);
    expect(mocks.getClaims).toHaveBeenCalledTimes(1);
    expectPrivate(response);
  });

  it('preserves the existing development-only preview lane', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MBV_LOCAL_GOLDEN_PREVIEW', '1');
    const response = await refreshSupabaseSession(request('/studio'));
    expect(response.status).toBe(200);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each([
    '/',
    '/software?ref=synthetic',
    '/films/s0-studio-hero-d55af8ec3d69.mp4',
    '/films/s0-studio-hero-en-06371b2bb52f.mp4',
    '/_next/static/fixture.js',
  ])('canonically redirects www%s before any session work', async (path) => {
    const response = await proxy(
      request(path, 'sb-fixture-auth-token=fixture', 'www.mustbeviral.com'),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`https://mustbeviral.com${path}`);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each([
    '/',
    '/software?ref=synthetic',
    '/films/s0-studio-hero-d55af8ec3d69.mp4',
    '/films/s0-studio-hero-en-06371b2bb52f.mp4',
    '/_next/static/fixture.js',
  ])('uses the original www Host when Next normalizes its request URL: %s', async (path) => {
    const incoming = new NextRequest(`http://127.0.0.1:3115${path}`, {
      headers: { host: 'www.mustbeviral.com', cookie: 'sb-fixture-auth-token=fixture' },
    });
    const response = await proxy(incoming);
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(`https://mustbeviral.com${path}`);
    expect(response.headers.has('set-cookie')).toBe(false);
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it('canonicalizes a case-insensitive www Host with a port to the HTTPS apex without a port', async () => {
    const response = await proxy(
      new NextRequest('http://127.0.0.1:3115/software?ref=synthetic', {
        headers: { host: 'WWW.MustBeViral.com:443' },
      }),
    );
    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe('https://mustbeviral.com/software?ref=synthetic');
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });

  it.each(['wwwXmustbeviralYcom', 'www.mustbeviral.com.evil.test', 'user@www.mustbeviral.com'])(
    'does not treat an unrelated or malformed Host as the canonical www: %s',
    async (host) => {
      const response = await proxy(
        new NextRequest('http://127.0.0.1:3115/', { headers: { host } }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.has('location')).toBe(false);
      expect(mocks.createServerClient).not.toHaveBeenCalled();
    },
  );

  it('matches www assets for canonicalization while keeping apex assets outside session middleware', () => {
    for (const path of [
      '/films/s0-studio-hero-d55af8ec3d69.mp4',
      '/films/s0-studio-hero-en-06371b2bb52f.mp4',
      '/_next/static/fixture.js',
      '/og/studio-en.png',
    ]) {
      expect(
        unstable_doesMiddlewareMatch({
          config: proxyConfig,
          url: `https://www.mustbeviral.com${path}`,
          headers: { host: 'www.mustbeviral.com' },
        }),
      ).toBe(true);
      expect(
        unstable_doesMiddlewareMatch({
          config: proxyConfig,
          url: `https://mustbeviral.com${path}`,
          headers: { host: 'mustbeviral.com' },
        }),
      ).toBe(false);
    }
    expect(
      unstable_doesMiddlewareMatch({
        config: proxyConfig,
        url: 'https://wwwXmustbeviralYcom/_next/static/fixture.js',
        headers: { host: 'wwwXmustbeviralYcom' },
      }),
    ).toBe(false);
  });
});
