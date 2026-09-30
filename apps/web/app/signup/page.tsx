import { StatusScreen } from '../../src/components/status-screen';

export default function SignUpPage() {
  return (
    <StatusScreen
      title="Enrollment is closed"
      actions={[
        { href: '/login', label: 'Sign in to Studio', variant: 'primary' },
        { href: '/', label: 'Return home', variant: 'secondary' },
      ]}
    >
      <p>Sign in if you were invited.</p>
      <p className="auth-policy">This screen collects nothing. No account is created here.</p>
    </StatusScreen>
  );
}
