import { describe, expect, it, vi } from 'vitest';

import { ResendUnavailableError, sendResendEmail } from './resend';
import { reportSentryEvent, SentryUnavailableError } from './sentry';

describe('Resend adapter', () => {
  it('fails closed when credentials are missing', async () => {
    await expect(
      sendResendEmail(
        { apiKey: undefined, fromAddress: 'billing@example.com' },
        {
          to: 'user@example.com',
          subject: 'Receipt',
          html: '<p>Receipt</p>',
        },
      ),
    ).rejects.toBeInstanceOf(ResendUnavailableError);
  });

  it('posts sanitized transactional mail when configured', async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 202 }));
    await sendResendEmail(
      { apiKey: 're_test', fromAddress: 'billing@example.com' },
      { to: 'user@example.com', subject: 'Receipt', html: '<p>Receipt</p>' },
      fetchImplementation,
    );
    expect(fetchImplementation).toHaveBeenCalledOnce();
  });
});

describe('Sentry adapter', () => {
  it('fails closed when DSN is missing', () => {
    expect(() =>
      reportSentryEvent({ dsn: undefined }, { message: 'ledger imbalance', level: 'error' }),
    ).toThrow(SentryUnavailableError);
  });

  it('redacts credential-shaped attributes before reporting', () => {
    const result = reportSentryEvent(
      { dsn: 'https://example@sentry.io/1' },
      {
        message: 'duplicate charge blocked',
        level: 'warning',
        attributes: {
          request_id: 'req-1',
          authorization: 'Bearer secret',
        },
      },
    );
    expect(result.attributes).toEqual({
      request_id: 'req-1',
      authorization: '[REDACTED]',
    });
  });
});
