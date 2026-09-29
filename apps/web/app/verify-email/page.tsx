import { MonoCaps } from '@mustbeviral/ui';

import { readVerifyEmailPrefill } from '../../src/lib/auth/verify-email';
import { VerifyEmailForm } from './verify-email-form';

export default async function VerifyEmailPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<Readonly<Record<string, string | string[] | undefined>>>;
}>) {
  const params = await searchParams;
  const { email, next } = readVerifyEmailPrefill(params);

  return (
    <main className="auth-page">
      <a className="skip-link" href="#verify-heading">
        Skip to verification
      </a>
      <section aria-labelledby="verify-heading" className="auth-card">
        <MonoCaps>MustBeViral Studio</MonoCaps>
        <h1 id="verify-heading">Verify your email</h1>
        <p className="auth-intro">
          Invited accounts must verify email before Studio access. Open the newest verification link
          or request another message below.
        </p>
        <VerifyEmailForm email={email} next={next} />
        <div className="auth-links">
          <a className="auth-link" href={`/login?${new URLSearchParams({ next }).toString()}`}>
            Back to sign in
          </a>
          <span aria-hidden="true">·</span>
          <a className="auth-link" href="/signup">
            Request access
          </a>
        </div>
      </section>
    </main>
  );
}
