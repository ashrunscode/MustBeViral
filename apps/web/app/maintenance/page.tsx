import { StatusScreen } from '../../src/components/status-screen';

export default function MaintenancePage() {
  return (
    <StatusScreen
      title="Studio is temporarily unavailable"
      actions={[{ href: '/', label: 'Return home', variant: 'primary' }]}
    >
      <p>
        Must Be Viral is undergoing maintenance. Campaign data is preserved. Provider work and new
        confirmations stay paused until service returns.
      </p>
      <p className="auth-policy">
        Try again shortly. If you were mid-run, open Receipt after service resumes.
      </p>
    </StatusScreen>
  );
}
