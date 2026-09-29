import { sanitizeTelemetryAttributes } from './index';

export type TelemetryAttributes = Readonly<Record<string, string | number | boolean | null>>;

export interface SentryConfig {
  readonly dsn: string | undefined;
}

export interface SentryEventInput {
  readonly message: string;
  readonly level: 'error' | 'warning' | 'info';
  readonly attributes?: TelemetryAttributes;
}

export class SentryUnavailableError extends Error {
  override readonly name = 'SentryUnavailableError';
}

export function reportSentryEvent(
  config: SentryConfig,
  input: SentryEventInput,
): Readonly<{ reported: true; level: SentryEventInput['level']; attributes: TelemetryAttributes }> {
  if (config.dsn === undefined || config.dsn.length === 0) {
    throw new SentryUnavailableError('Sentry DSN is not configured.');
  }
  return Object.freeze({
    reported: true,
    level: input.level,
    attributes: sanitizeTelemetryAttributes(input.attributes ?? {}),
  });
}
