import {
  createMustBeViralRestClient,
  type MustBeViralRestClient,
} from '@mustbeviral/contracts';

export type CliEnvironment = 'staging' | 'production';

const DEFAULT_BASE_URLS: Readonly<Record<CliEnvironment, string>> = Object.freeze({
  staging: 'https://api-staging.mustbeviral.com/v1',
  production: 'https://api.mustbeviral.com/v1',
});

export interface CliCredentialStore {
  read(environment: CliEnvironment): Promise<string | null>;
  write(environment: CliEnvironment, token: string): Promise<void>;
  delete(environment: CliEnvironment): Promise<void>;
}

export class MemoryCliCredentialStore implements CliCredentialStore {
  readonly #tokens = new Map<CliEnvironment, string>();

  read(environment: CliEnvironment): Promise<string | null> {
    return Promise.resolve(this.#tokens.get(environment) ?? null);
  }

  write(environment: CliEnvironment, token: string): Promise<void> {
    this.#tokens.set(environment, token);
    return Promise.resolve();
  }

  delete(environment: CliEnvironment): Promise<void> {
    this.#tokens.delete(environment);
    return Promise.resolve();
  }
}

export interface CliClientOptions {
  readonly environment?: CliEnvironment;
  readonly baseUrl?: string;
  readonly credentialStore?: CliCredentialStore;
  readonly accessToken?: string;
  readonly fetch?: typeof fetch;
}

export async function createCliClient(options: CliClientOptions = {}): Promise<MustBeViralRestClient> {
  const environment = options.environment ?? 'staging';
  const token =
    options.accessToken ??
    (options.credentialStore === undefined ? null : await options.credentialStore.read(environment));
  if (token === null || token.length === 0) {
    throw new Error(`No credential is stored for the ${environment} environment.`);
  }
  return createMustBeViralRestClient({
    baseUrl: options.baseUrl ?? DEFAULT_BASE_URLS[environment],
    getAccessToken: async () => token,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
}

export const CLI_EXIT_CODES = Object.freeze({
  ok: 0,
  usage: 2,
  auth: 3,
  validation: 4,
  forbidden: 5,
  notFound: 6,
  conflict: 7,
  provider: 8,
  internal: 9,
});

export function exitCodeForApiError(code: string): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return CLI_EXIT_CODES.auth;
    case 'FORBIDDEN':
      return CLI_EXIT_CODES.forbidden;
    case 'NOT_FOUND':
      return CLI_EXIT_CODES.notFound;
    case 'VALIDATION_FAILED':
    case 'GRAPH_INVALID':
    case 'QUOTE_EXPIRED':
    case 'QUOTE_STALE':
      return CLI_EXIT_CODES.validation;
    case 'IDEMPOTENCY_CONFLICT':
    case 'REVISION_CONFLICT':
      return CLI_EXIT_CODES.conflict;
    case 'MODEL_UNAVAILABLE':
    case 'PROVIDER_REJECTED':
    case 'PROVIDER_AMBIGUOUS':
      return CLI_EXIT_CODES.provider;
    default:
      return CLI_EXIT_CODES.internal;
  }
}

export { DEFAULT_BASE_URLS };
