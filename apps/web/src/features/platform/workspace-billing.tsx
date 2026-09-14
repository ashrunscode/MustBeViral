'use client';
import { formatUsdMicros } from '@mustbeviral/ui';
import type { PlatformOutput } from '@mustbeviral/contracts';
import { PlatformHeading, PlatformLoading, PlatformRecovery } from './platform-frame';
import { usePlatformQuery } from './use-platform-query';
import { isResourceId } from './platform-navigation';
import { PlatformRequestError } from './platform-client';

type Billing = PlatformOutput<'get_workspace_billing'>;

export function parseWireMicros(value: string): bigint {
  if (!/^\d+$/u.test(value)) throw new RangeError('Invalid money value');
  return BigInt(value);
}

export function WorkspaceBilling({ workspaceId }: Readonly<{ workspaceId: string }>) {
  const valid = isResourceId(workspaceId);
  const query = usePlatformQuery('get_workspace_billing', { workspace_id: workspaceId }, valid);
  if (!valid)
    return <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid workspace')} />;
  if (query.loading) return <PlatformLoading label="Loading workspace billing…" />;
  if (query.error !== undefined || !query.data)
    return <PlatformRecovery error={query.error} retry={query.refresh} />;
  return <WorkspaceBillingView data={query.data} />;
}

export function WorkspaceBillingView({ data }: Readonly<{ data: Billing }>) {
  let walletLabel = 'Not available';
  if (data.wallet_balance_micros !== null) {
    walletLabel = formatUsdMicros(parseWireMicros(data.wallet_balance_micros));
  }
  const ledgerLabel = formatUsdMicros(parseWireMicros(data.ledger_wallet_available_micros));
  const usageLabel = formatUsdMicros(parseWireMicros(data.usage_expense_micros));
  return (
    <div className="platform-app">
      <main id="main-content" className="platform-main">
        <PlatformHeading
          title="Workspace billing."
          description="These totals come from this workspace’s saved wallet and ledger. Charging stays off until it is separately authorized."
        />
        <div className="platform-stack">
          {!data.charging_enabled && (
            <p role="status" className="platform-note">
              Charging is turned off. That is not a wallet balance of zero.
            </p>
          )}
          {!data.profile_present && (
            <p role="status" className="platform-note">
              No billing profile is on file for this workspace, so we cannot show a saved wallet
              balance.
            </p>
          )}
          {data.profile_present && data.subscription_status === 'none' && (
            <p role="status" className="platform-note">
              No subscription is attached to this workspace.
            </p>
          )}
          {data.subscription_status === 'past_due' || data.subscription_status === 'canceled' ? (
            <p role="status" className="platform-note">
              The subscription is not active ({data.subscription_status.replace('_', ' ')}).
            </p>
          ) : null}
          {data.balances_match === false && (
            <p role="status" className="platform-note">
              The saved wallet and the ledger total do not match. Neither number was changed.
            </p>
          )}
          <section className="platform-card platform-pad platform-stack">
            <h2>Saved wallet</h2>
            <p className="platform-tag">{data.profile_present ? 'On file' : 'Missing profile'}</p>
            <p>{walletLabel}</p>
            <p className="platform-muted">
              Subscription: {data.subscription_status ?? 'none on file'}
            </p>
          </section>
          <section className="platform-card platform-pad platform-stack">
            <h2>Ledger</h2>
            <p>Available: {ledgerLabel}</p>
            <p>Recorded usage: {usageLabel}</p>
            <p className="platform-muted">
              Usage is the sum of usage ledger rows. It is not an estimate and it is not a second
              wallet.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
