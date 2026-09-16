import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookSettlementHandler,
  createStripeWebhookSettlementPort,
  StripeWebhookSettlementForbiddenError,
  StripeWebhookSettlementInvalidEventError,
  StripeWebhookSettlementRejectedError,
  StripeWebhookSettlementUnavailableError,
} from '../../src/composition/stripe-webhook-settlement';

const WORKSPACE_ID = '50000000-0000-4000-8000-000000000001';

const settlementBindings = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as never;

/** A paid wallet top-up Checkout Session as our server creates it (ADR-0007). */
function topUpEvent(
  eventId: string,
  eventType = 'checkout.session.completed',
  sessionOverrides: Readonly<Record<string, unknown>> = {},
) {
  return {
    eventId,
    eventType,
    livemode: false,
    payload: {
      id: eventId,
      type: eventType,
      data: {
        object: {
          id: 'cs_test_wallet_1',
          object: 'checkout.session',
          mode: 'payment',
          payment_status: 'paid',
          currency: 'usd',
          amount_total: 5000,
          customer: 'cus_wallet_1',
          client_reference_id: WORKSPACE_ID,
          metadata: { purpose: 'wallet_top_up', workspace_id: WORKSPACE_ID },
          ...sessionOverrides,
        },
      },
    },
  };
}

/**
 * Stands in for PostgREST plus `apply_stripe_wallet_top_up`, keyed on the Checkout Session id the
 * way the real function is (pgTAP proves the function itself).
 */
function sessionKeyedWalletDatabase() {
  const credited = new Map<string, bigint>();
  const bodies: Array<Record<string, unknown>> = [];
  const fetchImplementation = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/rpc/apply_stripe_wallet_top_up')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      bodies.push(body);
      const sessionId = String(body.p_stripe_checkout_session_id);
      const replayed = credited.has(sessionId);
      if (!replayed) credited.set(sessionId, BigInt(String(body.p_amount_micros)));
      return Response.json({
        workspace_id: body.p_workspace_id,
        transaction_id: '60000000-0000-4000-8000-000000000001',
        replayed,
        wallet_balance_micros: [...credited.values()]
          .reduce((sum, micros) => sum + micros, 0n)
          .toString(),
      });
    }
    if (url === 'https://api.resend.com/emails') {
      return Response.json({ id: 'email_1' });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return { credited, bodies, fetchImplementation };
}

describe('stripe webhook settlement port', () => {
  it('persists wallet credit through the privileged RPC keyed on the Checkout Session', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json(
        {
          workspace_id: WORKSPACE_ID,
          transaction_id: '60000000-0000-4000-8000-000000000001',
          replayed: false,
          wallet_balance_micros: 50000000,
        },
        { status: 200 },
      ),
    );
    const port = createStripeWebhookSettlementPort(settlementBindings, fetchMock);

    await expect(
      port.applyWalletCredit({
        workspaceId: WORKSPACE_ID,
        stripeCheckoutSessionId: 'cs_test_wallet_1',
        stripeEventId: 'evt_wallet_credit_1',
        stripeCustomerId: 'cus_wallet_1',
        amountMicros: 50_000_000n,
        eventType: 'checkout.session.completed',
        requestId: 'req-wallet-credit-1',
      }),
    ).resolves.toMatchObject({
      workspaceId: WORKSPACE_ID,
      replayed: false,
      walletBalanceMicros: 50_000_000n,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toStrictEqual({
      p_workspace_id: WORKSPACE_ID,
      p_stripe_checkout_session_id: 'cs_test_wallet_1',
      p_stripe_event_id: 'evt_wallet_credit_1',
      p_stripe_customer_id: 'cus_wallet_1',
      p_amount_micros: '50000000',
      p_event_type: 'checkout.session.completed',
      p_request_id: 'req-wallet-credit-1',
      p_metadata: {},
    });
  });

  it('rejects forbidden privileged credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 403 }));
    const port = createStripeWebhookSettlementPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'bad',
      } as never,
      fetchMock,
    );
    await expect(
      port.applyWalletCredit({
        workspaceId: WORKSPACE_ID,
        stripeCheckoutSessionId: 'cs_test_forbidden',
        stripeEventId: 'evt_forbidden',
        stripeCustomerId: null,
        amountMicros: 1n,
        eventType: 'checkout.session.completed',
        requestId: 'req-forbidden',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookSettlementForbiddenError);
  });
});

// apply_stripe_subscription_update orders events by lifecycle stage and the Stripe event `created`
// second, so every subscription settlement must send both.
describe('stripe webhook subscription settlement ordering', () => {
  const bindings = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'sb_secret_test',
  } as never;

  function subscriptionRpcMock(response: Readonly<Record<string, unknown>>) {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void init;
      const url = String(input);
      if (url.endsWith('/rpc/apply_stripe_subscription_update')) {
        return Response.json(response);
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
  }

  function sentBody(fetchMock: ReturnType<typeof subscriptionRpcMock>): unknown {
    const init = fetchMock.mock.calls[0]?.[1];
    return JSON.parse(String(init?.body));
  }

  it('sends the event type and created time to the subscription RPC', async () => {
    const fetchMock = subscriptionRpcMock({
      workspace_id: '50000000-0000-4000-8000-000000000001',
      replayed: false,
      stale: false,
      subscription_status: 'active',
      setup_fee_paid: false,
    });
    const port = createStripeWebhookSettlementPort(bindings, fetchMock);

    await expect(
      port.applySubscriptionUpdate({
        workspaceId: null,
        stripeEventId: 'evt_sub_updated_1',
        stripeEventType: 'customer.subscription.updated',
        stripeEventCreated: 1_789_560_000,
        stripeCustomerId: 'cus_sub_1',
        stripeSubscriptionId: 'sub_1',
        subscriptionStatus: 'active',
        setupFeePaid: false,
        requestId: 'req-sub-updated-1',
      }),
    ).resolves.toEqual({
      workspaceId: '50000000-0000-4000-8000-000000000001',
      replayed: false,
      stale: false,
      subscriptionStatus: 'active',
      setupFeePaid: false,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(sentBody(fetchMock)).toEqual({
      p_workspace_id: null,
      p_stripe_event_id: 'evt_sub_updated_1',
      p_stripe_customer_id: 'cus_sub_1',
      p_stripe_subscription_id: 'sub_1',
      p_subscription_status: 'active',
      p_setup_fee_paid: false,
      p_request_id: 'req-sub-updated-1',
      p_stripe_event_type: 'customer.subscription.updated',
      p_stripe_event_created: 1_789_560_000,
    });
  });

  // Only the ordered overload returns `stale`; the transitional seven-argument function does not.
  it('rejects a subscription response without the stale flag', async () => {
    const fetchMock = subscriptionRpcMock({
      workspace_id: '50000000-0000-4000-8000-000000000001',
      replayed: false,
      subscription_status: 'active',
      setup_fee_paid: false,
    });
    const port = createStripeWebhookSettlementPort(bindings, fetchMock);

    await expect(
      port.applySubscriptionUpdate({
        workspaceId: null,
        stripeEventId: 'evt_sub_unordered_shape',
        stripeEventType: 'customer.subscription.updated',
        stripeEventCreated: 1_789_560_000,
        stripeCustomerId: 'cus_sub_1',
        stripeSubscriptionId: 'sub_1',
        subscriptionStatus: 'active',
        setupFeePaid: false,
        requestId: 'req-sub-unordered-shape',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookSettlementUnavailableError);
  });

  it.each([
    ['customer.subscription.created', 'incomplete', 'past_due'],
    ['customer.subscription.updated', 'active', 'active'],
    ['customer.subscription.deleted', 'active', 'canceled'],
  ] as const)(
    'settles %s with the payload created time',
    async (eventType, stripeStatus, expectedStatus) => {
      const fetchMock = subscriptionRpcMock({
        workspace_id: '50000000-0000-4000-8000-000000000001',
        replayed: false,
        stale: false,
        subscription_status: expectedStatus,
        setup_fee_paid: false,
      });
      const handler = createStripeWebhookSettlementHandler(bindings, fetchMock);

      const result = await handler({
        verified: {
          eventId: 'evt_sub_ordering',
          eventType,
          livemode: false,
          payload: {
            id: 'evt_sub_ordering',
            type: eventType,
            created: 1_789_560_042,
            data: {
              object: {
                id: 'sub_ordering',
                customer: 'cus_ordering',
                status: stripeStatus,
                metadata: { workspace_id: '50000000-0000-4000-8000-000000000001' },
              },
            },
          },
        },
        requestId: 'req-sub-ordering',
      });

      expect(result.persisted).toBe(true);
      expect(result.settlement.kind).toBe('subscription_update');
      expect(sentBody(fetchMock)).toMatchObject({
        p_workspace_id: '50000000-0000-4000-8000-000000000001',
        p_stripe_event_id: 'evt_sub_ordering',
        p_stripe_subscription_id: 'sub_ordering',
        p_subscription_status: expectedStatus,
        p_stripe_event_type: eventType,
        p_stripe_event_created: 1_789_560_042,
      });
    },
  );

  // A stale event is still settled: the database audits it and leaves the newer state in place, so
  // Core acknowledges it like any other settlement.
  it('accepts a stale settlement reporting the newer subscription status', async () => {
    const fetchMock = subscriptionRpcMock({
      workspace_id: '50000000-0000-4000-8000-000000000001',
      replayed: false,
      stale: true,
      subscription_status: 'active',
      setup_fee_paid: false,
    });
    const handler = createStripeWebhookSettlementHandler(bindings, fetchMock);

    const result = await handler({
      verified: {
        eventId: 'evt_sub_late_created',
        eventType: 'customer.subscription.created',
        livemode: false,
        payload: {
          created: 1_789_560_000,
          data: { object: { id: 'sub_late', customer: 'cus_late', status: 'incomplete' } },
        },
      },
      requestId: 'req-sub-late-created',
    });

    expect(result.persisted).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['missing', undefined],
    ['a string', '1789560000'],
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1_789_560_000.5],
    ['beyond safe integers', Number.MAX_SAFE_INTEGER + 1],
  ] as const)(
    'rejects a subscription event whose created time is %s without calling the RPC',
    async (_label, created) => {
      const fetchMock = subscriptionRpcMock({});
      const handler = createStripeWebhookSettlementHandler(bindings, fetchMock);

      await expect(
        handler({
          verified: {
            eventId: 'evt_sub_bad_created',
            eventType: 'customer.subscription.updated',
            livemode: false,
            payload: {
              ...(created === undefined ? {} : { created }),
              data: { object: { id: 'sub_bad', customer: 'cus_bad', status: 'active' } },
            },
          },
          requestId: 'req-sub-bad-created',
        }),
      ).rejects.toBeInstanceOf(StripeWebhookSettlementInvalidEventError);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it('rejects a subscription event without a subscription id without calling the RPC', async () => {
    const fetchMock = subscriptionRpcMock({});
    const handler = createStripeWebhookSettlementHandler(bindings, fetchMock);

    await expect(
      handler({
        verified: {
          eventId: 'evt_sub_no_id',
          eventType: 'customer.subscription.updated',
          livemode: false,
          payload: {
            created: 1_789_560_000,
            data: { object: { customer: 'cus_no_id', status: 'active' } },
          },
        },
        requestId: 'req-sub-no-id',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookSettlementInvalidEventError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('stripe webhook settlement handler', () => {
  it('persists a paid wallet top-up and skips email without operator address', async () => {
    const database = sessionKeyedWalletDatabase();
    const handler = createStripeWebhookSettlementHandler(
      settlementBindings,
      database.fetchImplementation,
    );

    const result = await handler({
      verified: topUpEvent('evt_wallet_credit_1'),
      requestId: 'req-wallet-credit-1',
    });

    expect(result.persisted).toBe(true);
    expect(result.settlement.kind).toBe('wallet_credit');
    expect(result.emailStatus).toBe('not_requested');
    expect(database.bodies).toHaveLength(1);
    expect(database.bodies[0]).toMatchObject({
      p_workspace_id: WORKSPACE_ID,
      p_stripe_checkout_session_id: 'cs_test_wallet_1',
      p_stripe_event_id: 'evt_wallet_credit_1',
      p_stripe_customer_id: 'cus_wallet_1',
      p_amount_micros: '50000000',
      p_metadata: {
        source: 'stripe_webhook',
        event_type: 'checkout.session.completed',
        stripe_event_id: 'evt_wallet_credit_1',
        stripe_checkout_session_id: 'cs_test_wallet_1',
      },
    });
  });

  // Issue #20: one subscription-mode Checkout payment emits checkout.session.completed and
  // invoice.paid for its first invoice. Neither may fund the wallet.
  it('credits nothing for a subscription-mode Checkout payment and its first invoice', async () => {
    const database = sessionKeyedWalletDatabase();
    const handler = createStripeWebhookSettlementHandler(
      settlementBindings,
      database.fetchImplementation,
    );

    const checkout = await handler({
      verified: topUpEvent('evt_subscription_checkout', 'checkout.session.completed', {
        id: 'cs_test_subscription',
        mode: 'subscription',
        amount_total: 64_900,
        subscription: 'sub_1',
        invoice: 'in_first',
        metadata: { workspace_id: WORKSPACE_ID },
      }),
      requestId: 'req-subscription-checkout',
    });
    const invoice = await handler({
      verified: {
        eventId: 'evt_first_invoice_paid',
        eventType: 'invoice.paid',
        livemode: false,
        payload: {
          data: {
            object: {
              id: 'in_first',
              object: 'invoice',
              billing_reason: 'subscription_create',
              amount_paid: 64_900,
              currency: 'usd',
              customer: 'cus_wallet_1',
              metadata: {},
            },
          },
        },
      },
      requestId: 'req-first-invoice-paid',
    });

    expect(checkout).toMatchObject({ persisted: false, settlement: { kind: 'ignored' } });
    expect(invoice).toMatchObject({ persisted: false, settlement: { kind: 'ignored' } });
    expect(database.fetchImplementation).not.toHaveBeenCalled();
  });

  it('credits a delayed top-up once across completed, async success and redelivery', async () => {
    const database = sessionKeyedWalletDatabase();
    const handler = createStripeWebhookSettlementHandler(
      {
        ...(settlementBindings as object),
        RESEND_API_KEY: 're_test',
        RESEND_FROM_ADDRESS: 'billing@example.test',
      } as never,
      database.fetchImplementation,
    );

    const pending = await handler({
      verified: topUpEvent('evt_topup_pending', 'checkout.session.completed', {
        payment_status: 'unpaid',
      }),
      requestId: 'req-topup-pending',
      operatorEmail: 'operator@example.test',
    });
    const succeeded = await handler({
      verified: topUpEvent('evt_topup_async', 'checkout.session.async_payment_succeeded'),
      requestId: 'req-topup-async',
      operatorEmail: 'operator@example.test',
    });
    const separateEventObject = await handler({
      verified: topUpEvent('evt_topup_async_duplicate', 'checkout.session.async_payment_succeeded'),
      requestId: 'req-topup-async-duplicate',
      operatorEmail: 'operator@example.test',
    });

    expect(pending).toMatchObject({ persisted: false, settlement: { kind: 'ignored' } });
    expect(succeeded).toMatchObject({ persisted: true, emailStatus: 'sent' });
    expect(separateEventObject).toMatchObject({ persisted: true, emailStatus: 'not_requested' });
    expect([...database.credited.entries()]).toStrictEqual([['cs_test_wallet_1', 50_000_000n]]);
    expect(
      database.fetchImplementation.mock.calls.filter(
        ([input]) => String(input) === 'https://api.resend.com/emails',
      ),
    ).toHaveLength(1);
  });

  it('fails and logs the reason without persisting when a paid top-up cannot be credited', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = sessionKeyedWalletDatabase();
    const handler = createStripeWebhookSettlementHandler(
      settlementBindings,
      database.fetchImplementation,
    );

    await expect(
      handler({
        verified: topUpEvent('evt_topup_eur', 'checkout.session.completed', { currency: 'eur' }),
        requestId: 'req-topup-eur',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookSettlementRejectedError);
    await expect(
      handler({
        verified: topUpEvent('evt_topup_no_workspace', 'checkout.session.completed', {
          client_reference_id: null,
          metadata: { purpose: 'wallet_top_up' },
        }),
        requestId: 'req-topup-no-workspace',
      }),
    ).rejects.toThrow(/missing_workspace_id/u);
    expect(database.fetchImplementation).not.toHaveBeenCalled();

    // A rejected delivery writes no receipt and fails on every Stripe retry, so the log line is
    // how an operator finds the payment and its reason.
    const logged = consoleError.mock.calls.map(([line]) => JSON.parse(String(line)) as unknown);
    expect(logged).toStrictEqual([
      {
        level: 'error',
        event: 'core.stripe_webhook.wallet_top_up_rejected',
        request_id: 'req-topup-eur',
        stripe_event_id: 'evt_topup_eur',
        stripe_event_type: 'checkout.session.completed',
        reason: 'unsupported_currency',
      },
      {
        level: 'error',
        event: 'core.stripe_webhook.wallet_top_up_rejected',
        request_id: 'req-topup-no-workspace',
        stripe_event_id: 'evt_topup_no_workspace',
        stripe_event_type: 'checkout.session.completed',
        reason: 'missing_workspace_id',
      },
    ]);
  });

  // The route settles before recording the receipt, so Stripe retries and redeliveries replay
  // settlement. Only the delivery that actually credited the wallet may notify the operator.
  it.each([
    [false, 'sent', 1],
    [true, 'not_requested', 0],
  ] as const)(
    'with replayed=%s reports email %s and sends %i operator emails',
    async (replayed, expectedEmailStatus, expectedEmails) => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/rpc/apply_stripe_wallet_top_up')) {
          return Response.json({
            workspace_id: WORKSPACE_ID,
            transaction_id: '60000000-0000-4000-8000-000000000001',
            replayed,
            wallet_balance_micros: 50000000,
          });
        }
        if (url === 'https://api.resend.com/emails') {
          return Response.json({ id: 'email_1' });
        }
        throw new Error(`unexpected fetch: ${url}`);
      });
      const handler = createStripeWebhookSettlementHandler(
        {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SECRET_KEY: 'sb_secret_test',
          RESEND_API_KEY: 're_test',
          RESEND_FROM_ADDRESS: 'billing@example.test',
        } as never,
        fetchMock,
      );

      const result = await handler({
        verified: topUpEvent('evt_wallet_credit_email'),
        requestId: 'req-wallet-credit-email',
        operatorEmail: 'operator@example.test',
      });

      expect(result.persisted).toBe(true);
      expect(result.emailStatus).toBe(expectedEmailStatus);
      expect(
        fetchMock.mock.calls.filter(([input]) => String(input) === 'https://api.resend.com/emails'),
      ).toHaveLength(expectedEmails);
    },
  );
});
