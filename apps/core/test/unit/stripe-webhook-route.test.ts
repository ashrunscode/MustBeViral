import { describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import {
  createStripeWebhookRoute,
  resolveStripeWebhookDependencies,
} from '../../src/routes/stripe-webhook';

const emptyBindings = {} as CoreBindings;

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

describe('standalone stripe webhook route', () => {
  it('acknowledges a verified test event once', async () => {
    const secret = 'whsec_unit';
    const recordEvent = vi.fn(async () => true);
    const route = createStripeWebhookRoute(() => ({
      webhookSecret: secret,
      recordEvent,
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

  it('returns duplicate acknowledgement without reprocessing', async () => {
    const secret = 'whsec_unit';
    const recordEvent = vi.fn(async () => false);
    const route = createStripeWebhookRoute(() => ({
      webhookSecret: secret,
      recordEvent,
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
