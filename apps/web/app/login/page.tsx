import { MonoCaps } from '@mustbeviral/ui';

import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { createServerSupabaseClient } from '../../src/lib/supabase/server';
import { signOut } from './actions';
import { LoginForm } from './login-form';

const notices: Readonly<Record<string, string>> = {
  signed_out: 'You are signed out.',
  verified: 'Email verified. Sign in to continue.',
  expired_link: 'That sign-in link expired. Request a new link before trying again.',
  auth_link_failed: 'That sign-in link could not be verified. Sign in to continue.',
  password_updated: 'Password updated. Sign in with your new password.',
  rate_limited: 'Too many auth attempts. Wait a moment, then try again.',
  recovery_sent: 'If the account exists, recovery instructions are on the way.',
  sign_out_failed: 'Sign-out did not complete. Try again before closing this browser.',
};

export default async function LoginPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>) {
  const params = await searchParams;
  const next = safeStudioRedirectPath(params.next);
  const noticeKey = typeof params.notice === 'string' ? params.notice : '';
  const notice = notices[noticeKey];
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = typeof data?.claims?.sub === 'string';
  const forgotPasswordUrl = `/forgot-password?${new URLSearchParams({ next }).toString()}`;

  return (
    <main className="auth-page">
      <a className="skip-link" href="#auth-heading">
        Skip to sign in
      </a>
      <section aria-labelledby="auth-heading" className="auth-card">
        <MonoCaps>MustBeViral Studio</MonoCaps>
        <h1 id="auth-heading">{signedIn ? 'Your session is active' : 'Sign in'}</h1>
        <p className="auth-intro">
          {signedIn
            ? 'Continue to your authenticated Studio workspace or end this browser session.'
            : 'Use the email and password associated with your Studio workspace.'}
        </p>
        {notice === undefined ? null : (
          <p className="auth-message auth-message--notice" role="status">
            {notice}
          </p>
        )}
        {signedIn ? (
          <div className="auth-session-actions">
            <a className="auth-primary auth-primary--link" href={next}>
              Continue to Studio
            </a>
            <form action={signOut}>
              <button className="auth-secondary" type="submit">
                Sign out
              </button>
            </form>
          </div>
        ) : (
          <>
            <LoginForm next={next} />
            <div className="auth-links">
              <a className="auth-link" href={forgotPasswordUrl}>
                Forgot password?
              </a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
