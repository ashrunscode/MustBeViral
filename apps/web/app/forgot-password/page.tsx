import { MonoCaps } from '@mustbeviral/ui';

import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { ForgotPasswordForm } from './forgot-password-form';

const notices: Readonly<Record<string, string>> = {
  expired_link: 'That recovery link expired. Request a new link.',
  auth_link_failed: 'That recovery link could not be verified. Request a new link.',
  rate_limited: 'Too many auth attempts. Wait a moment, then request a new recovery link.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>) {
  const params = await searchParams;
  const next = safeStudioRedirectPath(params.next);
  const noticeKey = typeof params.notice === 'string' ? params.notice : '';
  const notice = notices[noticeKey];
  const signInUrl = `/login?${new URLSearchParams({ next }).toString()}`;

  return (
    <main className="auth-page">
      <a className="skip-link" href="#auth-heading">
        Skip to password recovery
      </a>
      <section aria-labelledby="auth-heading" className="auth-card">
        <MonoCaps>MustBeViral Studio</MonoCaps>
        <h1 id="auth-heading">Reset your password</h1>
        <p className="auth-intro">
          Enter the email associated with your invited Studio workspace. We will send a single-use
          recovery link if the account exists.
        </p>
        {notice === undefined ? null : (
          <p className="auth-message auth-message--notice" role="status">
            {notice}
          </p>
        )}
        <ForgotPasswordForm next={next} />
        <div className="auth-links">
          <a className="auth-link" href={signInUrl}>
            Return to sign in
          </a>
        </div>
      </section>
    </main>
  );
}
