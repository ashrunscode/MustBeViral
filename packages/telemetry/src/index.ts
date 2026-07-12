export type TelemetryPrimitive = boolean | number | string | null;
export type TelemetryAttributes = Readonly<Record<string, TelemetryPrimitive>>;

const sensitiveKey = /(authorization|cookie|password|secret|token|api[_-]?key|service[_-]?role)/i;

export function sanitizeTelemetryAttributes(
  attributes: TelemetryAttributes,
): Record<string, TelemetryPrimitive> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      sensitiveKey.test(key) ? '[REDACTED]' : value,
    ]),
  );
}
