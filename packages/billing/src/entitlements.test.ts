import { describe, expect, it } from 'vitest';

import {
  DEFAULT_BILLING_ENTITLEMENTS,
  buildBillingEntitlementsSnapshot,
  evaluateQuoteEntitlements,
  evaluateStartRunEntitlements,
} from './entitlements';

describe('billing entitlements', () => {
  it('allows P0 transparent quotes when charging is disabled', () => {
    expect(evaluateQuoteEntitlements(DEFAULT_BILLING_ENTITLEMENTS, 4_550_000n)).toEqual({
      status: 'ok',
    });
  });

  it('builds snapshots from kill switches and billing profiles', () => {
    expect(
      buildBillingEntitlementsSnapshot(
        {
          signupsEnabled: false,
          generationEnabled: true,
          providerRoutesEnabled: true,
          chargingEnabled: true,
        },
        {
          walletBalanceMicros: 50_000_000n,
          subscriptionStatus: 'active',
          setupFeePaid: true,
        },
      ),
    ).toEqual({
      chargingEnabled: true,
      generationEnabled: true,
      providerRoutesEnabled: true,
      walletBalanceMicros: 50_000_000n,
      subscriptionStatus: 'active',
      setupFeePaid: true,
    });
  });

  it('blocks paid quotes when setup, subscription, or wallet prerequisites fail', () => {
    const paid = {
      ...DEFAULT_BILLING_ENTITLEMENTS,
      chargingEnabled: true,
      setupFeePaid: true,
      subscriptionStatus: 'active' as const,
      walletBalanceMicros: 10_000_000n,
    };
    expect(evaluateQuoteEntitlements(paid, 4_550_000n)).toEqual({ status: 'ok' });
    expect(evaluateQuoteEntitlements({ ...paid, setupFeePaid: false }, 4_550_000n)).toEqual({
      status: 'blocked',
      reason: 'setup_fee_unpaid',
    });
    expect(
      evaluateQuoteEntitlements({ ...paid, subscriptionStatus: 'canceled' }, 4_550_000n),
    ).toEqual({ status: 'blocked', reason: 'subscription_inactive' });
    expect(
      evaluateQuoteEntitlements({ ...paid, walletBalanceMicros: 1_000_000n }, 4_550_000n),
    ).toEqual({ status: 'blocked', reason: 'insufficient_wallet' });
  });

  it('blocks start_run when generation is disabled even if charging is off', () => {
    expect(
      evaluateStartRunEntitlements(
        { ...DEFAULT_BILLING_ENTITLEMENTS, generationEnabled: false },
        4_550_000n,
      ),
    ).toEqual({ status: 'blocked', reason: 'generation_disabled' });
  });

  it('blocks start_run when provider routes are disabled', () => {
    expect(
      evaluateStartRunEntitlements(
        { ...DEFAULT_BILLING_ENTITLEMENTS, providerRoutesEnabled: false },
        4_550_000n,
      ),
    ).toEqual({ status: 'blocked', reason: 'provider_routes_disabled' });
  });
});
