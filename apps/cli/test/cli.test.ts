import { describe, expect, it, vi } from 'vitest';

import {
  CLI_EXIT_CODES,
  MemoryCliCredentialStore,
  OsCliCredentialStore,
  apiV1BaseUrl,
  createCliClient,
  exitCodeForApiError,
} from '../src/index.js';
import {
  createIdempotencyKey,
  exitCodeForClientResponse,
  requireConfirmationFlag,
} from '../src/cli-response.js';
import { exitCodeForManagementResponse } from '../src/p1b-management.js';
import { loginWithToken, logout } from '../src/login.js';
import {
  PRODUCTION_CLI_COMMANDS,
  PRODUCTION_COMMAND_TO_OPERATION,
  runProductionCommand,
} from '../src/production-commands.js';

describe('@mustbeviral/cli', () => {
  it('maps API error codes to stable exit codes', () => {
    expect(exitCodeForApiError('UNAUTHENTICATED')).toBe(CLI_EXIT_CODES.auth);
    expect(exitCodeForApiError('FORBIDDEN')).toBe(CLI_EXIT_CODES.forbidden);
    expect(exitCodeForApiError('IDEMPOTENCY_CONFLICT')).toBe(CLI_EXIT_CODES.conflict);
  });

  it('builds versioned API base URLs without double /v1', () => {
    expect(apiV1BaseUrl('staging')).toBe('https://api-staging.mustbeviral.com/v1');
    expect(apiV1BaseUrl('production', 'https://core.example.test/v1')).toBe(
      'https://core.example.test/v1',
    );
  });

  it('loads credentials from the in-memory store', async () => {
    const store = new MemoryCliCredentialStore();
    await store.write('staging', 'mbv_sk_test_token');
    const client = await createCliClient({
      environment: 'staging',
      credentialStore: store,
      baseUrl: 'https://example.test',
    });
    expect(client.request).toBeTypeOf('function');
    expect(client.baseUrl).toBe('https://example.test/v1');
    await expect(store.read('production')).resolves.toBeNull();
  });

  it('requires a stored credential for the selected environment', async () => {
    await expect(
      createCliClient({
        environment: 'production',
        credentialStore: new MemoryCliCredentialStore(),
      }),
    ).rejects.toThrow(/No credential is stored/);
  });

  it('maps management HTTP status to exit codes', () => {
    expect(
      exitCodeForManagementResponse({ status: 401, body: { error: { code: 'UNAUTHENTICATED' } } }),
    ).toBe(CLI_EXIT_CODES.auth);
    expect(exitCodeForManagementResponse({ status: 200, body: { data: { keys: [] } } })).toBe(0);
  });

  it('stores and clears credentials through the OS adapter', async () => {
    const keyring = {
      passwords: new Map<string, string>(),
      read: async (environment: 'staging' | 'production') =>
        keyring.passwords.get(`mustbeviral-cli:${environment}`) ?? null,
      write: async (environment: 'staging' | 'production', password: string) => {
        keyring.passwords.set(`mustbeviral-cli:${environment}`, password);
      },
      delete: async (environment: 'staging' | 'production') => {
        keyring.passwords.delete(`mustbeviral-cli:${environment}`);
      },
    };
    const store = new OsCliCredentialStore(keyring);
    await store.write('staging', 'session-token');
    await expect(store.read('staging')).resolves.toBe('session-token');
    await logout({ environment: 'staging', credentialStore: store });
    await expect(store.read('staging')).resolves.toBeNull();
  });

  it('login writes a pasted token to the credential store', async () => {
    const store = new MemoryCliCredentialStore();
    await loginWithToken({
      environment: 'staging',
      credentialStore: store,
      token: ' pasted-token ',
    });
    await expect(store.read('staging')).resolves.toBe('pasted-token');
  });

  it('maps client envelopes to exit codes', () => {
    expect(
      exitCodeForClientResponse({
        error: { code: 'QUOTE_EXPIRED', message: 'expired', request_id: 'r1', retryable: false },
      }),
    ).toBe(CLI_EXIT_CODES.validation);
    expect(exitCodeForClientResponse({ data: {}, meta: { request_id: 'r1' } })).toBe(0);
  });

  it('requires explicit confirmation for paid and destructive mutations', () => {
    expect(() => requireConfirmationFlag(false, 'start-run')).toThrow(/--confirmed/u);
    expect(() => requireConfirmationFlag(false, 'cancel-run')).toThrow(/--confirm/u);
    expect(() => requireConfirmationFlag(true, 'start-run')).not.toThrow();
  });

  it('registers eleven production CLI commands aligned with MCP tools', () => {
    expect(PRODUCTION_CLI_COMMANDS).toHaveLength(11);
    expect(Object.values(PRODUCTION_COMMAND_TO_OPERATION)).toEqual([
      'get_canvas_context',
      'apply_canvas_patch',
      'quote_run',
      'start_run',
      'get_run',
      'validate_graph',
      'cancel_run',
      'get_artifact',
      'create_export',
      'explain_model',
      'get_receipt',
    ]);
  });

  it('calls the shared REST client for production commands', async () => {
    const request = vi.fn(async () => ({
      data: { runId: 'run-1' },
      meta: { request_id: 'request-1' },
    }));
    const client = { request };
    const result = await runProductionCommand(client as never, 'get-run', ['run-1'], {});
    expect(request).toHaveBeenCalledWith('get_run', { id: 'run-1' });
    expect(result.exitCode).toBe(0);
  });

  it('blocks start-run without explicit confirmation before calling Core', async () => {
    const request = vi.fn();
    const client = { request };
    await expect(
      runProductionCommand(client as never, 'start-run', ['quote-1'], {
        confirmationToken: 'confirmation-token-123456',
      }),
    ).rejects.toThrow(/--confirmed/u);
    expect(request).not.toHaveBeenCalled();
  });

  it('generates idempotency keys for mutations when omitted', () => {
    const first = createIdempotencyKey(undefined);
    const second = createIdempotencyKey(undefined);
    expect(first).not.toBe(second);
    expect(createIdempotencyKey('stable-key')).toBe('stable-key');
  });
});
