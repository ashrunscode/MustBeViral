import { describe, expect, it } from 'vitest';

import { sanitizeTelemetryAttributes } from './index';

describe('telemetry redaction', () => {
  it('redacts credential-shaped keys while preserving safe dimensions', () => {
    expect(
      sanitizeTelemetryAttributes({
        request_id: 'request-1234',
        authorization: 'Bearer credential',
        provider_api_key: 'credential',
      }),
    ).toEqual({
      request_id: 'request-1234',
      authorization: '[REDACTED]',
      provider_api_key: '[REDACTED]',
    });
  });
});
