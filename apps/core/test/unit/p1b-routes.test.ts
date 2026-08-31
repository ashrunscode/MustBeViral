import { describe, expect, it, vi } from 'vitest';

import { createCoreApp } from '../../src/app';

describe('P1b management routes', () => {
  it('rejects api key management without a browser JWT', async () => {
    const app = createCoreApp({
      handlers: {} as never,
      jwt: {
        verify: vi.fn(async () => ({
          actorId: 'owner-1',
          authenticationMethod: 'api_key' as const,
          workspaceId: 'workspace-1',
          scopes: ['run:read'] as const,
        })),
      },
      workspaces: { resolve: async () => 'workspace-1' },
    });
    const response = await app.request('http://localhost/v1/workspaces/workspace-1/api-keys', {
      method: 'GET',
      headers: { authorization: 'Bearer mbv_sk_test' },
    });
    expect(response.status).toBe(401);
  });
});
