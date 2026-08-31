'use client';

import { LedgerTable, MonoCaps, formatUsdMicros } from '@mustbeviral/ui';

const catalogChargeMicros = 4_550_000n;
const marginCapMicros = 1_820_000n;

export type BillingWalletState = 'funded' | 'low_balance' | 'blocked' | 'closed';

export interface BillingUsageViewModel {
  readonly walletState: BillingWalletState;
  readonly walletBalanceMicros: bigint;
  readonly subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  readonly lastReceiptLabel: string | null;
  readonly lastRefundLabel: string | null;
}

export const BILLING_USAGE_SCENARIOS: Readonly<Record<BillingWalletState, BillingUsageViewModel>> =
  Object.freeze({
    funded: Object.freeze({
      walletState: 'funded',
      walletBalanceMicros: 250_000_000n,
      subscriptionStatus: 'active',
      lastReceiptLabel: 'Launch pack receipt · GB-04',
      lastRefundLabel: null,
    }),
    low_balance: Object.freeze({
      walletState: 'low_balance',
      walletBalanceMicros: 5_000_000n,
      subscriptionStatus: 'active',
      lastReceiptLabel: 'Launch pack receipt · GB-02',
      lastRefundLabel: null,
    }),
    blocked: Object.freeze({
      walletState: 'blocked',
      walletBalanceMicros: 0n,
      subscriptionStatus: 'past_due',
      lastReceiptLabel: 'Launch pack receipt · GB-01',
      lastRefundLabel: 'Reservation release · GB-01 partial',
    }),
    closed: Object.freeze({
      walletState: 'closed',
      walletBalanceMicros: 0n,
      subscriptionStatus: 'none',
      lastReceiptLabel: null,
      lastRefundLabel: null,
    }),
  });

/** Named fixtures for P1a billing acceptance: funded, low balance, blocked, receipt detail, refund/release. */
export const BILLING_ACCEPTANCE_FIXTURES = Object.freeze({
  funded: BILLING_USAGE_SCENARIOS.funded,
  low_balance: BILLING_USAGE_SCENARIOS.low_balance,
  blocked: BILLING_USAGE_SCENARIOS.blocked,
  receipt_detail: Object.freeze({
    walletState: 'funded',
    walletBalanceMicros: 180_000_000n,
    subscriptionStatus: 'active',
    lastReceiptLabel: 'Launch pack receipt · GB-04 · immutable ledger row',
    lastRefundLabel: null,
  } satisfies BillingUsageViewModel),
  refund_release: Object.freeze({
    walletState: 'funded',
    walletBalanceMicros: 220_000_000n,
    subscriptionStatus: 'active',
    lastReceiptLabel: 'Launch pack receipt · GB-02',
    lastRefundLabel: 'Reservation release · GB-02 partial · 45,000,000 micros returned',
  } satisfies BillingUsageViewModel),
});

export function defaultBillingUsageViewModel(): BillingUsageViewModel {
  return BILLING_USAGE_SCENARIOS.closed;
}

function walletStateLabel(state: BillingWalletState): string {
  switch (state) {
    case 'funded':
      return 'Funded';
    case 'low_balance':
      return 'Low balance';
    case 'blocked':
      return 'Blocked';
    case 'closed':
      return 'Closed enrollment';
  }
}

function walletStateCopy(state: BillingWalletState): string {
  switch (state) {
    case 'funded':
      return 'Funded — wallet covers upcoming named-price reservations.';
    case 'low_balance':
      return 'Low balance — add prepaid credit before the next pack confirmation.';
    case 'blocked':
      return 'Blocked — subscription or wallet balance prevents new reservations.';
    case 'closed':
      return 'Closed enrollment — operator credit only until Stripe test mode is authorized.';
  }
}

function walletStateBadgeClass(state: BillingWalletState): string {
  return `billing-wallet-badge billing-wallet-badge--${state}`;
}

function subscriptionStatusLabel(status: BillingUsageViewModel['subscriptionStatus']): string {
  switch (status) {
    case 'none':
      return 'None';
    case 'active':
      return 'Active';
    case 'past_due':
      return 'Past due';
    case 'canceled':
      return 'Canceled';
  }
}

export function BillingUsagePanel({
  model = defaultBillingUsageViewModel(),
}: Readonly<{ model?: BillingUsageViewModel }>) {
  return (
    <main className="internal-ops" id="main-content">
      <div className="internal-ops__grid">
        <section className="internal-ops__card" aria-labelledby="billing-heading">
          <MonoCaps>Usage and billing</MonoCaps>
          <h1 id="billing-heading">Wallet and receipts</h1>
          <p>
            P1a adds the prepaid usage wallet, setup charge, and subscription on top of P0
            named-price quotes. Charging remains disabled until Stripe test-mode credentials and
            operator authorization are recorded.
          </p>
        </section>

        <section className="internal-ops__card" aria-labelledby="wallet-heading">
          <MonoCaps>Prepaid wallet</MonoCaps>
          <h2 id="wallet-heading">Balance and subscription</h2>
          <p
            className={walletStateBadgeClass(model.walletState)}
            role="status"
            aria-label={`Wallet state ${walletStateLabel(model.walletState)}`}
          >
            {walletStateLabel(model.walletState)}
          </p>
          <dl className="billing-wallet-details">
            <div>
              <dt>Available balance</dt>
              <dd>{formatUsdMicros(model.walletBalanceMicros)}</dd>
            </div>
            <div>
              <dt>Subscription</dt>
              <dd>
                <span
                  className={`billing-subscription-badge billing-subscription-badge--${model.subscriptionStatus}`}
                  aria-label={`Subscription status ${subscriptionStatusLabel(model.subscriptionStatus)}`}
                >
                  {subscriptionStatusLabel(model.subscriptionStatus)}
                </span>
              </dd>
            </div>
          </dl>
          <p className="auth-policy">{walletStateCopy(model.walletState)}</p>
        </section>

        <section className="internal-ops__card" aria-labelledby="receipt-heading">
          <MonoCaps>Receipt detail</MonoCaps>
          <h2 id="receipt-heading">Immutable receipts</h2>
          {model.lastReceiptLabel === null ? (
            <p>No wallet-backed receipts yet.</p>
          ) : (
            <dl className="billing-receipt-details">
              <div>
                <dt>Latest receipt</dt>
                <dd>{model.lastReceiptLabel}</dd>
              </div>
              <div>
                <dt>Catalog charge</dt>
                <dd>{formatUsdMicros(catalogChargeMicros)}</dd>
              </div>
            </dl>
          )}
        </section>

        {model.lastRefundLabel === null ? null : (
          <section className="internal-ops__card" aria-labelledby="refund-heading">
            <MonoCaps>Refund / release</MonoCaps>
            <h2 id="refund-heading">Reservation release</h2>
            <dl className="billing-receipt-details">
              <div>
                <dt>Latest release</dt>
                <dd>{model.lastRefundLabel}</dd>
              </div>
              <div>
                <dt>Ledger effect</dt>
                <dd>Prepaid balance restored — no hidden mock charge</dd>
              </div>
            </dl>
          </section>
        )}

        <section className="internal-ops__card" aria-labelledby="quote-cap-heading">
          <MonoCaps>Named-price quote</MonoCaps>
          <h2 id="quote-cap-heading">Maximum pack charge</h2>
          <LedgerTable aria-label="Quote cap impact">
            <tbody>
              <tr>
                <th scope="row">Launch pack catalog charge</th>
                <td>{formatUsdMicros(catalogChargeMicros)}</td>
              </tr>
              <tr>
                <th scope="row">P1a fully-landed margin cap</th>
                <td>{formatUsdMicros(marginCapMicros)}</td>
              </tr>
              <tr>
                <th scope="row">Reservation hold</th>
                <td>At explicit confirmation</td>
              </tr>
            </tbody>
          </LedgerTable>
        </section>
      </div>
    </main>
  );
}
