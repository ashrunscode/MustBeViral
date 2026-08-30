import { describe, expect, it, vi } from 'vitest';

import {
  PASSWORD_POLICY_MESSAGE,
  buildRecoveryRedirectUrl,
  classifyPasswordUpdateError,
  classifyRecoveryRequestError,
  normalizedRecoveryEmail,
  resolveAuthCallback,
  validateNewPassword,
} from './recovery';

describe('password recovery boundary', () => {
  it('normalizes valid email without exposing account existence', () => {
    expect(normalizedRecoveryEmail(' Buyer@Example.COM ')).toBe('buyer@example.com');
    expect(normalizedRecoveryEmail('not-an-email')).toBeNull();
  });

  it('maps provider rate limits and unexpected failures to safe recovery states', () => {
    expect(classifyRecoveryRequestError({ code: 'over_email_send_rate_limit' }).status).toBe(
      'rate_limited',
    );
    expect(classifyRecoveryRequestError({ status: 429 }).status).toBe('rate_limited');
    expect(classifyRecoveryRequestError({ code: 'unexpected_failure' }).status).toBe('unexpected');
    expect(classifyRecoveryRequestError({ code: 'user_not_found' })).toEqual({
      status: 'sent',
      message: 'If the account exists, recovery instructions are on the way.',
    });
  });

  it('enforces the configured local Supabase password policy and confirmation', () => {
    expect(validateNewPassword('short', 'short')).toEqual({
      status: 'invalid_password',
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(validateNewPassword('StrongPass1', 'StrongPass2').status).toBe('mismatch');
    expect(validateNewPassword('StrongPass1', 'StrongPass1')).toEqual({ status: 'idle' });
    expect(classifyPasswordUpdateError({ code: 'weak_password' })).toEqual({
      status: 'invalid_password',
      message: PASSWORD_POLICY_MESSAGE,
    });
    expect(classifyPasswordUpdateError({ code: 'session_expired' }).status).toBe('expired');
  });

  it('builds recovery callbacks only from the configured application origin', () => {
    const url = new URL(
      buildRecoveryRedirectUrl(
        'https://staging.mustbeviral.example',
        '/studio/workspace/brief?draft=1',
      ),
    );
    expect(url.origin).toBe('https://staging.mustbeviral.example');
    expect(url.pathname).toBe('/auth/callback');
    expect(url.searchParams.get('recovery')).toBe('1');
    expect(url.searchParams.get('next')).toBe('/studio/workspace/brief?draft=1');
  });
});

describe('PKCE auth callback boundary', () => {
  it('exchanges a valid code and preserves only a safe Studio continuation', async () => {
    const exchange = vi.fn(async () => ({ error: null }));
    await expect(
      resolveAuthCallback(
        {
          code: 'single-use-code',
          next: '/studio/workspace/canvas?canvas=canvas-1',
          recovery: false,
        },
        exchange,
      ),
    ).resolves.toEqual({
      type: 'ok',
      destination: '/studio/workspace/canvas?canvas=canvas-1',
    });
    expect(exchange).toHaveBeenCalledWith('single-use-code');

    await expect(
      resolveAuthCallback(
        { code: 'code-2', next: 'https://attacker.invalid/studio', recovery: false },
        exchange,
      ),
    ).resolves.toMatchObject({ destination: '/studio' });
  });

  it('routes a successful recovery exchange to reset and expired links back to recovery', async () => {
    await expect(
      resolveAuthCallback(
        { code: 'recovery-code', next: '/studio/campaign/brief', recovery: true },
        async () => ({ error: null }),
      ),
    ).resolves.toEqual({
      type: 'ok',
      destination: '/reset-password?next=%2Fstudio%2Fcampaign%2Fbrief',
    });

    await expect(
      resolveAuthCallback(
        {
          code: null,
          next: '/studio/campaign/brief',
          providerErrorCode: 'otp_expired',
          recovery: true,
        },
        async () => ({ error: null }),
      ),
    ).resolves.toEqual({
      type: 'expired',
      destination: '/forgot-password?next=%2Fstudio%2Fcampaign%2Fbrief&notice=expired_link',
    });
  });

  it('does not leak provider errors into callback destinations', async () => {
    const result = await resolveAuthCallback(
      { code: 'bad-code', next: '/studio', recovery: false },
      async () => ({ error: { code: 'unexpected_failure', status: 500 } }),
    );
    expect(result).toEqual({
      type: 'error',
      destination: '/login?next=%2Fstudio&notice=auth_link_failed',
    });
    expect(result.destination).not.toContain('unexpected_failure');
  });

  it('maps callback exchange throttling to a safe rate-limit notice', async () => {
    await expect(
      resolveAuthCallback(
        { code: 'throttled-code', next: '/studio', recovery: true },
        async () => ({ error: { status: 429 } }),
      ),
    ).resolves.toEqual({
      type: 'rate_limited',
      destination: '/forgot-password?next=%2Fstudio&notice=rate_limited',
    });
  });
});
