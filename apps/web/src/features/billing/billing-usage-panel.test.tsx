import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { formatUsdMicros } from '@mustbeviral/ui';

import {
  BILLING_ACCEPTANCE_FIXTURES,
  BILLING_USAGE_SCENARIOS,
  BillingUsagePanel,
  defaultBillingUsageViewModel,
} from './billing-usage-panel';

const catalogChargeLabel = formatUsdMicros(4_550_000n);

describe('BillingUsagePanel', () => {
  it('renders closed enrollment by default', () => {
    const html = renderToStaticMarkup(<BillingUsagePanel />);
    expect(html).toContain('Closed enrollment');
    expect(html).toContain('Wallet and receipts');
    expect(html).toContain('No wallet-backed receipts yet.');
    expect(html).toContain(catalogChargeLabel);
    expect(html).not.toContain('Refund / release');
  });

  it('exposes the default closed model', () => {
    expect(defaultBillingUsageViewModel().walletState).toBe('closed');
  });

  describe('P1a acceptance fixtures', () => {
    it('renders funded state with active subscription and receipt', () => {
      const model = BILLING_ACCEPTANCE_FIXTURES.funded;
      const html = renderToStaticMarkup(<BillingUsagePanel model={model} />);

      expect(html).toContain('billing-wallet-badge--funded');
      expect(html).toContain('Funded');
      expect(html).toContain(formatUsdMicros(model.walletBalanceMicros));
      expect(html).toContain('Funded — wallet covers upcoming named-price reservations.');
      expect(html).toContain('billing-subscription-badge--active');
      expect(html).toContain('Launch pack receipt · GB-04');
      expect(html).toContain('Catalog charge');
      expect(html).not.toContain('Refund / release');
    });

    it('renders low-balance state with attention styling', () => {
      const model = BILLING_ACCEPTANCE_FIXTURES.low_balance;
      const html = renderToStaticMarkup(<BillingUsagePanel model={model} />);

      expect(html).toContain('billing-wallet-badge--low_balance');
      expect(html).toContain('Low balance');
      expect(html).toContain(formatUsdMicros(model.walletBalanceMicros));
      expect(html).toContain('add prepaid credit before the next pack confirmation');
      expect(html).toContain('Launch pack receipt · GB-02');
    });

    it('renders blocked state with past-due subscription and refund section', () => {
      const model = BILLING_ACCEPTANCE_FIXTURES.blocked;
      const html = renderToStaticMarkup(<BillingUsagePanel model={model} />);

      expect(html).toContain('billing-wallet-badge--blocked');
      expect(html).toContain('Blocked');
      expect(html).toContain('$0.00');
      expect(html).toContain('billing-subscription-badge--past_due');
      expect(html).toContain('Past due');
      expect(html).toContain('Refund / release');
      expect(html).toContain('Reservation release · GB-01 partial');
      expect(html).toContain('no hidden mock charge');
    });

    it('renders receipt detail with explicit catalog charge — no hidden mock charge', () => {
      const model = BILLING_ACCEPTANCE_FIXTURES.receipt_detail;
      const html = renderToStaticMarkup(<BillingUsagePanel model={model} />);

      expect(html).toContain('immutable ledger row');
      expect(html).toContain('Catalog charge');
      expect(html).toContain(catalogChargeLabel);
      expect(html).toContain('Launch pack catalog charge');
      expect(html).toContain('P1a fully-landed margin cap');
      expect(html).toContain(formatUsdMicros(1_820_000n));
      expect(html).toContain('At explicit confirmation');
    });

    it('renders refund/release on a funded wallet without blocking reservations copy', () => {
      const model = BILLING_ACCEPTANCE_FIXTURES.refund_release;
      const html = renderToStaticMarkup(<BillingUsagePanel model={model} />);

      expect(html).toContain('billing-wallet-badge--funded');
      expect(html).toContain('Refund / release');
      expect(html).toContain('45,000,000 micros returned');
      expect(html).toContain('Prepaid balance restored');
      expect(html).not.toContain('billing-wallet-badge--blocked');
    });
  });

  it('covers all wallet scenario keys with prepaid wallet and named-price quote', () => {
    for (const scenario of Object.values(BILLING_USAGE_SCENARIOS)) {
      const html = renderToStaticMarkup(<BillingUsagePanel model={scenario} />);
      expect(html).toContain('Balance and subscription');
      expect(html).toContain('Named-price quote');
      expect(html).toContain(catalogChargeLabel);
    }
  });
});
