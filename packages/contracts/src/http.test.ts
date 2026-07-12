import { describe, expect, it } from 'vitest';

import {
  API_SCHEMA_VERSION,
  ApiErrorSchema,
  HealthResponseSchema,
  SERVICE_GENERATION,
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
});
