import type { Metadata } from 'next';

import { StatusScreen } from '../../src/components/status-screen';

export const metadata: Metadata = {
  title: 'Temporarily unavailable',
  description: 'Must Be Viral Studio is paused for maintenance. Saved work is kept.',
};

export default function MaintenancePage() {
  return (
    <StatusScreen
      title="Studio is temporarily unavailable"
      actions={[
        { href: '/login', label: 'Sign in to Studio', variant: 'primary' },
        { href: '/', label: 'Must Be Viral home', variant: 'secondary' },
      ]}
    >
      <p>Studio is paused for maintenance. It keeps your saved brands, drafts and approvals.</p>
      <p className="auth-policy">
        Nothing new starts until service returns. If you were mid-run, open its results page after
        service resumes.
      </p>
    </StatusScreen>
  );
}
