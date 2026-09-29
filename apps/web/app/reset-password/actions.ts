'use server';

import { redirect } from 'next/navigation';

import {
  classifyPasswordUpdateError,
  type PasswordResetState,
  validateNewPassword,
} from '../../src/lib/auth/recovery';
import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';

export async function resetPassword(
  _previousState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const validation = validateNewPassword(formData.get('password'), formData.get('confirmation'));
  if (validation.status !== 'idle') return validation;

  const supabase = await createServerSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError?.status === 429 || userError?.code === 'over_request_rate_limit') {
    return classifyPasswordUpdateError(userError);
  }
  if (userError !== null || userData.user === null) {
    return {
      status: 'expired',
      message: 'That recovery session expired. Request a new recovery link.',
    };
  }

  const password = formData.get('password');
  if (typeof password !== 'string') {
    return validateNewPassword(password, formData.get('confirmation'));
  }
  const { error } = await supabase.auth.updateUser({ password });
  if (error !== null) return classifyPasswordUpdateError(error);

  const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
  if (signOutError !== null) {
    return {
      status: 'sign_out_failed',
      message: 'Your password changed, but sign-out did not complete. Sign out now before leaving.',
    };
  }

  const next = safeStudioRedirectPath(formData.get('next'));
  redirect(`/login?${new URLSearchParams({ notice: 'password_updated', next }).toString()}`);
}

export async function signOutAfterPasswordReset(formData: FormData): Promise<never> {
  const next = safeStudioRedirectPath(formData.get('next'));
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  redirect(
    `/login?${new URLSearchParams({
      notice: error === null ? 'password_updated' : 'sign_out_failed',
      next,
    }).toString()}`,
  );
}
