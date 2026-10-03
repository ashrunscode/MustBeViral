import { beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({
    auth: { exchangeCodeForSession },
  }),
}));

vi.mock('../../src/config/public-environment', () => ({
  readWebPublicEnvironment: () => ({
    NEXT_PUBLIC_APP_ORIGIN: 'https://staging.mustbeviral.example',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value-for-test',
    NEXT_PUBLIC_CORE_API_URL: 'https://core.example',
  }),
}));

import { GET } from '../../app/auth/callback/route';

describe('SSR PKCE callback route', () => {
  beforeEach(() => {
    exchangeCodeForSession.mockClear();
    exchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
  });

  it.each([
    'https://mustbeviral.com',
    'https://www.mustbeviral.com',
    'https://staging.mustbeviral.example',
    'http://127.0.0.1:3113',
  ])('exchanges the code and preserves the request origin %s', async (origin) => {
    const response = await GET(
      new Request(`${origin}/auth/callback?code=single-use&next=%2Fstudio%2Fcampaign%2Fbrief`, {
        headers: { 'x-forwarded-host': 'attacker.invalid', 'x-forwarded-proto': 'http' },
      }),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith('single-use');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(`${origin}/studio/campaign/brief`);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('pragma')).toBe('no-cache');
    expect(response.headers.get('expires')).toBe('0');
  });

  it.each([
    'https://attacker.invalid/studio',
    '//attacker.invalid/studio',
    '/\\attacker.invalid/studio',
    '/studio/../../login',
    '/studio.attacker.invalid',
  ])('preserves recovery intent while rejecting continuation %s', async (next) => {
    const query = new URLSearchParams({ code: 'recovery-code', recovery: '1', next });
    const response = await GET(new Request(`https://mustbeviral.com/auth/callback?${query}`));

    expect(response.headers.get('location')).toBe(
      'https://mustbeviral.com/reset-password?next=%2Fstudio',
    );
  });

  it('keeps a validated recovery continuation on the request origin', async () => {
    const next = '/studio/brand/content?tab=review#comments';
    const query = new URLSearchParams({ code: 'recovery-code', recovery: '1', next });
    const response = await GET(new Request(`http://127.0.0.1:3113/auth/callback?${query}`));
    const location = new URL(response.headers.get('location') ?? '');
    expect(location.origin).toBe('http://127.0.0.1:3113');
    expect(location.pathname).toBe('/reset-password');
    expect(location.searchParams.get('next')).toBe(next);
  });

  it('maps an expired provider callback without leaking provider text', async () => {
    const response = await GET(
      new Request(
        'https://mustbeviral.com/auth/callback?error=access_denied&error_code=otp_expired&error_description=secret-provider-detail&recovery=1&next=%2Fstudio',
      ),
    );
    const location = response.headers.get('location');

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location).toBe(
      'https://mustbeviral.com/forgot-password?next=%2Fstudio&notice=expired_link',
    );
    expect(location).not.toContain('secret-provider-detail');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('keeps a missing-code failure on the request origin without exchanging a code', async () => {
    const response = await GET(new Request('https://mustbeviral.com/auth/callback'));
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBe(
      'https://mustbeviral.com/login?next=%2Fstudio&notice=auth_link_failed',
    );
  });

  it('sanitizes an exchange failure and retains the validated continuation', async () => {
    exchangeCodeForSession.mockResolvedValue({ error: { code: 'otp_expired' } });
    const response = await GET(
      new Request('https://mustbeviral.com/auth/callback?code=expired&next=%2Fstudio%2Fbrand'),
    );
    expect(response.headers.get('location')).toBe(
      'https://mustbeviral.com/login?next=%2Fstudio%2Fbrand&notice=expired_link',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
