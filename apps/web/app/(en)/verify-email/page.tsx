import type { Metadata } from 'next';

import { readVerifyEmailPrefill } from '../../../src/lib/auth/verify-email';
import { VerifyEmailForm } from './verify-email-form';
import { PublicFooter } from '../../../src/components/public-footer';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Request a new verification email for your Must Be Viral Studio account.',
};

export default async function VerifyEmailPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>) {
  const params = await searchParams;
  const { email, next } = readVerifyEmailPrefill(params);

  return (
    <div className="auth-layout">
      <main className="auth-page">
        <a className="skip-link" href="#verify-heading">
          Skip to verification
        </a>
        <section aria-labelledby="verify-heading" className="auth-card">
          <span className="pub-wordmark" translate="no">
            {'Must\u00a0Be\u00a0Viral'}
          </span>
          <h1 id="verify-heading">Verify your email</h1>
          <p className="auth-intro">
            Invited accounts verify their email before Studio opens. Open the newest verification
            link, or request another message below.
          </p>
          <VerifyEmailForm email={email} next={next} />
          <div className="auth-links">
            <a className="auth-link" href={`/login?${new URLSearchParams({ next }).toString()}`}>
              Back to sign in
            </a>
          </div>
        </section>
      </main>
      <PublicFooter compact surface="legal" />
    </div>
  );
}
