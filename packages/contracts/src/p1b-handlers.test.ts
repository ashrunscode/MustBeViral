import { describe, expect, it, vi } from 'vitest';

import { createP1bHandlers } from './p1b-handlers';
import type { ProgrammaticAuthPort } from './p1b';

describe('P1b handlers', () => {
  it('returns api key secret only on create', async () => {
    const port: ProgrammaticAuthPort = {
      createApiKey: vi.fn(async () => ({
        status: 'ok' as const,
        data: {
          key: {
            id: 'key-1',
            name: 'Automation',
            prefix: 'mbv_sk_abcd',
            scopes: ['run:read'],
            created_at: '2026-08-31T12:00:00Z',
            last_used_at: null,
            revoked_at: null,
          },
        },
      })),
      listApiKeys: vi.fn(),
      revokeApiKey: vi.fn(),
      createOAuthClient: vi.fn(),
      listOAuthClients: vi.fn(),
      revokeOAuthClient: vi.fn(),
      issueOAuthToken: vi.fn(),
      publishSkill: vi.fn(),
      listSkills: vi.fn(),
    };
    const handlers = createP1bHandlers(port, {
      generateApiKey: () => ({ token: `mbv_sk_${'b'.repeat(64)}`, prefix: 'mbv_sk_bbbb' }),
      generateOAuthClient: () => ({ clientId: 'mbv_client_x', clientSecret: 'mbv_client_secret' }),
      generateOAuthAccessToken: () => ({ token: `mbv_oauth_${'c'.repeat(64)}` }),
      hashSecret: async (value) => `hash:${value}`,
    });
    const result = await handlers.create_api_key({
      context: {
        workspace_id: 'workspace-1',
        actor_id: 'owner-1',
        request_id: 'req-1',
      },
      workspace_id: 'workspace-1',
      idempotency_key: 'idem-1',
      name: 'Automation',
      scopes: ['run:read'],
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toMatchObject({ secret: expect.stringMatching(/^mbv_sk_/) });
    }
  });

  it('issues oauth tokens from client credentials without exposing storage secrets', async () => {
    const port: ProgrammaticAuthPort = {
      createApiKey: vi.fn(),
      listApiKeys: vi.fn(),
      revokeApiKey: vi.fn(),
      createOAuthClient: vi.fn(),
      listOAuthClients: vi.fn(),
      revokeOAuthClient: vi.fn(),
      issueOAuthToken: vi.fn(async () => ({
        status: 'ok' as const,
        data: { scopes: ['run:read'] as const, expires_at: '2026-08-31T13:00:00Z' },
      })),
      publishSkill: vi.fn(),
      listSkills: vi.fn(),
    };
    const handlers = createP1bHandlers(port, {
      generateApiKey: () => ({ token: 'mbv_sk_x', prefix: 'mbv_sk_x' }),
      generateOAuthClient: () => ({ clientId: 'mbv_client_x', clientSecret: 'mbv_client_secret' }),
      generateOAuthAccessToken: () => ({ token: `mbv_oauth_${'d'.repeat(64)}` }),
      hashSecret: async (value) => `hash:${value}`,
    });
    const result = await handlers.issue_oauth_token({
      clientId: 'mbv_client_x',
      clientSecret: 'mbv_client_secret',
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toMatchObject({
        access_token: expect.stringMatching(/^mbv_oauth_/),
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
  });

  it('returns immutable skill version metadata on publish', async () => {
    const port: ProgrammaticAuthPort = {
      createApiKey: vi.fn(),
      listApiKeys: vi.fn(),
      revokeApiKey: vi.fn(),
      createOAuthClient: vi.fn(),
      listOAuthClients: vi.fn(),
      revokeOAuthClient: vi.fn(),
      issueOAuthToken: vi.fn(),
      publishSkill: vi.fn(async () => ({
        status: 'ok' as const,
        data: {
          skill_id: 'skill-1',
          skill_version_id: 'version-2',
          name: 'launch-copy',
          version_number: 2,
          title: 'Launch copy',
          published_at: '2026-08-31T12:00:00Z',
        },
      })),
      listSkills: vi.fn(),
    };
    const handlers = createP1bHandlers(port, {
      generateApiKey: () => ({ token: 'mbv_sk_x', prefix: 'mbv_sk_x' }),
      generateOAuthClient: () => ({ clientId: 'mbv_client_x', clientSecret: 'mbv_client_secret' }),
      generateOAuthAccessToken: () => ({ token: 'mbv_oauth_x' }),
      hashSecret: async (value) => `hash:${value}`,
    });
    const result = await handlers.publish_skill({
      context: {
        workspace_id: 'workspace-1',
        actor_id: 'owner-1',
        request_id: 'req-1',
      },
      workspace_id: 'workspace-1',
      idempotency_key: 'idem-skill-1',
      name: 'launch-copy',
      title: 'Launch copy',
      instructions: 'Write concise launch copy.',
    });
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data).toMatchObject({ version_number: 2, skill_version_id: 'version-2' });
    }
  });
});
