'use server';

import { redirect } from 'next/navigation';

import { readWebPublicEnvironment } from '../../../src/config/public-environment';
import {
  classifyRecoveryRequestError,
  normalizedRecoveryEmail,
} from '../../../src/lib/auth/recovery';
import { safeStudioRedirectPath } from '../../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../../src/lib/supabase/server';

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

  // The validated public origin, never a loopback fallback: a production build without the
  // variable fails closed instead of mailing a link to 127.0.0.1.
  const environment = readWebPublicEnvironment();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: `${environment.NEXT_PUBLIC_APP_ORIGIN}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error !== null) {
    return classifyRecoveryRequestError(error);
  }

  redirect(`/login?${new URLSearchParams({ next, notice: 'verification_sent' }).toString()}`);
}
