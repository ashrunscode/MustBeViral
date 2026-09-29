import { createHmac } from 'node:crypto';
import { settleStripeWebhookEvent } from '@mustbeviral/billing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';
import type { CoreBindings } from '../../src/bindings';
import { createStripeWebhookDedupPort } from '../../src/composition/stripe-webhook-dedup';

const secret = 'whsec_dedup_error_log';

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

// Settlement is wired too, so the delivery reaches the dedup call whether the route records the
// receipt before or after settling.
function appWithDedupResponse(dedupResponse: () => Response) {
  return createCoreApp(undefined, {
    createStripeWebhookRecordEvent: (workerBindings, requestId) => {
      const port = createStripeWebhookDedupPort(
        workerBindings,
        requestId,
        vi.fn<typeof fetch>(async () => dedupResponse()),
      );
      return async (event) => port.recordEvent(event);
    },
    createStripeWebhookSettleEvent: () => async (input) => ({
      settlement: settleStripeWebhookEvent(input),
      emailStatus: 'not_requested',
      persisted: false,
    }),
  });
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

describe('Core error log for Stripe webhook dedup failures', () => {
  it('records the status and code of a permanent rejection without PostgREST text', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = appWithDedupResponse(() =>
      Response.json(
        {
          code: '22023',
          message: 'stripe_event_id is required',
          details: 'Failing row contains (evt_dedup_error_log).',
          hint: null,
        },
        { status: 400 },
      ),
    );
    const body = JSON.stringify({
      id: 'evt_dedup_error_log',
      type: 'invoice.paid',
      livemode: false,
    });

    const response = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery(body),
      bindings,
    );

    expect(response.status).toBe(500);
    expect(requestFailedLog(consoleError.mock.calls)).toMatchObject({
      error_name: 'StripeWebhookDedupRejectedError',
      error_status: 400,
      error_code: '22023',
    });
    const logged = consoleError.mock.calls.flat().map(String).join('\n');
    expect(logged).not.toContain('stripe_event_id is required');
    expect(logged).not.toContain('evt_dedup_error_log');
  });

  it('adds no status or code for an outage', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const app = appWithDedupResponse(() => Response.json({ code: 'PGRST002' }, { status: 503 }));
    const body = JSON.stringify({ id: 'evt_dedup_outage', type: 'invoice.paid', livemode: false });

    const response = await app.request(
      'http://localhost/webhooks/stripe',
      signedDelivery(body),
      bindings,
    );

    expect(response.status).toBe(500);
    const log = requestFailedLog(consoleError.mock.calls);
    expect(log.error_name).toBe('StripeWebhookDedupUnavailableError');
    expect(log).not.toHaveProperty('error_status');
    expect(log).not.toHaveProperty('error_code');
  });
});
