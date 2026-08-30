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

  it('exchanges the code and redirects through the configured origin, not the request host', async () => {
    const response = await GET(
      new Request(
        'https://untrusted-forwarded-host.invalid/auth/callback?code=single-use&next=%2Fstudio%2Fcampaign%2Fbrief',
      ),
    );

    expect(exchangeCodeForSession).toHaveBeenCalledWith('single-use');
    expect(response.headers.get('location')).toBe(
      'https://staging.mustbeviral.example/studio/campaign/brief',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });

  it('preserves recovery intent while rejecting an external continuation', async () => {
    const response = await GET(
      new Request(
        'https://untrusted.invalid/auth/callback?code=recovery-code&recovery=1&next=https%3A%2F%2Fattacker.invalid%2Fstudio',
      ),
    );

    expect(response.headers.get('location')).toBe(
      'https://staging.mustbeviral.example/reset-password?next=%2Fstudio',
    );
  });

  it('maps an expired provider callback without leaking provider text', async () => {
    const response = await GET(
      new Request(
        'https://untrusted.invalid/auth/callback?error=access_denied&error_code=otp_expired&error_description=secret-provider-detail&recovery=1&next=%2Fstudio',
      ),
    );
    const location = response.headers.get('location');

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location).toBe(
      'https://staging.mustbeviral.example/forgot-password?next=%2Fstudio&notice=expired_link',
    );
    expect(location).not.toContain('secret-provider-detail');
  });
});
