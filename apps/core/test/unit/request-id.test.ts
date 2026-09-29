import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import type { CoreHonoEnvironment } from '../../src/bindings';
import { normalizeRequestId, requestIdMiddleware } from '../../src/http/request-id';

describe('request ID normalization', () => {
  it('keeps a bounded safe caller correlation ID', () => {
    expect(normalizeRequestId('caller.request-123')).toBe('caller.request-123');
  });

  it('replaces unsafe and oversized values', () => {
    expect(normalizeRequestId('bad id')).toMatch(/^[0-9a-f-]{36}$/);
    expect(normalizeRequestId('a'.repeat(129))).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('request ID response policy', () => {
  it('adds no-store when a route does not declare a cache policy', async () => {
    const app = new Hono<CoreHonoEnvironment>();
    app.use('*', requestIdMiddleware);
    app.get('/default', (context) => context.text('ok'));

    const response = await app.request('/default');

    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('preserves a stronger route-specific private no-store policy', async () => {
    const app = new Hono<CoreHonoEnvironment>();
    app.use('*', requestIdMiddleware);
    app.get(
      '/private',
      () =>
        new Response('private', {
          headers: { 'cache-control': 'private, no-store' },
        }),
    );

    const response = await app.request('/private');

    expect(response.headers.get('cache-control')).toBe('private, no-store');
  });
});
