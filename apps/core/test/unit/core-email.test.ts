import { describe, expect, it, vi } from 'vitest';

import type { CoreBindings } from '../../src/bindings';
import { createCoreEmailPort } from '../../src/composition/core-email';

describe('createCoreEmailPort', () => {
  it('fails closed without Resend credentials', async () => {
    const email = createCoreEmailPort({} as CoreBindings);
    await expect(
      email.send({
        to: 'operator@example.com',
        subject: 'Test',
        text: 'Hello',
      }),
    ).resolves.toBe('disabled');
  });

  it('attempts delivery when credentials exist', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    const email = createCoreEmailPort(
      {
        RESEND_API_KEY: 're_test',
        RESEND_FROM_ADDRESS: 'billing@example.com',
      } as CoreBindings,
      fetchMock,
    );
    await expect(
      email.send({
        to: 'operator@example.com',
        subject: 'Wallet credit',
        text: 'Credited 50000000 micros',
      }),
    ).resolves.toBe('sent');
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
