import { createP1bHandlers } from '@mustbeviral/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';
import { workerCredentialGenerator } from '../../src/auth/credential-format';

const listKeysResult = {
  status: 'ok' as const,
  data: {
    keys: [
      {
        id: 'key-1',
        name: 'Automation',
        prefix: 'mbv_sk_abcd',
        scopes: ['run:read'],
        created_at: '2026-08-31T12:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    ],
  },
};

describe('P1b three-client parity for list_api_keys', () => {
  it('returns identical envelopes for REST and CLI-style fetch', async () => {
    const port = {
      createApiKey: vi.fn(),
      listApiKeys: vi.fn(async () => listKeysResult),
      revokeApiKey: vi.fn(),
      createOAuthClient: vi.fn(),
      listOAuthClients: vi.fn(),
      revokeOAuthClient: vi.fn(),
      issueOAuthToken: vi.fn(),
      publishSkill: vi.fn(),
      listSkills: vi.fn(),
    };
    const handlers = createP1bHandlers(port, workerCredentialGenerator);
    const app = createCoreApp({
      handlers: {} as never,
      jwt: {
        verify: vi.fn(async () => ({
          actorId: 'owner-1',
          authenticationMethod: 'supabase_jwt' as const,
          workspaceId: 'workspace-1',
          scopes: ['run:read'] as const,
        })),
      },
      workspaces: { resolve: async () => 'workspace-1' },
      p1bHandlers: handlers,
    });

    const restResponse = await app.request('http://localhost/v1/workspaces/workspace-1/api-keys', {
      method: 'GET',
      headers: { authorization: 'Bearer valid-jwt' },
    });
    const cliResponse = await app.request('http://localhost/v1/workspaces/workspace-1/api-keys', {
      method: 'GET',
      headers: { authorization: 'Bearer valid-jwt', 'x-client': 'mustbeviral-cli' },
    });

    expect(restResponse.status).toBe(200);
    expect(cliResponse.status).toBe(200);
    const restBody = (await restResponse.json()) as {
      data: unknown;
      meta?: { request_id?: string };
    };
    const cliBody = (await cliResponse.json()) as { data: unknown; meta?: { request_id?: string } };
    expect(restBody.data).toEqual(cliBody.data);
    expect(typeof restBody.meta?.request_id).toBe('string');
    expect(typeof cliBody.meta?.request_id).toBe('string');
  });
});
