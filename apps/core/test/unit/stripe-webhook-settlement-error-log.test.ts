import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { createStripeWebhookSettlementHandler } from '../../src/composition/stripe-webhook-settlement';

const secret = 'whsec_settlement_error_log';

const bindings = {
  STRIPE_WEBHOOK_SECRET: secret,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as CoreBindings;

function signedDelivery(body: string): RequestInit {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return {
    method: 'POST',
    headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` },
    body,
  };
}

// A subscription update carries everything any version of the settlement path requires (the event
// created time and subscription id), so the delivery always reaches the settlement RPC.
function subscriptionUpdatedEvent(eventId: string): string {
  return JSON.stringify({
    id: eventId,
    type: 'customer.subscription.updated',
    created: 1_760_000_000,
    livemode: false,
    data: {
      object: {
        id: 'sub_settlement_error_log',
        customer: 'cus_settlement_error_log',
        status: 'active',
        metadata: { workspace_id: '50000000-0000-4000-8000-000000000001' },
      },
    },
  });
}

function appWithSettlementResponse(settlementResponse: () => Response) {
  const recordEvent = vi.fn(async () => true);
  const app = createCoreApp(undefined, {
    createStripeWebhookRecordEvent: () => recordEvent,
    createStripeWebhookSettleEvent: (workerBindings) =>
      createStripeWebhookSettlementHandler(
        workerBindings,
        vi.fn<typeof fetch>(async () => settlementResponse()),
      ),
  });
  return { app, recordEvent };
}

function requestFailedLog(calls: ReadonlyArray<ReadonlyArray<unknown>>): Record<string, unknown> {
  const line = calls
    .map(([first]) => String(first))
    .find((candidate) => candidate.includes('core.request.failed'));
  expect(line).toBeDefined();
  return JSON.parse(line ?? '{}') as Record<string, unknown>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Core error log for Stripe webhook settlement failures', () => {
  it('records the RPC, status, code and reason of a permanent rejection without PostgREST text', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app, recordEvent } = appWithSettlementResponse(() =>
      Response.json(
        {
          code: 'P0001',
          message: 'STRIPE_EVENT_WORKSPACE_MISMATCH',
          details: 'Failing row contains (evt_settlement_error_log, cus_settlement_error_log).',
          hint: null,
        },
        { status: 400 },
      ),
    );

    const response = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery(subscriptionUpdatedEvent('evt_settlement_error_log')),
      bindings,
    );

    expect(response.status).toBe(500);
    expect(recordEvent).not.toHaveBeenCalled();
    expect(requestFailedLog(consoleError.mock.calls)).toMatchObject({
      error_name: 'StripeWebhookSettlementRpcRejectedError',
      error_rpc: 'apply_stripe_subscription_update',
      error_status: 400,
      error_code: 'P0001',
      error_reason: 'STRIPE_EVENT_WORKSPACE_MISMATCH',
    });
    const logged = consoleError.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toContain('Failing row contains');
    expect(logged).not.toContain('cus_settlement_error_log');
  });

  it('adds no RPC, status, code or reason for an outage', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { app } = appWithSettlementResponse(() =>
      Response.json({ code: 'P0002', message: 'WORKSPACE_NOT_FOUND' }, { status: 500 }),
    );

    const response = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery(subscriptionUpdatedEvent('evt_settlement_outage')),
      bindings,
    );

    expect(response.status).toBe(500);
    const log = requestFailedLog(consoleError.mock.calls);
    expect(log.error_name).toBe('StripeWebhookSettlementUnavailableError');
    for (const field of ['error_rpc', 'error_status', 'error_code', 'error_reason']) {
      expect(log).not.toHaveProperty(field);
    }
  });
});
