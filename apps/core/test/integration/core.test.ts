import { describe, expect, it } from 'vitest';

import { ApiErrorEnvelopeSchema, HealthResponseSchema } from '@mustbeviral/contracts';
import app from '../../src/index';

describe('Core Worker HTTP contract', () => {
  it('returns deterministic liveness without durable dependency probes', async () => {
    const response = await app.request('http://core.test/health', {
      headers: { 'x-request-id': 'integration-request-1' },
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('integration-request-1');
    expect(HealthResponseSchema.parse(body)).toMatchObject({
      status: 'ok',
      request_id: 'integration-request-1',
    });
  });

  it('returns a safe not-found envelope with request ID parity', async () => {
    const response = await app.request('http://core.test/missing');
    const body = await response.json();
    const requestId = response.headers.get('x-request-id');

    expect(response.status).toBe(404);
    expect(requestId).toBeTruthy();
    expect(ApiErrorEnvelopeSchema.parse(body)).toMatchObject({
      error: {
        code: 'NOT_FOUND',
        request_id: requestId,
        retryable: false,
      },
    });
  });
});
