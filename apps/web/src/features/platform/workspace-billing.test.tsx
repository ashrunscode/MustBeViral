import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { parseWireMicros, WorkspaceBillingView } from './workspace-billing';

const workspace = 'a7000000-0000-4000-8000-000000000001';

describe('workspace billing presentation', () => {
  it('parses integer micros from the wire without floating point', () => {
    expect(parseWireMicros('9007199254740993')).toBe(9007199254740993n);
  });

  it('keeps missing profile, charging-off, and true zero distinct', () => {
    const missing = renderToStaticMarkup(
      <WorkspaceBillingView
        data={{
          workspace_id: workspace,
          profile_present: false,
          charging_enabled: false,
          subscription_status: null,
          wallet_balance_micros: null,
          ledger_wallet_available_micros: '0',
          usage_expense_micros: '0',
          balances_match: null,
        }}
      />,
    );
    expect(missing).toContain('No billing profile is on file');
    expect(missing).toContain('Charging is turned off');
    expect(missing).toContain('Not available');
    expect(missing).not.toContain('P1a');
    expect(missing).not.toContain('Closed enrollment');
    const zero = renderToStaticMarkup(
      <WorkspaceBillingView
        data={{
          workspace_id: workspace,
          profile_present: true,
          charging_enabled: true,
          subscription_status: 'none',
          wallet_balance_micros: '0',
          ledger_wallet_available_micros: '0',
          usage_expense_micros: '0',
          balances_match: true,
        }}
      />,
    );
    expect(zero).toContain('$0.00');
    expect(zero).toContain('No subscription is attached');
  });
});
