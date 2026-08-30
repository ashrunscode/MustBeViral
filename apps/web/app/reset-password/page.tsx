import { MonoCaps } from '@mustbeviral/ui';
import { redirect } from 'next/navigation';

import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';
import { ResetPasswordForm } from './reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>) {
  const params = await searchParams;
  const next = safeStudioRedirectPath(params.next);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error?.status === 429 || error?.code === 'over_request_rate_limit') {
    redirect(
      `/forgot-password?${new URLSearchParams({ notice: 'rate_limited', next }).toString()}`,
    );
  }
  if (error !== null || data.user === null) {
    redirect(
      `/forgot-password?${new URLSearchParams({ notice: 'expired_link', next }).toString()}`,
    );
  }

  return (
    <main className="auth-page">
      <a className="skip-link" href="#auth-heading">
        Skip to new password
      </a>
      <section aria-labelledby="auth-heading" className="auth-card">
        <MonoCaps>MustBeViral Studio</MonoCaps>
        <h1 id="auth-heading">Choose a new password</h1>
        <p className="auth-intro">
          Set a new password for this recovery session. Studio signs out every session after the
          update so you can sign in again safely.
        </p>
        <ResetPasswordForm next={next} />
      </section>
    </main>
  );
}
