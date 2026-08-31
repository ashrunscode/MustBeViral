import { describe, expect, it } from 'vitest';

import {
  defaultStripeCatalogAmounts,
  extractStripeCustomerId,
  extractStripeWalletCreditMicros,
  extractStripeWorkspaceId,
  parseStripeSubscriptionStatus,
  planStripeSubscriptionUpdate,
  planStripeWalletCredit,
  settleStripeWebhookEvent,
} from './stripe-settlement';

describe('planStripeWalletCredit', () => {
  it('returns null for non-positive amounts', () => {
    expect(
      planStripeWalletCredit({
        stripeEventId: 'evt_zero',
        amountMicros: 0n,
        eventType: 'checkout.session.completed',
        requestId: 'req_zero',
      }),
    ).toBeNull();
  });

  it('plans a balanced credit movement for checkout completion', () => {
    const plan = planStripeWalletCredit({
      stripeEventId: 'evt_checkout',
      amountMicros: 50_000_000n,
      eventType: 'checkout.session.completed',
      requestId: 'req_checkout',
    });
    expect(plan).not.toBeNull();
    expect(plan?.walletCreditMicros).toBe(50_000_000n);
    expect(plan?.movement.causativeKey).toBe('stripe:evt_checkout');
    expect(plan?.movement.entries.length).toBeGreaterThan(0);
  });

  it('exposes pilot catalog amounts', () => {
    const amounts = defaultStripeCatalogAmounts();
    expect(amounts.setupFeeMicros).toBe(500_000_000n);
    expect(amounts.subscriptionMicros).toBe(149_000_000n);
  });

  it('extracts wallet credit micros from checkout and invoice payloads', () => {
    expect(
      extractStripeWalletCreditMicros(
        {
          data: { object: { amount_total: 5000 } },
        },
        'checkout.session.completed',
      ),
    ).toBe(50_000_000n);
    expect(
      extractStripeWalletCreditMicros(
        {
          data: { object: { amount_paid: 14900 } },
        },
        'invoice.paid',
      ),
    ).toBe(149_000_000n);
    expect(
      extractStripeWalletCreditMicros({ data: { object: {} } }, 'customer.subscription.updated'),
    ).toBeNull();
  });

  it('extracts workspace and customer identifiers from checkout metadata', () => {
    const payload = {
      data: {
        object: {
          customer: 'cus_123',
          metadata: { workspace_id: '99910000-0000-4000-8000-000000000001' },
        },
      },
    };
    expect(extractStripeWorkspaceId(payload, 'checkout.session.completed')).toBe(
      '99910000-0000-4000-8000-000000000001',
    );
    expect(extractStripeCustomerId(payload)).toBe('cus_123');
  });
});

describe('settleStripeWebhookEvent', () => {
  it('plans wallet credit and subscription updates', () => {
    expect(
      settleStripeWebhookEvent({
        verified: {
          eventId: 'evt_checkout',
          eventType: 'checkout.session.completed',
          livemode: false,
          payload: { data: { object: { amount_total: 5000 } } },
        },
        requestId: 'req_checkout',
      }).kind,
    ).toBe('wallet_credit');
    expect(
      settleStripeWebhookEvent({
        verified: {
          eventId: 'evt_sub',
          eventType: 'customer.subscription.updated',
          livemode: false,
          payload: {
            data: { object: { id: 'sub_123', customer: 'cus_123', status: 'active' } },
          },
        },
        requestId: 'req_sub',
      }),
    ).toMatchObject({
      kind: 'subscription_update',
      subscriptionStatus: 'active',
    });
    expect(parseStripeSubscriptionStatus('unpaid')).toBe('past_due');
    expect(
      planStripeSubscriptionUpdate({
        stripeEventId: 'evt_sub',
        eventType: 'customer.subscription.created',
        subscriptionStatus: 'trialing',
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
      }).setupFeePaid,
    ).toBe(true);
  });
});
