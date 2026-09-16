import { describe, expect, it } from 'vitest';

import {
  defaultStripeCatalogAmounts,
  extractStripeCustomerId,
  extractStripeWorkspaceId,
  parseStripeSubscriptionStatus,
  planStripeSubscriptionUpdate,
  planStripeWalletCredit,
  readStripeWalletTopUp,
  settleStripeWebhookEvent,
  STRIPE_WALLET_TOP_UP_PURPOSE,
  stripeWalletCreditCausativeKey,
} from './stripe-settlement';

const WORKSPACE_ID = '99910000-0000-4000-8000-000000000001';
const OTHER_WORKSPACE_ID = '99910000-0000-4000-8000-000000000002';

/** A paid wallet top-up Checkout Session as our server creates it (ADR-0007). */
function topUpSession(overrides: Readonly<Record<string, unknown>> = {}) {
  return {
    id: 'cs_test_topup_1',
    object: 'checkout.session',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    currency: 'usd',
    amount_total: 5000,
    customer: 'cus_topup_1',
    client_reference_id: WORKSPACE_ID,
    metadata: { purpose: STRIPE_WALLET_TOP_UP_PURPOSE, workspace_id: WORKSPACE_ID },
    ...overrides,
  };
}

function settle(eventType: string, object: unknown, eventId = 'evt_topup_1') {
  return settleStripeWebhookEvent({
    verified: {
      eventId,
      eventType,
      livemode: false,
      payload: { id: eventId, type: eventType, data: { object } },
    },
    requestId: 'req_topup_1',
  });
}

describe('planStripeWalletCredit', () => {
  it('returns null for non-positive amounts', () => {
    expect(
      planStripeWalletCredit({
        stripeEventId: 'evt_zero',
        stripeCheckoutSessionId: 'cs_test_zero',
        workspaceId: WORKSPACE_ID,
        amountMicros: 0n,
        eventType: 'checkout.session.completed',
        requestId: 'req_zero',
      }),
    ).toBeNull();
  });

  it('keys a balanced credit movement on the Checkout Session, not the event', () => {
    const plan = planStripeWalletCredit({
      stripeEventId: 'evt_checkout',
      stripeCheckoutSessionId: 'cs_test_checkout',
      workspaceId: WORKSPACE_ID,
      amountMicros: 50_000_000n,
      eventType: 'checkout.session.completed',
      requestId: 'req_checkout',
    });
    expect(plan).not.toBeNull();
    expect(plan?.walletCreditMicros).toBe(50_000_000n);
    expect(plan?.checkoutSessionId).toBe('cs_test_checkout');
    expect(plan?.workspaceId).toBe(WORKSPACE_ID);
    expect(plan?.movement.causativeKey).toBe('stripe:checkout_session:cs_test_checkout');
    expect(plan?.movement.causativeKey).toBe(stripeWalletCreditCausativeKey('cs_test_checkout'));
    expect(plan?.movement.metadata).toMatchObject({
      event_type: 'checkout.session.completed',
      stripe_event_id: 'evt_checkout',
      stripe_checkout_session_id: 'cs_test_checkout',
    });
    expect(plan?.movement.entries.length).toBeGreaterThan(0);
  });

  it('exposes pilot catalog amounts', () => {
    const amounts = defaultStripeCatalogAmounts();
    expect(amounts.setupFeeMicros).toBe(500_000_000n);
    expect(amounts.subscriptionMicros).toBe(149_000_000n);
  });

  it('extracts workspace and customer identifiers from checkout metadata', () => {
    const payload = {
      data: {
        object: {
          customer: 'cus_123',
          metadata: { workspace_id: WORKSPACE_ID },
        },
      },
    };
    expect(extractStripeWorkspaceId(payload, 'checkout.session.completed')).toBe(WORKSPACE_ID);
    expect(extractStripeCustomerId(payload)).toBe('cus_123');
  });
});

describe('readStripeWalletTopUp', () => {
  it('does not apply to event types that never fund the wallet', () => {
    expect(readStripeWalletTopUp({ data: { object: topUpSession() } }, 'invoice.paid')).toBeNull();
    expect(
      readStripeWalletTopUp({ data: { object: topUpSession() } }, 'customer.subscription.created'),
    ).toBeNull();
  });

  it('reads a paid top-up as integer USD micros with its session and workspace', () => {
    expect(
      readStripeWalletTopUp({ data: { object: topUpSession() } }, 'checkout.session.completed'),
    ).toEqual({
      kind: 'paid',
      checkoutSessionId: 'cs_test_topup_1',
      workspaceId: WORKSPACE_ID,
      amountMicros: 50_000_000n,
    });
  });
});

describe('settleStripeWebhookEvent wallet funding (ADR-0007)', () => {
  it('credits a paid wallet top-up on checkout.session.completed', () => {
    const settlement = settle('checkout.session.completed', topUpSession());
    expect(settlement.kind).toBe('wallet_credit');
    if (settlement.kind !== 'wallet_credit') return;
    expect(settlement.plan.walletCreditMicros).toBe(50_000_000n);
    expect(settlement.plan.workspaceId).toBe(WORKSPACE_ID);
    expect(settlement.plan.movement.causativeKey).toBe('stripe:checkout_session:cs_test_topup_1');
  });

  it('credits a delayed top-up on async_payment_succeeded under the same session key', () => {
    const pending = settle(
      'checkout.session.completed',
      topUpSession({ payment_status: 'unpaid' }),
      'evt_topup_pending',
    );
    expect(pending).toEqual({
      kind: 'ignored',
      eventType: 'checkout.session.completed',
      reason: 'payment_pending',
    });

    const succeeded = settle(
      'checkout.session.async_payment_succeeded',
      topUpSession(),
      'evt_topup_async',
    );
    expect(succeeded.kind).toBe('wallet_credit');
    if (succeeded.kind !== 'wallet_credit') return;
    expect(succeeded.plan.movement.causativeKey).toBe('stripe:checkout_session:cs_test_topup_1');
    expect(succeeded.plan.eventType).toBe('checkout.session.async_payment_succeeded');
  });

  it('never credits invoice.paid, including the first invoice of a subscription', () => {
    expect(
      settle('invoice.paid', {
        id: 'in_first',
        object: 'invoice',
        billing_reason: 'subscription_create',
        status: 'paid',
        amount_paid: 64_900,
        currency: 'usd',
        customer: 'cus_topup_1',
        metadata: { workspace_id: WORKSPACE_ID },
      }),
    ).toEqual({ kind: 'ignored', eventType: 'invoice.paid', reason: 'unsupported_event_type' });
  });

  it('never credits a subscription-mode Checkout Session, even when marked as a top-up', () => {
    expect(
      settle(
        'checkout.session.completed',
        topUpSession({
          mode: 'subscription',
          amount_total: 64_900,
          subscription: 'sub_1',
          invoice: 'in_first',
        }),
      ),
    ).toEqual({
      kind: 'ignored',
      eventType: 'checkout.session.completed',
      reason: 'not_wallet_top_up',
    });
  });

  it.each([
    ['without metadata', { metadata: { workspace_id: WORKSPACE_ID } }],
    ['with another purpose', { metadata: { purpose: 'setup_fee', workspace_id: WORKSPACE_ID } }],
    ['with null metadata', { metadata: null }],
  ])('ignores a payment-mode session %s', (_label, overrides) => {
    expect(settle('checkout.session.completed', topUpSession(overrides))).toEqual({
      kind: 'ignored',
      eventType: 'checkout.session.completed',
      reason: 'not_wallet_top_up',
    });
  });

  it('ignores a completed top-up that required no payment', () => {
    expect(
      settle(
        'checkout.session.completed',
        topUpSession({ payment_status: 'no_payment_required', amount_total: 0 }),
      ),
    ).toEqual({
      kind: 'ignored',
      eventType: 'checkout.session.completed',
      reason: 'no_payment_required',
    });
  });

  // A marked top-up that Stripe says was paid but that cannot be credited is our own
  // misconfiguration with money received. It is rejected so Core fails loudly instead of
  // acknowledging the payment as ignored.
  it.each([
    [
      'async success without a paid status',
      'checkout.session.async_payment_succeeded',
      { payment_status: 'unpaid' },
      'payment_not_paid',
    ],
    [
      'a missing session id',
      'checkout.session.completed',
      { id: undefined },
      'invalid_checkout_session_id',
    ],
    [
      'a session id with a space',
      'checkout.session.completed',
      { id: 'cs_test topup' },
      'invalid_checkout_session_id',
    ],
    [
      'a session id longer than the ledger key allows',
      'checkout.session.completed',
      { id: 'a'.repeat(217) },
      'invalid_checkout_session_id',
    ],
    [
      'a non-USD currency',
      'checkout.session.completed',
      { currency: 'eur' },
      'unsupported_currency',
    ],
    [
      'a missing currency',
      'checkout.session.completed',
      { currency: null },
      'unsupported_currency',
    ],
    ['a zero amount', 'checkout.session.completed', { amount_total: 0 }, 'invalid_amount'],
    ['a fractional amount', 'checkout.session.completed', { amount_total: 50.5 }, 'invalid_amount'],
    ['a string amount', 'checkout.session.completed', { amount_total: '5000' }, 'invalid_amount'],
    [
      'no workspace id',
      'checkout.session.completed',
      { client_reference_id: null, metadata: { purpose: STRIPE_WALLET_TOP_UP_PURPOSE } },
      'missing_workspace_id',
    ],
    [
      'two different workspace ids',
      'checkout.session.completed',
      { client_reference_id: OTHER_WORKSPACE_ID },
      'conflicting_workspace_ids',
    ],
    [
      'a metadata workspace id that is not a UUID',
      'checkout.session.completed',
      { metadata: { purpose: STRIPE_WALLET_TOP_UP_PURPOSE, workspace_id: 'acme' } },
      'invalid_workspace_id',
    ],
    [
      'a client reference id that is not a UUID',
      'checkout.session.completed',
      { client_reference_id: 'order-123' },
      'invalid_workspace_id',
    ],
  ] as const)('rejects a paid top-up with %s', (_label, eventType, overrides, reason) => {
    expect(settle(eventType, topUpSession(overrides))).toEqual({
      kind: 'rejected',
      eventType,
      reason,
    });
  });

  it('accepts a top-up that names its workspace in only one of the two places', () => {
    const fromReference = settle(
      'checkout.session.completed',
      topUpSession({ metadata: { purpose: STRIPE_WALLET_TOP_UP_PURPOSE } }),
    );
    const fromMetadata = settle(
      'checkout.session.completed',
      topUpSession({ client_reference_id: null }),
    );
    expect(fromReference.kind === 'wallet_credit' && fromReference.plan.workspaceId).toBe(
      WORKSPACE_ID,
    );
    expect(fromMetadata.kind === 'wallet_credit' && fromMetadata.plan.workspaceId).toBe(
      WORKSPACE_ID,
    );
  });

  // Stripe may change object id prefixes and lengths (docs.stripe.com/upgrades). The ledger key
  // caps a Checkout Session id at 216 characters.
  it('credits a top-up whose session id has another prefix, up to the ledger key limit', () => {
    const longId = 'x'.repeat(216);
    const settlement = settle('checkout.session.completed', topUpSession({ id: longId }));
    expect(settlement.kind).toBe('wallet_credit');
    if (settlement.kind !== 'wallet_credit') return;
    expect(settlement.plan.movement.causativeKey).toBe(`stripe:checkout_session:${longId}`);
    expect(settlement.plan.movement.causativeKey).toHaveLength(240);
  });

  it('ignores unrelated event types', () => {
    expect(settle('payment_intent.succeeded', { id: 'pi_1', amount: 5000 })).toEqual({
      kind: 'ignored',
      eventType: 'payment_intent.succeeded',
      reason: 'unsupported_event_type',
    });
  });
});

describe('settleStripeWebhookEvent subscription updates', () => {
  it('plans subscription updates', () => {
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
