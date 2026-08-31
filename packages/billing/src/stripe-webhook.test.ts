import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';

import {
  assertP1aPackMarginGuardrail,
  P1A_FULLY_LANDED_MARGIN_CAP_MICROS,
  verifyStripeWebhook,
} from './stripe-webhook';

describe('verifyStripeWebhook', () => {
  it('verifies a signed Stripe test payload', async () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid', livemode: false });
    const timestamp = 1_700_000_000;
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const verified = await verifyStripeWebhook({
      rawBody: body,
      signatureHeader: `t=${timestamp},v1=${signature}`,
      webhookSecret: secret,
      nowSeconds: timestamp,
    });
    expect(verified.eventId).toBe('evt_1');
    expect(verified.eventType).toBe('invoice.paid');
    expect(verified.livemode).toBe(false);
  });
});

describe('assertP1aPackMarginGuardrail', () => {
  it('enforces the fully landed 60% margin cap', () => {
    expect(P1A_FULLY_LANDED_MARGIN_CAP_MICROS).toBe(1_820_000n);
    expect(() => assertP1aPackMarginGuardrail(1_900_000n, 4_550_000n)).toThrow(
      'P1a $1.82 guardrail',
    );
    expect(() => assertP1aPackMarginGuardrail(700_000n, 4_550_000n)).not.toThrow();
  });
});
