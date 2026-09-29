import { StatusScreen } from '../../src/components/status-screen';

export default function SignUpPage() {
  return (
    <StatusScreen
      title="Enrollment is closed"
      actions={[
        { href: '/login', label: 'Sign in to an invited account', variant: 'primary' },
        { href: '/', label: 'Back to overview', variant: 'secondary' },
      ]}
    >
      <p>
        MustBeViral Studio is in closed evaluation for DTC marketing teams. Self-service signup is
        not enabled, and creating an account here will not succeed.
      </p>
      <p>
        If your team was invited, use the email and password from your operator. Otherwise request
        access through your MustBeViral contact — admission is manual and allowlist-based.
      </p>
      <p className="auth-policy">
        We do not collect signup requests on this screen. No account is created until an operator
        provisions one in Supabase Auth.
      </p>
    </StatusScreen>
  );
}
