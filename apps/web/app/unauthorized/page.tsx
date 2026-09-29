import { StatusScreen } from '../../src/components/status-screen';

export default function UnauthorizedPage() {
  return (
    <StatusScreen
      title="You do not have access"
      actions={[
        { href: '/login', label: 'Sign in with another account', variant: 'primary' },
        { href: '/', label: 'Return home', variant: 'secondary' },
      ]}
    >
      <p>
        Your session is valid, but this workspace, run, or action is outside your permissions. Sign
        in with an invited account or return to a campaign you own.
      </p>
    </StatusScreen>
  );
}
