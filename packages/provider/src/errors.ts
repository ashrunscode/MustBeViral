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

export function errorFromHttpStatus(provider: string, status: number, body: string): ProviderError {
  const details = { provider, status, responseBody: body.slice(0, 512) };
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
