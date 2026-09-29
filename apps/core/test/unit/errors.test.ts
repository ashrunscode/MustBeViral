import { describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';

describe('safe error handling', () => {
  it('does not expose thrown messages or stacks', async () => {
    const app = createCoreApp();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    app.get('/test-only-fault', () => {
      throw new Error('sentinel-sensitive-message');
    });

    const response = await app.request('/test-only-fault');
    const body = await response.text();
    expect(response.status).toBe(500);
    expect(body).not.toContain('sentinel-sensitive-message');
    expect(body).not.toContain('stack');
    expect(JSON.parse(body)).toMatchObject({
      error: {
        code: 'INTERNAL_ERROR',
        retryable: true,
        details: { error_id: expect.any(String) },
      },
    });
  });
});
