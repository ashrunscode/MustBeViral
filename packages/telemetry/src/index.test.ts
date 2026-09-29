import { describe, expect, it } from 'vitest';

import {
  bootstrapTelemetry,
  captureTelemetryException,
  sanitizeTelemetryAttributes,
} from './index';

describe('telemetry fail-closed bootstrap', () => {
  it('disables sinks when credentials are absent', () => {
    expect(bootstrapTelemetry({ serviceName: 'mustbeviral-web' })).toEqual({
      sentry: 'disabled',
      otel: 'disabled',
    });
  });

  it('marks sinks ready when credentials are present', () => {
    expect(
      bootstrapTelemetry({
        serviceName: 'mustbeviral-core',
        sentryDsn: 'https://example.test/1',
        otelEndpoint: 'https://otel.example.test/v1/traces',
      }),
    ).toEqual({
      sentry: 'ready',
      otel: 'ready',
    });
  });

  it('redacts sensitive attribute keys', () => {
    expect(
      sanitizeTelemetryAttributes({
        workspace_id: 'ws_1',
        authorization: 'Bearer secret',
      }),
    ).toEqual({
      workspace_id: 'ws_1',
      authorization: '[REDACTED]',
    });
  });

  it('captures exceptions without throwing', () => {
    expect(() => captureTelemetryException(new Error('boom'), { run_id: 'run_1' })).not.toThrow();
  });
});
