export type TelemetrySinkStatus = 'disabled' | 'ready';

export interface TelemetryBootstrapInput {
  readonly sentryDsn?: string;
  readonly otelEndpoint?: string;
  readonly serviceName: string;
}

export interface TelemetryBootstrapResult {
  readonly sentry: TelemetrySinkStatus;
  readonly otel: TelemetrySinkStatus;
}

const sensitiveKey =
  /(authorization|cookie|password|secret|token|api[_-]?key|service[_-]?role|signed[_-]?url)/i;

export function sanitizeTelemetryAttributes(
  attributes: Readonly<Record<string, string | number | boolean | null>>,
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : value,
    ]),
  );
}

/**
 * Fail-closed telemetry bootstrap. Missing credentials disable sinks without throwing.
 */
export function bootstrapTelemetry(input: TelemetryBootstrapInput): TelemetryBootstrapResult {
  const sentry =
    typeof input.sentryDsn === 'string' && input.sentryDsn.length > 0 ? 'ready' : 'disabled';
  const otel =
    typeof input.otelEndpoint === 'string' && input.otelEndpoint.length > 0 ? 'ready' : 'disabled';
  return Object.freeze({ sentry, otel });
}

export function captureTelemetryException(
  error: unknown,
  attributes: Readonly<Record<string, string | number | boolean | null>> = {},
): void {
  try {
    console.error(
      JSON.stringify({
        level: 'error',
        event: 'telemetry.exception',
        error_name: error instanceof Error ? error.name : 'UnknownError',
        attributes: sanitizeTelemetryAttributes(attributes),
      }),
    );
  } catch {
    // Telemetry capture must never throw.
  }
}

export type TelemetryAttributes = Readonly<Record<string, string | number | boolean | null>>;

export { ResendUnavailableError, sendResendEmail } from './resend';
export type { ResendConfig, ResendEmailInput } from './resend';
export { reportSentryEvent, SentryUnavailableError } from './sentry';
export type { SentryConfig, SentryEventInput } from './sentry';
