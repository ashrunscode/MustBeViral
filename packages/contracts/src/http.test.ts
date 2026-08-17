import { describe, expect, it } from 'vitest';

import {
  API_SCHEMA_VERSION,
  ApiErrorSchema,
  HealthResponseSchema,
  SERVICE_GENERATION,
  WireTimestampSchema,
} from './http';

describe('HTTP contracts', () => {
  it('accepts the exact cleanroom health response', () => {
    expect(
      HealthResponseSchema.parse({
        schema_version: API_SCHEMA_VERSION,
        service: 'mustbeviral-core',
        generation: SERVICE_GENERATION,
        status: 'ok',
        request_id: 'request-1234',
      }),
    ).toMatchObject({ status: 'ok', generation: SERVICE_GENERATION });
  });

  it('rejects unsafe error details and incomplete envelopes', () => {
    expect(() =>
      ApiErrorSchema.parse({
        code: 'NOT_FOUND',
        message: 'Not found',
        request_id: 'bad id with spaces',
        retryable: false,
      }),
    ).toThrow();
  });

  it('accepts Postgres timestamptz with microsecond precision', () => {
    expect(WireTimestampSchema.parse('2026-08-15T22:21:34.848859+00:00')).toBe(
      '2026-08-15T22:21:34.848859+00:00',
    );
    expect(WireTimestampSchema.parse('2026-08-15T22:21:34.932Z')).toBe('2026-08-15T22:21:34.932Z');
    expect(WireTimestampSchema.safeParse('2026-08-15T22:21:34').success).toBe(false);
  });
});
