import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ApiKeysAccessPanel } from './api-keys-access-panel';

vi.mock('../../lib/core/p1b-client', () => ({
  createP1bManagementClient: async () => ({
    listApiKeys: async () => [
      {
        id: 'key-1',
        name: 'CI automation',
        prefix: 'mbv_sk_abcd',
        scopes: ['run:read'],
        created_at: '2026-08-31T12:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
      {
        id: 'key-2',
        name: 'Retired key',
        prefix: 'mbv_sk_dead',
        scopes: ['canvas:read'],
        created_at: '2026-08-30T12:00:00Z',
        last_used_at: '2026-08-31T10:00:00Z',
        revoked_at: '2026-08-31T11:00:00Z',
      },
    ],
    createApiKey: async () => ({
      secret: 'mbv_sk_' + 'a'.repeat(64),
      key: {
        id: 'key-3',
        name: 'New',
        prefix: 'mbv_sk_new',
        scopes: ['run:read'],
        created_at: '2026-08-31T13:00:00Z',
        last_used_at: null,
        revoked_at: null,
      },
    }),
    revokeApiKey: async () => undefined,
  }),
}));

describe('ApiKeysAccessPanel', () => {
  it('renders audit shell and non-autonomous spend copy', () => {
    const html = renderToStaticMarkup(<ApiKeysAccessPanel workspaceId="workspace-1" />);
    expect(html).toContain('API keys and audit');
    expect(html).toContain('Loading keys');
    expect(html).toContain('cannot bypass quote confirmation');
    expect(html).toContain('Create API key');
  });
});
