import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  getUser: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
}));
const redirect = vi.hoisted(() =>
  vi.fn((destination: string) => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
);

vi.mock('../../src/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth }),
}));

vi.mock('../../src/config/public-environment', () => ({
  readWebPublicEnvironment: () => ({
    NEXT_PUBLIC_APP_ORIGIN: 'https://staging.mustbeviral.example',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value-for-test',
    NEXT_PUBLIC_CORE_API_URL: 'https://core.example',
  }),
}));

vi.mock('next/navigation', () => ({ redirect }));

import { requestPasswordRecovery } from '../../app/forgot-password/actions';
import { resetPassword, signOutAfterPasswordReset } from '../../app/reset-password/actions';
import {
  INITIAL_PASSWORD_RESET_STATE,
  INITIAL_RECOVERY_REQUEST_STATE,
} from '../../src/lib/auth/recovery';

function recoveryForm(email: string, next = '/studio/campaign/brief') {
  const form = new FormData();
  form.set('email', email);
  form.set('next', next);
  return form;
}

function resetForm(password: string, confirmation = password) {
  const form = new FormData();
  form.set('password', password);
  form.set('confirmation', confirmation);
  form.set('next', '/studio/campaign/brief');
  return form;
}

describe('password recovery server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    auth.updateUser.mockResolvedValue({ data: {}, error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('uses an enumeration-neutral result and configured callback origin', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: 'user_not_found', status: 400 },
    });

    await expect(
      requestPasswordRecovery(INITIAL_RECOVERY_REQUEST_STATE, recoveryForm(' Buyer@Example.COM ')),
    ).resolves.toEqual({
      status: 'sent',
      message: 'If the account exists, recovery instructions are on the way.',
    });
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith('buyer@example.com', {
      redirectTo:
        'https://staging.mustbeviral.example/auth/callback?recovery=1&next=%2Fstudio%2Fcampaign%2Fbrief',
    });
  });

  it('maps recovery throttling without exposing provider details', async () => {
    auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: { code: 'over_email_send_rate_limit', status: 429 },
    });
    await expect(
      requestPasswordRecovery(INITIAL_RECOVERY_REQUEST_STATE, recoveryForm('buyer@example.com')),
    ).resolves.toMatchObject({ status: 'rate_limited' });
  });

  it('updates the password, signs out globally, then redirects to sign-in', async () => {
    await expect(
      resetPassword(INITIAL_PASSWORD_RESET_STATE, resetForm('StrongPass1')),
    ).rejects.toThrow(
      'NEXT_REDIRECT:/login?notice=password_updated&next=%2Fstudio%2Fcampaign%2Fbrief',
    );
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'StrongPass1' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(
      auth.signOut.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not call Supabase when the new password violates the configured policy', async () => {
    await expect(
      resetPassword(INITIAL_PASSWORD_RESET_STATE, resetForm('weak')),
    ).resolves.toMatchObject({ status: 'invalid_password' });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it('reports a completed password update when global sign-out fails', async () => {
    auth.signOut.mockResolvedValue({ error: { code: 'unexpected_failure', status: 500 } });
    await expect(
      resetPassword(INITIAL_PASSWORD_RESET_STATE, resetForm('StrongPass1')),
    ).resolves.toMatchObject({ status: 'sign_out_failed' });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('preserves the safe Studio continuation during sign-out recovery', async () => {
    const form = new FormData();
    form.set('next', '/studio/workspace/canvas?canvas=canvas-1');
    await expect(signOutAfterPasswordReset(form)).rejects.toThrow(
      'NEXT_REDIRECT:/login?notice=password_updated&next=%2Fstudio%2Fworkspace%2Fcanvas%3Fcanvas%3Dcanvas-1',
    );
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
