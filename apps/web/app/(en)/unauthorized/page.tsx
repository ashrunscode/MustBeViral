import type { Metadata } from 'next';

import { StatusScreen } from '../../../src/components/status-screen';

export const metadata: Metadata = {
  title: 'No access',
  description: 'This workspace or action is outside your permissions.',
};

export default function UnauthorizedPage() {
  return (
    <StatusScreen
      title="You do not have access"
      actions={[
        { href: '/studio', label: 'Choose a permitted studio', variant: 'primary' },
        { href: '/login', label: 'Sign in with another account', variant: 'secondary' },
      ]}
    >
      <p>
        Your session is valid, but this workspace, brand or action is outside your permissions.
        Nothing changed.
      </p>
      <p className="auth-policy">
        Ask the workspace owner to share the brand with your studio, or open a brand you already
        have.
      </p>
    </StatusScreen>
  );
}
