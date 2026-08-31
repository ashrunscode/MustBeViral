'use server';

import { redirect } from 'next/navigation';

import { classifyRecoveryRequestError, normalizedRecoveryEmail } from '../../src/lib/auth/recovery';
import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';

export type VerifyEmailState =
  | { readonly status: 'idle' }
  | { readonly status: 'invalid_email'; readonly message: string }
  | { readonly status: 'sent'; readonly message: string }
  | { readonly status: 'rate_limited'; readonly message: string }
  | { readonly status: 'unexpected'; readonly message: string };

export const INITIAL_VERIFY_EMAIL_STATE: VerifyEmailState = { status: 'idle' };

export async function resendVerificationEmail(
  _previous: VerifyEmailState,
  formData: FormData,
): Promise<VerifyEmailState> {
  const email = normalizedRecoveryEmail(formData.get('email'));
  const next = safeStudioRedirectPath(formData.get('next'));
  if (email === null) {
    return { status: 'invalid_email', message: 'Enter the email address awaiting verification.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_ORIGIN ?? 'http://127.0.0.1:3000'}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error !== null) {
    return classifyRecoveryRequestError(error);
  }

  redirect(`/login?${new URLSearchParams({ next, notice: 'verification_sent' }).toString()}`);
}
