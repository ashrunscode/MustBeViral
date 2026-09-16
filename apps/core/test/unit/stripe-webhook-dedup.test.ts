import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookDedupPort,
  StripeWebhookDedupForbiddenError,
  StripeWebhookDedupUnavailableError,
} from '../../src/composition/stripe-webhook-dedup';

const bindings = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
} as never;

const event = {
  eventId: 'evt_1',
  eventType: 'checkout.session.completed',
  livemode: false,
  payloadHash: 'abc123',
} as const;

function respondWith(body: unknown) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status: 200 }));
}

describe('stripe webhook dedup', () => {
  it('claims first-seen events through the five-argument claim RPC', async () => {
    const fetchMock = respondWith({ claim: 'inserted' });
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-1', fetchMock);

    await expect(port.recordEvent(event)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://example.supabase.co/rest/v1/rpc/record_stripe_webhook_event');
    expect(init?.method).toBe('POST');
    // PostgREST resolves overloads by named arguments. Dropping p_request_id would route to the
    // four-argument overload, which returns a different shape and raises at runtime.
    expect(JSON.parse(String(init?.body))).toStrictEqual({
      p_stripe_event_id: 'evt_1',
      p_event_type: 'checkout.session.completed',
      p_livemode: false,
      p_payload_hash: 'abc123',
      p_request_id: 'req-stripe-dedup-1',
    });
  });

  it('reports duplicate claims as false', async () => {
    const fetchMock = respondWith({ claim: 'duplicate' });
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-2', fetchMock);

    await expect(port.recordEvent({ ...event, eventId: 'evt_dup' })).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([
    ['the four-argument overload shape', { inserted: true }],
    ['a provider webhook claim value', { claim: 'claimed' }],
    ['a non-string claim', { claim: true }],
    ['an array', [{ claim: 'inserted' }]],
    ['null', null],
  ])('fails closed on %s', async (_label, body) => {
    const port = createStripeWebhookDedupPort(bindings, 'req-stripe-dedup-3', respondWith(body));

    await expect(port.recordEvent(event)).rejects.toBeInstanceOf(
      StripeWebhookDedupUnavailableError,
    );
  });

  it('rejects forbidden privileged credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 403 }));
    const port = createStripeWebhookDedupPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'bad',
      } as never,
      'req-stripe-dedup-4',
      fetchMock,
    );
    await expect(
      port.recordEvent({
        eventId: 'evt_forbidden',
        eventType: 'invoice.paid',
        livemode: false,
        payloadHash: 'hash',
      }),
    ).rejects.toBeInstanceOf(StripeWebhookDedupForbiddenError);
  });
});
