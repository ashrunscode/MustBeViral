import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { settleStripeWebhookEvent } from '@mustbeviral/billing';

import { createStripeWebhookSettlementHandler } from '../../src/composition/stripe-webhook-settlement';
import {
  createStripeWebhookRoute,
  resolveStripeWebhookDependencies,
  type StripeWebhookDependencies,
} from '../../src/routes/stripe-webhook';

const emptyBindings = {} as CoreBindings;

const WORKSPACE_ID = '50000000-0000-4000-8000-000000000001';

const settlementBindings = {
  STRIPE_WEBHOOK_SECRET: 'whsec_ordering',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as CoreBindings;

function signedDelivery(secret: string, body: string): RequestInit {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body,
  };
}

/**
 * Stands in for PostgREST plus `apply_stripe_wallet_credit`: keyed on the Stripe event id, so a
 * replay reports `replayed` without crediting again (pgTAP proves the real function does this).
 * `failuresBeforeSuccess` answers HTTP 503 first, the way an unavailable database would.
 */
function walletCreditDatabase(failuresBeforeSuccess: number) {
  const credited = new Map<string, number>();
  let remainingFailures = failuresBeforeSuccess;
  const fetchImplementation = vi.fn<typeof fetch>(async (input, init) => {
    expect(String(input)).toBe(
      'https://example.supabase.co/rest/v1/rpc/apply_stripe_wallet_credit',
    );
    if (remainingFailures > 0) {
      remainingFailures -= 1;
      return new Response('unavailable', { status: 503 });
    }
    const body = JSON.parse(String(init?.body)) as { p_stripe_event_id: string };
    const replayed = credited.has(body.p_stripe_event_id);
    if (!replayed) credited.set(body.p_stripe_event_id, 50_000_000);
    return Response.json({
      workspace_id: WORKSPACE_ID,
      transaction_id: '60000000-0000-4000-8000-000000000001',
      replayed,
      wallet_balance_micros: [...credited.values()].reduce((sum, micros) => sum + micros, 0),
    });
  });
  return { credited, fetchImplementation };
}

/** A settlement port that plans without persisting, for route tests that only need wiring. */
const plannedSettlementOnly: NonNullable<StripeWebhookDependencies['settleEvent']> = async ({
  verified,
  requestId,
}) => ({
  settlement: settleStripeWebhookEvent({ verified, requestId }),
  emailStatus: 'not_requested',
  persisted: false,
});

/** Mirrors `record_stripe_webhook_event`: insert, or report a duplicate on conflict. */
function insertOrConflictReceipts(existing: readonly string[] = []) {
  const receipts = new Set<string>(existing);
  const recordEvent = vi.fn(async (event: Readonly<{ eventId: string }>) => {
    if (receipts.has(event.eventId)) return false;
    receipts.add(event.eventId);
    return true;
  });
  return { receipts, recordEvent };
}

function walletCreditEvent(eventId: string): string {
  return JSON.stringify({
    id: eventId,
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        amount_total: 5000,
        customer: 'cus_ordering',
        metadata: { workspace_id: WORKSPACE_ID },
      },
    },
  });
}

describe('stripe webhook route', () => {
  it('mounts on Core and fails closed without a configured secret', async () => {
    const app = createCoreApp();
    const response = await app.request('http://localhost/webhooks/stripe', {
      method: 'POST',
      body: '{}',
    });
    expect(response.status).toBe(503);
  });

  it('resolves secrets from Worker bindings', () => {
    expect(
      resolveStripeWebhookDependencies({ STRIPE_WEBHOOK_SECRET: 'whsec_test' } as CoreBindings)
        .webhookSecret,
    ).toBe('whsec_test');
    expect(resolveStripeWebhookDependencies(emptyBindings).webhookSecret).toBeUndefined();
  });
});

describe('stripe webhook settlement ordering', () => {
  function orderingApp(
    database: ReturnType<typeof walletCreditDatabase>,
    receipts: ReturnType<typeof insertOrConflictReceipts>,
  ) {
    return createCoreApp(undefined, {
      createStripeWebhookRecordEvent: () => receipts.recordEvent,
      createStripeWebhookSettleEvent: (bindings) =>
        createStripeWebhookSettlementHandler(bindings, database.fetchImplementation),
    });
  }

  it('settles an event exactly once when the first settlement fails and Stripe retries', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const database = walletCreditDatabase(1);
    const receipts = insertOrConflictReceipts();
    const app = orderingApp(database, receipts);
    const body = walletCreditEvent('evt_settle_after_failure');

    const firstDelivery = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery('whsec_ordering', body),
      settlementBindings,
    );
    expect(firstDelivery.status).toBe(500);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('core.request.failed'));
    // Nothing may mark the event handled while its settlement has not committed.
    expect(receipts.receipts.has('evt_settle_after_failure')).toBe(false);
    expect(database.credited.size).toBe(0);

    const retry = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery('whsec_ordering', body),
      settlementBindings,
    );
    expect(retry.status).toBe(200);
    const retryPayload = (await retry.json()) as {
      data?: { duplicate?: boolean; persisted?: boolean; settlement_kind?: string };
    };
    expect(retryPayload.data?.duplicate).toBeUndefined();
    expect(retryPayload.data?.persisted).toBe(true);
    expect(retryPayload.data?.settlement_kind).toBe('wallet_credit');

    expect([...database.credited.entries()]).toStrictEqual([
      ['evt_settle_after_failure', 50_000_000],
    ]);
    expect(database.fetchImplementation).toHaveBeenCalledTimes(2);
    expect(receipts.recordEvent).toHaveBeenCalledOnce();
    expect(receipts.receipts.has('evt_settle_after_failure')).toBe(true);
  });

  it('still settles a redelivered event whose receipt already exists', async () => {
    const database = walletCreditDatabase(0);
    // A receipt without settlement is what the previous claim-first ordering could leave behind.
    const receipts = insertOrConflictReceipts(['evt_receipt_without_settlement']);
    const app = orderingApp(database, receipts);

    const redelivery = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery('whsec_ordering', walletCreditEvent('evt_receipt_without_settlement')),
      settlementBindings,
    );

    expect(redelivery.status).toBe(200);
    const payload = (await redelivery.json()) as {
      data?: { duplicate?: boolean; acknowledged?: boolean };
    };
    expect(payload.data).toMatchObject({ duplicate: true, acknowledged: true });
    expect([...database.credited.keys()]).toStrictEqual(['evt_receipt_without_settlement']);
  });

  it('fails closed without writing a receipt when settlement is not wired', async () => {
    const receipts = insertOrConflictReceipts();
    const app = createCoreApp(undefined, {
      createStripeWebhookRecordEvent: () => receipts.recordEvent,
    });

    const response = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery('whsec_ordering', walletCreditEvent('evt_receipt_without_settle_port')),
      settlementBindings,
    );

    // A receipt written without settlement would make every Stripe retry a silent duplicate.
    expect(response.status).toBe(503);
    expect(receipts.recordEvent).not.toHaveBeenCalled();
  });
});

describe('standalone stripe webhook route', () => {
  it('acknowledges a verified test event once', async () => {
    const secret = 'whsec_unit';
    const recordEvent = vi.fn(async () => true);
    const route = createStripeWebhookRoute(() => ({
      webhookSecret: secret,
      recordEvent,
      settleEvent: plannedSettlementOnly,
    }));
    const body = JSON.stringify({
      id: 'evt_test',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: { amount_total: 5000 } },
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const response = await route.request('http://localhost/', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body,
    });
    expect(response.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledOnce();
    const payload = (await response.json()) as { data?: { wallet_credit_micros?: string } };
    expect(payload.data?.wallet_credit_micros).toBe('50000000');
  });

  it('acknowledges a verified event whose receipt already exists as a duplicate', async () => {
    const secret = 'whsec_unit';
    const recordEvent = vi.fn(async () => false);
    const route = createStripeWebhookRoute(() => ({
      webhookSecret: secret,
      recordEvent,
      settleEvent: plannedSettlementOnly,
    }));
    const body = JSON.stringify({ id: 'evt_dup', type: 'invoice.paid', livemode: false });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const response = await route.request('http://localhost/', {
      method: 'POST',
      headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
      body,
    });
    expect(response.status).toBe(200);
    expect(recordEvent).toHaveBeenCalledOnce();
  });
});
