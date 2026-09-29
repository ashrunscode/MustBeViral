import { createMustBeViralRestClient, type MustBeViralRestClient } from '@mustbeviral/contracts';

import {
  defaultCredentialStore,
  type CliCredentialStore,
  type CliEnvironment,
} from './credential-store.js';

export type { CliCredentialStore, CliEnvironment } from './credential-store.js';
export {
  MemoryCliCredentialStore,
  OsCliCredentialStore,
  defaultCredentialStore,
  type KeyringAdapter,
} from './credential-store.js';

const DEFAULT_API_HOSTS: Readonly<Record<CliEnvironment, string>> = Object.freeze({
  staging: 'https://api-staging.mustbeviral.com',
  production: 'https://api.mustbeviral.com',
});

export function apiV1BaseUrl(environment: CliEnvironment, override?: string): string {
  const host = (override ?? DEFAULT_API_HOSTS[environment]).replace(/\/$/u, '');
  return host.endsWith('/v1') ? host : `${host}/v1`;
}

export interface CliClientOptions {
  readonly environment?: CliEnvironment;
  readonly baseUrl?: string;
  readonly credentialStore?: CliCredentialStore;
  readonly accessToken?: string;
  readonly fetch?: typeof fetch;
}

export async function createCliClient(
  options: CliClientOptions = {},
): Promise<
  MustBeViralRestClient & Readonly<{ baseUrl: string; readAccessToken: () => Promise<string> }>
> {
  const environment = options.environment ?? 'staging';
  const credentialStore =
    options.credentialStore ??
    (options.accessToken === undefined ? defaultCredentialStore() : null);
  const token =
    options.accessToken ??
    (credentialStore === null ? null : await credentialStore.read(environment));
  if (token === null || token.length === 0) {
    throw new Error(
      `No credential is stored for the ${environment} environment. Run "mbv login" first.`,
    );
  }
  const baseUrl = apiV1BaseUrl(environment, options.baseUrl);
  const client = createMustBeViralRestClient({
    baseUrl: baseUrl.replace(/\/v1$/u, ''),
    getAccessToken: async () => token,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  return Object.assign(client, {
    baseUrl,
    readAccessToken: async () => token,
  });
}

export { CLI_EXIT_CODES, exitCodeForApiError } from './exit-codes.js';

export { DEFAULT_API_HOSTS as DEFAULT_BASE_URLS };
