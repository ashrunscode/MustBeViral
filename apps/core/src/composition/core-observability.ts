import {
  bootstrapTelemetry,
  captureTelemetryException,
  reportSentryEvent,
} from '@mustbeviral/telemetry';

import type { CoreBindings } from '../bindings';

export function createCoreObservability(bindings: CoreBindings | undefined) {
  const telemetry = bootstrapTelemetry({
    serviceName: 'mustbeviral-core',
    ...(bindings?.SENTRY_DSN === undefined ? {} : { sentryDsn: bindings.SENTRY_DSN }),
    ...(bindings?.OTEL_EXPORTER_OTLP_ENDPOINT === undefined
      ? {}
      : { otelEndpoint: bindings.OTEL_EXPORTER_OTLP_ENDPOINT }),
  });

  return Object.freeze({
    telemetry,
    captureException(error: unknown, requestId: string): void {
      captureTelemetryException(error, {
        request_id: requestId,
        service: 'mustbeviral-core',
      });
      if (telemetry.sentry !== 'ready') return;
      try {
        reportSentryEvent(
          { dsn: bindings?.SENTRY_DSN },
          {
            message: error instanceof Error ? error.message : 'Core request failed',
            level: 'error',
            attributes: { request_id: requestId },
          },
        );
      } catch {
        // Fail-closed: telemetry must never block webhook or REST handling.
      }
    },
  });
}
