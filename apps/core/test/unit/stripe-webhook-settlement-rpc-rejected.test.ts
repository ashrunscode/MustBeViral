import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookSettlementPort,
  StripeWebhookSettlementForbiddenError,
  StripeWebhookSettlementRpcRejectedError,
  StripeWebhookSettlementUnavailableError,
} from '../../src/composition/stripe-webhook-settlement';

const bindings = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as never;

// Inputs carry every field the port has taken across versions; the port reads only the ones it
// knows, so these tests keep compiling and running as the input types grow.
const walletCreditInput = {
  workspaceId: '50000000-0000-4000-8000-000000000001',
  stripeCheckoutSessionId: 'cs_test_rejected',
  stripeEventId: 'evt_settlement_rejected',
  stripeCustomerId: 'cus_settlement_rejected',
  amountMicros: 50_000_000n,
  eventType: 'checkout.session.completed',
  requestId: 'req-settlement-rejected',
};

const subscriptionUpdateInput = {
  workspaceId: '50000000-0000-4000-8000-000000000001',
  stripeEventId: 'evt_settlement_rejected',
  stripeEventType: 'customer.subscription.updated',
  stripeEventCreated: 1_760_000_000,
  stripeCustomerId: 'cus_settlement_rejected',
  stripeSubscriptionId: 'sub_settlement_rejected',
  subscriptionStatus: 'active',
  setupFeePaid: false,
  requestId: 'req-settlement-rejected',
};

type SettlementPort = ReturnType<typeof createStripeWebhookSettlementPort>;

const operations: ReadonlyArray<readonly [string, (port: SettlementPort) => Promise<unknown>]> = [
  ['wallet credit', (port) => port.applyWalletCredit(walletCreditInput as never)],
  ['subscription update', (port) => port.applySubscriptionUpdate(subscriptionUpdateInput as never)],
];

function respondWithStatus(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () =>
    typeof body === 'string' ? new Response(body, { status }) : Response.json(body, { status }),
  );
}

function calledRpc(fetchMock: ReturnType<typeof respondWithStatus>): string {
  const [url] = fetchMock.mock.calls[0] ?? [];
  return String(url).replace('https://example.supabase.co/rest/v1/rpc/', '');
}

describe.each(operations)('stripe webhook settlement %s failures', (_operation, call) => {
  it.each([
    [
      'a workspace mismatch on replay',
      400,
      'P0001',
      'STRIPE_EVENT_WORKSPACE_MISMATCH',
      'STRIPE_EVENT_WORKSPACE_MISMATCH',
    ],
    [
      'an ambiguous shared customer',
      400,
      'P0001',
      'STRIPE_CUSTOMER_AMBIGUOUS',
      'STRIPE_CUSTOMER_AMBIGUOUS',
    ],
    ['invalid input', 400, '22023', 'request_id is required', undefined],
    [
      'a unique violation',
      409,
      '23505',
      'duplicate key value violates unique constraint',
      undefined,
    ],
    ['a request error', 400, 'PGRST100', 'failed to parse filter', undefined],
    ['an HTTP 422', 422, 'P0001', 'VALIDATION_FAILED', 'VALIDATION_FAILED'],
  ])(
    'reports %s as a permanent rejection, not an outage',
    async (_label, status, code, postgrestMessage, reason) => {
      const fetchMock = respondWithStatus(status, {
        code,
        message: postgrestMessage,
        details: 'Failing row contains (evt_settlement_rejected, cus_settlement_rejected).',
        hint: null,
      });
      const port = createStripeWebhookSettlementPort(bindings, fetchMock);

      const error = await call(port).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(StripeWebhookSettlementRpcRejectedError);
      expect(error).not.toBeInstanceOf(StripeWebhookSettlementUnavailableError);
      const rejected = error as StripeWebhookSettlementRpcRejectedError;
      expect(rejected.name).toBe('StripeWebhookSettlementRpcRejectedError');
      expect(rejected.rpc).toBe(calledRpc(fetchMock));
      expect(rejected.status).toBe(status);
      expect(rejected.code).toBe(code);
      expect(rejected.reason).toBe(reason);
      // The message is handed to exception telemetry, so it carries only the RPC name, status, code
      // and reason token, never PostgREST's message or details, which can echo row values.
      expect(rejected.message).toBe(
        `Stripe webhook settlement RPC ${rejected.rpc} rejected the event with HTTP ${status} (${code})${
          reason === undefined ? '' : `: ${reason}`
        }.`,
      );
      expect(rejected.message).not.toContain('evt_settlement_rejected');
      expect(rejected.message).not.toContain('cus_settlement_rejected');
      if (reason === undefined) expect(rejected.message).not.toContain(postgrestMessage);
    },
  );

  it.each([
    ['a retired RPC during a deploy', 400, { code: '0A000', message: 'apply_x is retired' }],
    ['a proxy error page without a code', 400, 'Bad Request'],
    ['a reason token without a code', 400, { message: 'STRIPE_CUSTOMER_AMBIGUOUS' }],
    ['a restricted project', 402, {}],
    ['a missing RPC after a deploy ahead of its migration', 404, { code: 'PGRST202' }],
    ['a read-only database with a nearly full disk', 405, { code: '25006' }],
    ['a request timeout', 408, {}],
    ['rate limiting', 429, {}],
    [
      'an unknown workspace that a later event may link',
      500,
      { code: 'P0002', message: 'WORKSPACE_NOT_FOUND' },
    ],
    ['a lock or statement timeout', 500, { code: '57014' }],
    ['too many connections', 503, { code: '53300' }],
    ['a serialization retry that timed out', 504, 'upstream timeout'],
  ])('keeps %s as unavailable', async (_label, status, body) => {
    const port = createStripeWebhookSettlementPort(bindings, respondWithStatus(status, body));

    const error = await call(port).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StripeWebhookSettlementUnavailableError);
    expect(error).not.toBeInstanceOf(StripeWebhookSettlementRpcRejectedError);
  });

  it.each([401, 403])('keeps HTTP %s as forbidden', async (status) => {
    const port = createStripeWebhookSettlementPort(
      bindings,
      respondWithStatus(status, { code: '42501', message: 'permission denied' }),
    );

    await expect(call(port)).rejects.toBeInstanceOf(StripeWebhookSettlementForbiddenError);
  });
});
