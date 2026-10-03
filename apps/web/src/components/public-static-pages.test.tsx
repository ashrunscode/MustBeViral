import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { HeadManagerContext } from 'next/dist/shared/lib/head-manager-context.shared-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getClaims: vi.fn(), headers: vi.fn() }));
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'synthetic-sans-class' }),
  Geist_Mono: () => ({ variable: 'synthetic-mono-class' }),
}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('../lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims: mocks.getClaims } }),
}));

import RootLayout from '../../app/(en)/layout';
import SpanishRootLayout from '../../app/es/layout';
import GlobalNotFound from '../../app/global-not-found';
import HomePage from '../../app/(en)/page';
import SpanishStudioPage from '../../app/es/page';
import PricingPage from '../../app/(en)/pricing/page';
import SoftwarePage from '../../app/(en)/software/page';
import SoftwarePricingPage from '../../app/(en)/software/pricing/page';
import PrivacyPage from '../../app/(en)/privacy/page';
import TermsPage from '../../app/(en)/terms/page';
import AdvertisingPage from '../../app/(en)/advertising/page';
import LoginPage from '../../app/(en)/login/page';

beforeEach(() => {
  vi.clearAllMocks();
  // Synthetic configuration enables the former render-time session branch without a real client.
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.synthetic.example');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'synthetic-publishable-key-fixture');
  mocks.getClaims.mockResolvedValue({ data: null, error: null });
  mocks.headers.mockResolvedValue(new Headers({ 'x-mbv-document-lang': 'es' }));
});

afterEach(() => vi.unstubAllEnvs());

describe('static marketing document', () => {
  it.each([
    ['English', RootLayout],
    ['Spanish', SpanishRootLayout],
    ['not-found', GlobalNotFound],
  ] as const)(
    'initializes %s validation before browser schemas without an eval probe',
    (_name, root) => {
      const html = renderToStaticMarkup(
        <HeadManagerContext.Provider value={{ appDir: true }}>
          {root({ children: <main>synthetic validation fixture</main> })}
        </HeadManagerContext.Provider>,
      );
      const script = /<script\b[^>]*>(\(self\.__next_s=[^<]+)<\/script>/u.exec(html);
      expect(
        script,
        'every root schedules CSP-safe validation before browser modules',
      ).not.toBeNull();
      const program = `
      import { runInThisContext } from 'node:vm';
      globalThis.self = globalThis;
      ${script![1]}
      const [kind, scheduled] = globalThis.__next_s.find(([, value]) => value.id === 'mbv-browser-validation');
      if (kind !== 0) throw new Error('Synthetic fixture requires the early inline strategy');
      runInThisContext(scheduled.children);
      let functionProbes = 0;
      globalThis.Function = new Proxy(globalThis.Function, {
        construct() { functionProbes++; throw new Error('Synthetic CSP forbids eval'); },
        apply() { functionProbes++; throw new Error('Synthetic CSP forbids eval'); }
      });
      const { z } = await import('zod');
      const schema = z.object({ name: z.string().min(1), count: z.number().int().nonnegative() });
      console.log(JSON.stringify({
        jitless: z.config().jitless,
        valid: schema.safeParse({ name: 'Synthetic fixture', count: 1 }).success,
        invalid: schema.safeParse({ name: '', count: -1 }).success,
        functionProbes
      }));
    `;
      const result = execFileSync(process.execPath, ['--input-type=module', '-e', program], {
        cwd: new URL('../../', import.meta.url),
        encoding: 'utf8',
        windowsHide: true,
      });
      expect(JSON.parse(result)).toEqual({
        jitless: true,
        valid: true,
        invalid: false,
        functionProbes: 0,
      });
    },
  );

  it('renders an English root synchronously without reading request headers', async () => {
    const document = RootLayout({ children: <main>synthetic document fixture</main> });
    await Promise.resolve(document);
    expect(document).not.toBeInstanceOf(Promise);
    expect(mocks.headers).not.toHaveBeenCalled();
    const html = renderToStaticMarkup(document);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('synthetic-sans-class synthetic-mono-class');
  });

  it('serves a Spanish document language without a request header or client mutation', () => {
    const document = SpanishRootLayout({ children: <main>synthetic document fixture</main> });
    expect(document).not.toBeInstanceOf(Promise);
    expect(renderToStaticMarkup(document)).toContain('<html lang="es">');
    expect(mocks.headers).not.toHaveBeenCalled();
  });

  it('renders the existing full not-found document with one main and the shared fonts', () => {
    const html = renderToStaticMarkup(<GlobalNotFound />);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('synthetic-sans-class synthetic-mono-class');
    expect(html).toContain('This page does not exist');
    expect(html.match(/<main\b/gu)).toHaveLength(1);
    expect(mocks.headers).not.toHaveBeenCalled();
    expect(mocks.getClaims).not.toHaveBeenCalled();
  });

  it.each([
    ['/', HomePage],
    ['/es', SpanishStudioPage],
    ['/pricing', PricingPage],
    ['/software', SoftwarePage],
    ['/software/pricing', SoftwarePricingPage],
    ['/privacy', PrivacyPage],
    ['/terms', TermsPage],
    ['/advertising', AdvertisingPage],
  ] as const)('renders %s without a request-time session or promise', async (_route, page) => {
    const result = page();
    await Promise.resolve(result);
    expect(result).not.toBeInstanceOf(Promise);
    expect(mocks.getClaims).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(result)).toContain('<main');
  });
});

describe('public finishing details', () => {
  it('makes the unchanged login wordmark a home link', async () => {
    const html = renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve({}) }));
    expect(html).toMatch(
      /<a\b(?=[^>]*class="pub-wordmark")(?=[^>]*href="\/")[^>]*>Must\u00a0Be\u00a0Viral<\/a>/u,
    );
    expect(html).not.toMatch(/<span class="pub-wordmark"/u);
  });

  it.each(['pub-footer', 'pub-footer--compact'])(
    'keeps .%s body text at the 16px public floor',
    (className) => {
      const css = readFileSync(new URL('../../app/globals.css', import.meta.url), 'utf8');
      const declarations = new RegExp(`\\.${className}\\s*\\{([^}]+)\\}`, 'u').exec(css)?.[1] ?? '';
      const pixels = /font-size:\s*(\d+)px/u.exec(declarations)?.[1];
      expect(pixels).toBeDefined();
      expect(Number(pixels)).toBeGreaterThanOrEqual(16);
    },
  );
});
