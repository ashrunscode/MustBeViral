export const providerErrorCodes = [
  'auth_missing',
  'auth_rejected',
  'rate_limited',
  'provider_error',
  'timeout',
  'ambiguous_submit',
  'payload_invalid',
] as const;

export type ProviderErrorCode = (typeof providerErrorCodes)[number];

export class ProviderError extends Error {
  override readonly name: string = 'ProviderError';

  constructor(
    readonly code: ProviderErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly details: Readonly<Record<string, unknown>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export type TransportFailureKind = 'timeout' | 'connection' | 'aborted';

export class ProviderTransportFailure extends Error {
  override readonly name = 'ProviderTransportFailure';

  constructor(
    readonly kind: TransportFailureKind,
    message: string,
    readonly requestMayHaveBeenAccepted = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function requireCredential(credential: string | undefined, provider: string): string {
  if (credential === undefined || credential.trim().length === 0) {
    throw new ProviderError('auth_missing', `${provider} credential is not configured`, false, {
      provider,
    });
  }
  return credential;
}

const PROVIDER_ERROR_CODE = /^[A-Za-z0-9_.-]{1,80}$/u;
const HTTP_STATUS_WRAPPER = /^Invalid status code: (\d{3})$/u;
const PROVIDER_MACHINE_KEYS = ['error_type', 'type', 'code', 'detail', 'error'] as const;

/**
 * Extracts a provider's bounded machine-readable failure code without retaining prompts, signed
 * delivery URLs, or free-form response text. Provider error payloads are untrusted and may echo
 * the complete input, so callers must never persist the raw body merely for diagnostics.
 */
export function providerMachineErrorCode(value: unknown): string | undefined {
  if (typeof value === 'string') {
    if (PROVIDER_ERROR_CODE.test(value)) return value;
    const wrapper = HTTP_STATUS_WRAPPER.exec(value);
    return wrapper ? `http_${wrapper[1]}` : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = providerMachineErrorCode(item);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Readonly<Record<string, unknown>>;
    // Deliberately ignore `msg`, `input`, and `url`: fal and other providers may place customer
    // prompts or signed delivery capabilities in those fields.
    for (const key of PROVIDER_MACHINE_KEYS) {
      const found = providerMachineErrorCode(record[key]);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function safeHttpErrorDetails(
  provider: string,
  status: number,
  body: string,
): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    parsed = undefined;
  }
  const providerErrorCode = providerMachineErrorCode(parsed);
  return {
    provider,
    status,
    ...(providerErrorCode === undefined ? {} : { provider_error_code: providerErrorCode }),
  };
}

export function errorFromHttpStatus(provider: string, status: number, body: string): ProviderError {
  const details = safeHttpErrorDetails(provider, status, body);
  if (status === 401 || status === 403) {
    return new ProviderError(
      'auth_rejected',
      `${provider} rejected authentication`,
      false,
      details,
    );
  }
  if (status === 429) {
    return new ProviderError('rate_limited', `${provider} rate limited the request`, true, details);
  }
  if (status === 400 || status === 422) {
    return new ProviderError('payload_invalid', `${provider} rejected the payload`, false, details);
  }
  return new ProviderError(
    'provider_error',
    `${provider} returned HTTP ${status}`,
    status >= 500,
    details,
  );
}

export function parseJsonObject(body: string, provider: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch (cause) {
    throw new ProviderError(
      'payload_invalid',
      `${provider} returned invalid JSON`,
      false,
      {},
      {
        cause,
      },
    );
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ProviderError('payload_invalid', `${provider} returned a non-object payload`, false);
  }
  return parsed as Readonly<Record<string, unknown>>;
}
