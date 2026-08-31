import { describe, expect, it } from 'vitest';

import {
  CLI_EXIT_CODES,
  MemoryCliCredentialStore,
  createCliClient,
  exitCodeForApiError,
} from '../src/index.js';

describe('@mustbeviral/cli', () => {
  it('maps API error codes to stable exit codes', () => {
    expect(exitCodeForApiError('UNAUTHENTICATED')).toBe(CLI_EXIT_CODES.auth);
    expect(exitCodeForApiError('FORBIDDEN')).toBe(CLI_EXIT_CODES.forbidden);
    expect(exitCodeForApiError('IDEMPOTENCY_CONFLICT')).toBe(CLI_EXIT_CODES.conflict);
  });

  it('loads credentials from the in-memory store', async () => {
    const store = new MemoryCliCredentialStore();
    await store.write('staging', 'mbv_sk_test_token');
    const client = await createCliClient({
      environment: 'staging',
      credentialStore: store,
      baseUrl: 'https://example.test/v1',
    });
    expect(client.request).toBeTypeOf('function');
    await expect(store.read('production')).resolves.toBeNull();
  });

  it('requires a stored credential for the selected environment', async () => {
    await expect(createCliClient({ environment: 'production' })).rejects.toThrow(
      /No credential is stored/,
    );
  });
});
