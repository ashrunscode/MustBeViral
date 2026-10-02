import type { Metadata } from 'next';

import { requestAccessHref, studioEmail } from '../../src/components/public-copy';
import { StatusScreen } from '../../src/components/status-screen';

export const metadata: Metadata = {
  title: 'Request access',
  description: 'Enrollment is closed. Request access by email; this page collects nothing.',
};

export default function SignUpPage() {
  return (
    <StatusScreen
      title="Request access"
      actions={[
        { href: requestAccessHref, label: 'Request access by email', variant: 'primary' },
        { href: '/login', label: 'Sign in to Studio', variant: 'secondary' },
      ]}
    >
      <p>Enrollment is closed. Write to {studioEmail} and say which brand you run.</p>
      <p className="auth-policy">This screen collects nothing. No account is created here.</p>
    </StatusScreen>
  );
}
