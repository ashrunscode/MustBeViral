import { Entry } from '@napi-rs/keyring';

export type CliEnvironment = 'staging' | 'production';

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

const SERVICE_NAME = 'mustbeviral-cli';

export interface KeyringAdapter {
  read(environment: CliEnvironment): Promise<string | null>;
  write(environment: CliEnvironment, token: string): Promise<void>;
  delete(environment: CliEnvironment): Promise<void>;
}

export class OsCliCredentialStore implements CliCredentialStore {
  readonly #adapter: KeyringAdapter;

  constructor(adapter?: KeyringAdapter) {
    this.#adapter =
      adapter ??
      ({
        read: async (environment) => {
          const entry = new Entry(SERVICE_NAME, environment);
          try {
            return await entry.getPassword();
          } catch {
            return null;
          }
        },
        write: async (environment, token) => {
          const entry = new Entry(SERVICE_NAME, environment);
          await entry.setPassword(token);
        },
        delete: async (environment) => {
          const entry = new Entry(SERVICE_NAME, environment);
          await entry.deletePassword();
        },
      } satisfies KeyringAdapter);
  }

  read(environment: CliEnvironment): Promise<string | null> {
    return this.#adapter.read(environment);
  }

  write(environment: CliEnvironment, token: string): Promise<void> {
    return this.#adapter.write(environment, token);
  }

  delete(environment: CliEnvironment): Promise<void> {
    return this.#adapter.delete(environment);
  }
}

export function defaultCredentialStore(): CliCredentialStore {
  if (process.env.VITEST === 'true' || process.env.MBV_CLI_CREDENTIAL_STORE === 'memory') {
    return new MemoryCliCredentialStore();
  }
  return new OsCliCredentialStore();
}
