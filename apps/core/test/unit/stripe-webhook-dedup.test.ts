import { describe, expect, it, vi } from 'vitest';

import {
  createStripeWebhookDedupPort,
  StripeWebhookDedupForbiddenError,
} from '../../src/composition/stripe-webhook-dedup';

describe('stripe webhook dedup', () => {
  it('records first-seen events through the privileged RPC', async () => {
    const fetchMock = vi.fn(async () => Response.json({ inserted: true }, { status: 200 }));
    const port = createStripeWebhookDedupPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      } as never,
      fetchMock,
    );
    await expect(
      port.recordEvent({
        eventId: 'evt_1',
        eventType: 'checkout.session.completed',
        livemode: false,
        payloadHash: 'abc123',
      }),
    ).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('records duplicate events as false', async () => {
    const fetchMock = vi.fn(async () => Response.json({ inserted: false }, { status: 200 }));
    const port = createStripeWebhookDedupPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'sb_secret_test',
      } as never,
      fetchMock,
    );
    await expect(
      port.recordEvent({
        eventId: 'evt_dup',
        eventType: 'invoice.paid',
        livemode: false,
        payloadHash: 'def456',
      }),
    ).resolves.toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects forbidden privileged credentials', async () => {
    const fetchMock = vi.fn(async () => new Response('nope', { status: 403 }));
    const port = createStripeWebhookDedupPort(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'bad',
      } as never,
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
