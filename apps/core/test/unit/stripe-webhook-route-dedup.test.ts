import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { createStripeWebhookRecordEvent } from '../../src/composition/stripe-webhook-dedup';
import { createStripeWebhookSettlementHandler } from '../../src/composition/stripe-webhook-settlement';

const WEBHOOK_SECRET = 'whsec_route_dedup';
const SUPABASE_URL = 'https://example.supabase.co';
const SUPABASE_SECRET_KEY = 'sb_secret_route_dedup';
const WORKSPACE_ID = '50000000-0000-4000-8000-000000000002';

const bindings = {
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
} as CoreBindings;

/** Named arguments of `apply_stripe_wallet_credit`; `p_metadata` has a default. */
const WALLET_CREDIT_ARGUMENTS = {
  required: [
    'p_amount_micros',
    'p_event_type',
    'p_request_id',
    'p_stripe_customer_id',
    'p_stripe_event_id',
    'p_workspace_id',
  ],
  optional: ['p_metadata'],
} as const;

/** Named arguments of `record_stripe_webhook_event`, none with a default. */
const RECEIPT_ARGUMENTS = {
  required: ['p_event_type', 'p_livemode', 'p_payload_hash', 'p_request_id', 'p_stripe_event_id'],
  optional: [],
} as const;

type RpcOutcome = 'credited' | 'replayed' | 'inserted' | 'duplicate' | `http_${number}`;

interface RpcCall {
  readonly rpc: string;
  readonly args: Readonly<Record<string, unknown>>;
  readonly outcome: RpcOutcome;
}

/** PostgREST resolves a function only when every required name is sent and no unknown name is. */
function matchesSignature(
  args: Readonly<Record<string, unknown>>,
  signature: Readonly<{ required: readonly string[]; optional: readonly string[] }>,
): boolean {
  const names = Object.keys(args);
  return (
    signature.required.every((name) => names.includes(name)) &&
    names.every((name) => signature.required.includes(name) || signature.optional.includes(name))
  );
}

/** Mirrors the functions' `length(trim(x)) = 0` guard, which trims spaces only. */
function isNonBlankText(value: unknown): value is string {
  return typeof value === 'string' && /[^ ]/u.test(value);
}

/**
 * Emulates PostgREST in front of the two RPCs a Stripe delivery reaches.
 *
 * - Any other `apikey` answers 401, as the Supabase gateway does.
 * - A body whose argument names do not match the function's signature answers 404 PGRST202.
 * - `apply_stripe_wallet_credit` rejects a blank event id, event type or request id, or a
 *   non-positive amount, with 22023 (as the deployed function does). It is idempotent on the Stripe
 *   event id: a replay reports `replayed` and credits nothing.
 * - `record_stripe_webhook_event` rejects a blank text argument or a null livemode with 22023 before
 *   claiming (migration 20260916157000), then inserts a receipt or reports a duplicate on
 *   `p_stripe_event_id`.
 * - `receiptOutages` answers HTTP 503 to that many receipt calls without writing anything.
 * - `lostReceiptResponses` commits that many receipts but answers HTTP 503, as when the response
 *   is lost after commit.
 */
function postgrest(
  options: Readonly<{ receiptOutages?: number; lostReceiptResponses?: number }> = {},
) {
  const walletCredits = new Map<string, bigint>();
  const receipts = new Map<string, Readonly<Record<string, unknown>>>();
  const calls: RpcCall[] = [];
  let receiptOutages = options.receiptOutages ?? 0;
  let lostReceiptResponses = options.lostReceiptResponses ?? 0;

  function answer(
    rpc: string,
    args: Readonly<Record<string, unknown>>,
    outcome: RpcOutcome,
    response: Response,
  ): Response {
    calls.push({ rpc, args, outcome });
    return response;
  }

  const notFound = () => Response.json({ code: 'PGRST202' }, { status: 404 });
  const invalid = () => Response.json({ code: '22023' }, { status: 400 });

  const fetchImplementation = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const prefix = `${SUPABASE_URL}/rest/v1/rpc/`;
    const rpc = url.startsWith(prefix) ? url.slice(prefix.length) : url;
    const args = JSON.parse(String(init?.body ?? '{}')) as Readonly<Record<string, unknown>>;

    if (new Headers(init?.headers).get('apikey') !== SUPABASE_SECRET_KEY) {
      return answer(
        rpc,
        args,
        'http_401',
        Response.json({ message: 'Invalid API key' }, { status: 401 }),
      );
    }

    if (rpc === 'apply_stripe_wallet_credit') {
      if (!matchesSignature(args, WALLET_CREDIT_ARGUMENTS)) {
        return answer(rpc, args, 'http_404', notFound());
      }
      if (
        !isNonBlankText(args.p_stripe_event_id) ||
        !isNonBlankText(args.p_event_type) ||
        !isNonBlankText(args.p_request_id) ||
        typeof args.p_amount_micros !== 'string' ||
        !/^[1-9][0-9]*$/u.test(args.p_amount_micros)
      ) {
        return answer(rpc, args, 'http_400', invalid());
      }
      const replayed = walletCredits.has(args.p_stripe_event_id);
      if (!replayed) walletCredits.set(args.p_stripe_event_id, BigInt(args.p_amount_micros));
      const balance = [...walletCredits.values()].reduce((sum, micros) => sum + micros, 0n);
      return answer(
        rpc,
        args,
        replayed ? 'replayed' : 'credited',
        Response.json({
          workspace_id: WORKSPACE_ID,
          transaction_id: '60000000-0000-4000-8000-000000000002',
          replayed,
          wallet_balance_micros: balance.toString(10),
        }),
      );
    }

    if (rpc === 'record_stripe_webhook_event') {
      if (receiptOutages > 0) {
        receiptOutages -= 1;
        return answer(rpc, args, 'http_503', new Response('upstream unavailable', { status: 503 }));
      }
      if (!matchesSignature(args, RECEIPT_ARGUMENTS)) {
        return answer(rpc, args, 'http_404', notFound());
      }
      if (
        !isNonBlankText(args.p_stripe_event_id) ||
        !isNonBlankText(args.p_event_type) ||
        typeof args.p_livemode !== 'boolean' ||
        !isNonBlankText(args.p_payload_hash) ||
        !isNonBlankText(args.p_request_id)
      ) {
        return answer(rpc, args, 'http_400', invalid());
      }
      const claim = receipts.has(args.p_stripe_event_id) ? 'duplicate' : 'inserted';
      if (claim === 'inserted') receipts.set(args.p_stripe_event_id, args);
      if (lostReceiptResponses > 0) {
        lostReceiptResponses -= 1;
        return answer(rpc, args, 'http_503', new Response('upstream unavailable', { status: 503 }));
      }
      return answer(rpc, args, claim, Response.json({ claim }));
    }

    return answer(rpc, args, 'http_404', notFound());
  });

  return {
    calls,
    fetchImplementation,
    receipts,
    walletCredits,
    outcomes: () => calls.map(({ rpc, outcome }) => `${rpc}:${outcome}`),
  };
}

/** Wires the same composition as the Worker entry, with PostgREST replaced by the emulation. */
function coreApp(database: ReturnType<typeof postgrest>) {
  return createCoreApp(undefined, {
    createStripeWebhookRecordEvent: (workerBindings, requestId) =>
      createStripeWebhookRecordEvent(workerBindings, requestId, database.fetchImplementation),
    createStripeWebhookSettleEvent: (workerBindings) =>
      createStripeWebhookSettlementHandler(workerBindings, database.fetchImplementation),
  });
}

/** A paid wallet top-up Checkout Session; each event gets its own session. */
function walletCreditEvent(eventId: string): string {
  return JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: `cs_test_${eventId}`,
        object: 'checkout.session',
        mode: 'payment',
        payment_status: 'paid',
        currency: 'usd',
        amount_total: 5000,
        customer: 'cus_route_dedup',
        client_reference_id: WORKSPACE_ID,
        metadata: { purpose: 'wallet_top_up', workspace_id: WORKSPACE_ID },
      },
    },
  });
}

async function deliver(
  app: ReturnType<typeof coreApp>,
  body: string,
  headers: Readonly<Record<string, string>> = {},
  workerBindings: CoreBindings = bindings,
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`)
    .digest('hex');
  return app.request(
    'http://localhost/webhooks/stripe',
    {
      method: 'POST',
      headers: { ...headers, 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body,
    },
    workerBindings,
  );
}

function requestFailedLog(errorName: string) {
  return expect.stringMatching(
    new RegExp(`"event":"core\\.request\\.failed".*"error_name":"${errorName}"`, 'u'),
  );
}

interface DeliveryPayload {
  readonly data?: Readonly<Record<string, unknown>>;
  readonly meta?: Readonly<{ request_id?: string }>;
}

describe('stripe webhook route through the real dedup and settlement ports', () => {
  it('answers 500 when the receipt write fails after settlement, and the retry replays settlement without a second credit', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = postgrest({ receiptOutages: 1 });
    const app = coreApp(database);
    const body = walletCreditEvent('evt_receipt_outage');

    const firstDelivery = await deliver(app, body);

    expect(firstDelivery.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      requestFailedLog('StripeWebhookDedupUnavailableError'),
    );
    // Settlement committed but the receipt did not, so Stripe's retry must not look like a duplicate.
    expect([...database.walletCredits]).toStrictEqual([['evt_receipt_outage', 50_000_000n]]);
    expect(database.receipts.size).toBe(0);

    const retry = await deliver(app, body);

    expect(retry.status).toBe(200);
    const payload = (await retry.json()) as DeliveryPayload;
    expect(payload.data).toMatchObject({
      acknowledged: true,
      event_type: 'checkout.session.completed',
      settlement_kind: 'wallet_credit',
      wallet_credit_micros: '50000000',
      persisted: true,
    });
    expect(payload.data).not.toHaveProperty('duplicate');
    expect([...database.walletCredits]).toStrictEqual([['evt_receipt_outage', 50_000_000n]]);
    expect([...database.receipts.keys()]).toStrictEqual(['evt_receipt_outage']);
    expect(database.receipts.get('evt_receipt_outage')?.p_payload_hash).toBe(
      createHash('sha256').update(body).digest('hex'),
    );
    expect(database.outcomes()).toStrictEqual([
      'apply_stripe_wallet_credit:credited',
      'record_stripe_webhook_event:http_503',
      'apply_stripe_wallet_credit:replayed',
      'record_stripe_webhook_event:inserted',
    ]);
  });

  it('answers 500 when the receipt commits but its response is lost, and the retry is a duplicate without a second credit', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = postgrest({ lostReceiptResponses: 1 });
    const app = coreApp(database);
    const body = walletCreditEvent('evt_receipt_response_lost');

    const firstDelivery = await deliver(app, body);

    expect(firstDelivery.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      requestFailedLog('StripeWebhookDedupUnavailableError'),
    );

    const retry = await deliver(app, body);

    expect(retry.status).toBe(200);
    expect(((await retry.json()) as DeliveryPayload).data).toStrictEqual({
      duplicate: true,
      acknowledged: true,
    });
    expect([...database.walletCredits]).toStrictEqual([['evt_receipt_response_lost', 50_000_000n]]);
    expect([...database.receipts.keys()]).toStrictEqual(['evt_receipt_response_lost']);
    expect(database.outcomes()).toStrictEqual([
      'apply_stripe_wallet_credit:credited',
      'record_stripe_webhook_event:http_503',
      'apply_stripe_wallet_credit:replayed',
      'record_stripe_webhook_event:duplicate',
    ]);
  });

  it('acknowledges a redelivery after a successful delivery as a duplicate without crediting again', async () => {
    const database = postgrest();
    const app = coreApp(database);
    const body = walletCreditEvent('evt_redelivered');

    const delivery = await deliver(app, body);
    expect(delivery.status).toBe(200);
    expect(((await delivery.json()) as DeliveryPayload).data).toMatchObject({
      acknowledged: true,
      persisted: true,
    });

    const redelivery = await deliver(app, body);

    expect(redelivery.status).toBe(200);
    expect(((await redelivery.json()) as DeliveryPayload).data).toStrictEqual({
      duplicate: true,
      acknowledged: true,
    });
    expect([...database.walletCredits]).toStrictEqual([['evt_redelivered', 50_000_000n]]);
    expect([...database.receipts.keys()]).toStrictEqual(['evt_redelivered']);
    expect(database.outcomes()).toStrictEqual([
      'apply_stripe_wallet_credit:credited',
      'record_stripe_webhook_event:inserted',
      'apply_stripe_wallet_credit:replayed',
      'record_stripe_webhook_event:duplicate',
    ]);
  });

  it('answers 500 without a credit or a receipt when the privileged key is rejected', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = postgrest();
    const app = coreApp(database);

    const response = await deliver(app, walletCreditEvent('evt_rejected_key'), {}, {
      ...bindings,
      SUPABASE_SECRET_KEY: 'sb_secret_rotated_away',
    } as CoreBindings);

    expect(response.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(
      requestFailedLog('StripeWebhookSettlementForbiddenError'),
    );
    expect(database.walletCredits.size).toBe(0);
    expect(database.receipts.size).toBe(0);
    expect(database.outcomes()).toStrictEqual(['apply_stripe_wallet_credit:http_401']);
  });

  const GENERATED_REQUEST_ID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

  it.each([
    {
      label: 'caller header',
      headers: { 'x-request-id': 'req_stripe-route.dedup:0001' },
      expected: 'req_stripe-route.dedup:0001',
    },
    { label: 'generated, header absent', headers: {}, expected: GENERATED_REQUEST_ID },
    {
      label: 'generated, header unsafe',
      headers: { 'x-request-id': 'bad id' },
      expected: GENERATED_REQUEST_ID,
    },
  ])('sends the middleware request id as p_request_id ($label)', async ({ headers, expected }) => {
    const database = postgrest();
    const app = coreApp(database);
    const body = walletCreditEvent('evt_request_id');

    const response = await deliver(app, body, headers);

    expect(response.status).toBe(200);
    const requestId = response.headers.get('x-request-id') ?? '';
    expect(requestId).toEqual(
      typeof expected === 'string' ? expected : expect.stringMatching(expected),
    );
    expect(((await response.json()) as DeliveryPayload).meta?.request_id).toBe(requestId);

    const receiptCalls = database.calls.filter(
      (call) => call.rpc === 'record_stripe_webhook_event',
    );
    expect(receiptCalls).toHaveLength(1);
    expect(receiptCalls[0]?.args).toStrictEqual({
      p_stripe_event_id: 'evt_request_id',
      p_event_type: 'checkout.session.completed',
      p_livemode: false,
      p_payload_hash: createHash('sha256').update(body).digest('hex'),
      p_request_id: requestId,
    });
    // Settlement receives the same id as the receipt and the response header.
    expect(
      database.calls
        .filter((call) => call.rpc === 'apply_stripe_wallet_credit')
        .map((call) => call.args.p_request_id),
    ).toStrictEqual([requestId]);
  });
});
