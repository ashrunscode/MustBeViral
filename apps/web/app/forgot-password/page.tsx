import type { Metadata } from 'next';

import { authMessageClassName, authMessageRole } from '../../src/lib/auth/auth-message';
import { safeStudioRedirectPath } from '../../src/lib/auth/sign-in';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata: Metadata = {
  title: 'Reset your password',
  description: 'Request a single-use recovery link for your Must Be Viral Studio account.',
};

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
        <span className="pub-wordmark" translate="no">
          {'Must\u00a0Be\u00a0Viral'}
        </span>
        <h1 id="auth-heading">Reset your password</h1>
        <p className="auth-intro">
          Enter the email for your Studio workspace. If the account exists, a single-use recovery
          link is on the way.
        </p>
        {notice === undefined ? null : (
          <p className={authMessageClassName(noticeKey)} role={authMessageRole(noticeKey)}>
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
