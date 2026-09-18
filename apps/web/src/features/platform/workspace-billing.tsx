'use client';
import type { ReactNode } from 'react';
import { formatUsdMicros } from '@mustbeviral/ui';
import type { PlatformOutput } from '@mustbeviral/contracts';
import {
  PlatformFrame,
  PlatformHeading,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { usePlatformQuery } from './use-platform-query';
import { isResourceId } from './platform-navigation';
import { PlatformRequestError } from './platform-client';

type Billing = PlatformOutput<'get_workspace_billing'>;
type BillingQuery = {
  data: Billing | undefined;
  error: unknown;
  loading: boolean;
  refresh: () => void;
};

export function parseWireMicros(value: string): bigint {
  if (!/^\d+$/u.test(value)) throw new RangeError('Invalid money value');
  return BigInt(value);
}

export function studioDirectoryOwnsWorkspace(
  items: ReadonlyArray<{ workspace_id: string }>,
  workspaceId: string,
) {
  return items.some((item) => item.workspace_id === workspaceId);
}

export function WorkspaceBilling({
  workspaceId,
  studioId,
}: Readonly<{ workspaceId: string; studioId?: string }>) {
  const validWorkspace = isResourceId(workspaceId);
  const billing = usePlatformQuery(
    'get_workspace_billing',
    { workspace_id: workspaceId },
    validWorkspace,
  );
  if (isResourceId(studioId)) {
    return (
      <StudioAssociatedBilling
        studioId={studioId}
        workspaceId={workspaceId}
        validWorkspace={validWorkspace}
        billing={billing}
      />
    );
  }
  return (
    <BillingShell workspaceId={workspaceId} validWorkspace={validWorkspace} billing={billing} />
  );
}

function StudioAssociatedBilling({
  studioId,
  workspaceId,
  validWorkspace,
  billing,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  validWorkspace: boolean;
  billing: BillingQuery;
}>) {
  const studio = usePlatformQuery('get_studio_access', { studio_id: studioId });
  if (studio.loading) {
    return (
      <BillingShell
        workspaceId={workspaceId}
        validWorkspace={validWorkspace}
        billing={billing}
        waiting
      />
    );
  }
  if (studio.error !== undefined || !studio.data) {
    return (
      <BillingShell workspaceId={workspaceId} validWorkspace={validWorkspace} billing={billing} />
    );
  }
  const scoped = studio.data;
  return (
    <StudioWorkspacePages studioId={studioId} workspaceId={workspaceId}>
      {({ loading, associated }) => (
        <BillingShell
          workspaceId={workspaceId}
          validWorkspace={validWorkspace}
          billing={billing}
          waiting={loading}
          {...(associated
            ? {
                studioId: scoped.studio.id,
                studioName: scoped.studio.name,
                role: scoped.role,
              }
            : {})}
        />
      )}
    </StudioWorkspacePages>
  );
}

function StudioWorkspacePages({
  studioId,
  workspaceId,
  cursor,
  children,
}: Readonly<{
  studioId: string;
  workspaceId: string;
  cursor?: string;
  children: (state: { loading: boolean; associated: boolean }) => ReactNode;
}>) {
  const brands = usePlatformQuery('list_studio_brands', {
    studio_id: studioId,
    include_archived: true,
    limit: 100,
    ...(cursor ? { cursor } : {}),
  });
  if (brands.loading) return children({ loading: true, associated: false });
  if (brands.error !== undefined || !brands.data) {
    return children({ loading: false, associated: false });
  }
  if (studioDirectoryOwnsWorkspace(brands.data.items, workspaceId)) {
    return children({ loading: false, associated: true });
  }
  if (brands.data.next_cursor) {
    return (
      <StudioWorkspacePages
        studioId={studioId}
        workspaceId={workspaceId}
        cursor={brands.data.next_cursor}
      >
        {children}
      </StudioWorkspacePages>
    );
  }
  return children({ loading: false, associated: false });
}

function BillingShell({
  workspaceId,
  studioId,
  studioName,
  role,
  validWorkspace,
  billing,
  waiting = false,
}: Readonly<{
  workspaceId: string;
  studioId?: string;
  studioName?: string;
  role?: string;
  validWorkspace: boolean;
  billing: BillingQuery;
  waiting?: boolean;
}>) {
  const frame = (children: ReactNode) => (
    <PlatformFrame
      workspaceId={workspaceId}
      showBilling={billing.data !== undefined}
      billingCurrent
      {...(studioId ? { studioId } : {})}
      {...(studioName ? { studioName } : {})}
      {...(role ? { role } : {})}
    >
      {children}
    </PlatformFrame>
  );
  if (!validWorkspace) {
    return frame(
      <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'Invalid workspace')} />,
    );
  }
  if (waiting || billing.loading) {
    return frame(<PlatformLoading label="Loading workspace billing…" />);
  }
  if (billing.error !== undefined || !billing.data) {
    return frame(<PlatformRecovery error={billing.error} retry={billing.refresh} />);
  }
  return frame(<WorkspaceBillingView data={billing.data} />);
}

export function WorkspaceBillingView({ data }: Readonly<{ data: Billing }>) {
  let walletLabel = 'Not available';
  if (data.wallet_balance_micros !== null) {
    walletLabel = formatUsdMicros(parseWireMicros(data.wallet_balance_micros));
  }
  const ledgerLabel = formatUsdMicros(parseWireMicros(data.ledger_wallet_available_micros));
  const usageLabel = formatUsdMicros(parseWireMicros(data.usage_expense_micros));
  return (
    <>
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
    </>
  );
}
