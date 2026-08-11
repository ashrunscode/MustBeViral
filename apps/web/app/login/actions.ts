'use server';

import { redirect } from 'next/navigation';

import {
  classifySignInError,
  safeStudioRedirectPath,
  type SignInState,
} from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';

export async function signInWithPassword(
  _previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = formData.get('email');
  const password = formData.get('password');
  if (typeof email !== 'string' || email.trim().length === 0 || typeof password !== 'string') {
    return { status: 'invalid_credentials', message: 'Enter your email and password.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error !== null) return classifySignInError(error);
  redirect(safeStudioRedirectPath(formData.get('next')));
}

export async function signOut(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  redirect(error === null ? '/login?notice=signed_out' : '/login?notice=sign_out_failed');
}
