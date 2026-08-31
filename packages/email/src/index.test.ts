import { describe, expect, it } from 'vitest';

import { sendTransactionalEmail } from './index';

describe('sendTransactionalEmail', () => {
  it('fails closed without a Resend API key', () => {
    expect(
      sendTransactionalEmail({
        from: 'studio@mustbeviral.com',
        to: 'operator@example.com',
        subject: 'Receipt ready',
        text: 'Your launch pack receipt is ready.',
      }),
    ).toEqual({ status: 'disabled', id: null });
  });

  it('marks ready when credentials exist without pretending delivery', () => {
    expect(
      sendTransactionalEmail({
        resendApiKey: 're_test_key',
        from: 'studio@mustbeviral.com',
        to: 'operator@example.com',
        subject: 'Receipt ready',
        text: 'Your launch pack receipt is ready.',
      }),
    ).toEqual({ status: 'ready', id: null });
  });
});
