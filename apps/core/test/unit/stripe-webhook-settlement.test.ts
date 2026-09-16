import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookSettlementHandler,
  createStripeWebhookSettlementPort,
  StripeWebhookSettlementForbiddenError,
} from '../../src/composition/stripe-webhook-settlement';

describe('stripe webhook settlement port', () => {
  it('persists wallet credit through the privileged RPC', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json(
        {
          workspace_id: '50000000-0000-4000-8000-000000000001',
          transaction_id: '60000000-0000-4000-8000-000000000001',
          replayed: false,
          wallet_balance_micros: 50000000,
        },
        { status: 200 },
      ),
    );
    const port = createStripeWebhookSettlementPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      } as never,
      fetchMock,
    );

    await expect(
      port.applyWalletCredit({
        workspaceId: '50000000-0000-4000-8000-000000000001',
        stripeEventId: 'evt_wallet_credit_1',
        stripeCustomerId: 'cus_wallet_1',
        amountMicros: 50_000_000n,
        eventType: 'checkout.session.completed',
        requestId: 'req-wallet-credit-1',
      }),
    ).resolves.toMatchObject({
      workspaceId: '50000000-0000-4000-8000-000000000001',
      replayed: false,
      walletBalanceMicros: 50_000_000n,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
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
        workspaceId: '50000000-0000-4000-8000-000000000001',
        stripeEventId: 'evt_forbidden',
        stripeCustomerId: null,
        amountMicros: 1n,
        eventType: 'invoice.paid',
        requestId: 'req-forbidden',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookSettlementForbiddenError);
  });
});

describe('stripe webhook settlement handler', () => {
  it('persists wallet credit and skips email without operator address', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/rpc/apply_stripe_wallet_credit')) {
        return Response.json(
          {
            workspace_id: '50000000-0000-4000-8000-000000000001',
            transaction_id: '60000000-0000-4000-8000-000000000001',
            replayed: false,
            wallet_balance_micros: 50000000,
          },
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    const handler = createStripeWebhookSettlementHandler(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      } as never,
      fetchMock,
    );

    const result = await handler({
      verified: {
        eventId: 'evt_wallet_credit_1',
        eventType: 'checkout.session.completed',
        livemode: false,
        payload: {
          data: {
            object: {
              amount_total: 5000,
              customer: 'cus_wallet_1',
              metadata: { workspace_id: '50000000-0000-4000-8000-000000000001' },
            },
          },
        },
      },
      requestId: 'req-wallet-credit-1',
    });

    expect(result.persisted).toBe(true);
    expect(result.settlement.kind).toBe('wallet_credit');
    expect(result.emailStatus).toBe('not_requested');
    expect(fetchMock).toHaveBeenCalledOnce();
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
        if (url.endsWith('/rpc/apply_stripe_wallet_credit')) {
          return Response.json({
            workspace_id: '50000000-0000-4000-8000-000000000001',
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
        verified: {
          eventId: 'evt_wallet_credit_email',
          eventType: 'invoice.paid',
          livemode: false,
          payload: {
            data: {
              object: {
                amount_paid: 5000,
                metadata: { workspace_id: '50000000-0000-4000-8000-000000000001' },
              },
            },
          },
        },
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
