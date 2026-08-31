import { StatusScreen } from '../src/components/status-screen';

export default function NotFoundPage() {
  return (
    <StatusScreen
      title="This page does not exist"
      actions={[
        { href: '/', label: 'Return home', variant: 'primary' },
        { href: '/login', label: 'Sign in', variant: 'secondary' },
      ]}
    >
      <p>
        The URL may be mistyped, expired, or belong to a campaign that moved. Signed-in work lives
        under Studio.
      </p>
    </StatusScreen>
  );
}
