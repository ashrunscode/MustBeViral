import { describe, expect, it, vi, beforeEach } from 'vitest';

import { createP1bManagementClient } from './p1b-client';

const sessionToken = 'browser-session-jwt';

vi.mock('../supabase/client', () => ({
  createBrowserSupabaseClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { access_token: sessionToken } },
        error: null,
      }),
    },
  }),
}));

vi.mock('../../config/public-environment', () => ({
  readWebPublicEnvironment: () => ({
    NEXT_PUBLIC_CORE_API_URL: 'https://core.example.test',
  }),
}));

vi.mock('./browser-client', () => ({
  resolveBrowserCoreBaseUrl: (url: string) => url,
}));

describe('P1b browser management client REST parity', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('issues JWT management requests against the same /v1 routes as REST adapters', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      Response.json({
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
      }),
    );

    const client = await createP1bManagementClient();
    await client.listApiKeys('workspace-1');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://core.example.test/v1/workspaces/workspace-1/api-keys');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('authorization')).toBe(`Bearer ${sessionToken}`);
  });

  it('uses idempotency keys and workspace headers for revoke_api_key', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(Response.json({ data: { key_id: 'key-1' } }));

    const client = await createP1bManagementClient();
    await client.revokeApiKey('key-1', 'workspace-1');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://core.example.test/v1/api-keys/key-1/revoke');
    const headers = new Headers(init.headers);
    expect(headers.get('authorization')).toBe(`Bearer ${sessionToken}`);
    expect(headers.get('x-workspace-id')).toBe('workspace-1');
    expect(headers.get('idempotency-key')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u,
    );
  });

  it('targets skill management routes that are not exposed on CLI or MCP', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      Response.json({
        data: {
          skill_id: 'skill-1',
          name: 'launch-copy',
          versions: [],
        },
      }),
    );

    const client = await createP1bManagementClient();
    await client.listSkillVersions('workspace-1', 'skill-1');

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe('https://core.example.test/v1/workspaces/workspace-1/skills/skill-1/versions');
  });
});
