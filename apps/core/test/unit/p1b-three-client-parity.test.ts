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

const publishSkillResult = {
  status: 'ok' as const,
  data: {
    skill_id: 'skill-1',
    skill_version_id: 'version-2',
    name: 'launch-copy',
    version_number: 2,
    title: 'Launch copy',
    published_at: '2026-08-31T12:00:00Z',
  },
};

const listSkillsResult = {
  status: 'ok' as const,
  data: {
    skills: [
      {
        id: 'skill-1',
        name: 'launch-copy',
        latest_version: {
          skill_id: 'skill-1',
          skill_version_id: 'version-2',
          name: 'launch-copy',
          version_number: 2,
          title: 'Launch copy',
          published_at: '2026-08-31T12:00:00Z',
        },
      },
    ],
  },
};

const listSkillVersionsResult = {
  status: 'ok' as const,
  data: {
    skill_id: 'skill-1',
    name: 'launch-copy',
    versions: [
      {
        skill_id: 'skill-1',
        skill_version_id: 'version-1',
        version_number: 1,
        title: 'Launch copy',
        instructions: 'Write concise launch copy.',
        published_at: '2026-08-31T11:00:00Z',
      },
    ],
  },
};

function createApp(portOverrides: Partial<ReturnType<typeof createPort>> = {}) {
  const port = createPort(portOverrides);
  const handlers = createP1bHandlers(port, workerCredentialGenerator);
  return createCoreApp({
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
}

function createPort(
  overrides: Partial<{
    listApiKeys: () => Promise<typeof listKeysResult>;
    publishSkill: () => Promise<typeof publishSkillResult>;
    listSkills: () => Promise<typeof listSkillsResult>;
    listSkillVersions: () => Promise<typeof listSkillVersionsResult>;
    revokeApiKey: () => Promise<{ status: 'not_found' }>;
  }> = {},
) {
  return {
    createApiKey: vi.fn(),
    listApiKeys: vi.fn(async () => listKeysResult),
    revokeApiKey: vi.fn(async () => ({ status: 'not_found' as const })),
    createOAuthClient: vi.fn(),
    listOAuthClients: vi.fn(),
    revokeOAuthClient: vi.fn(),
    issueOAuthToken: vi.fn(),
    publishSkill: vi.fn(async () => publishSkillResult),
    listSkills: vi.fn(async () => listSkillsResult),
    listSkillVersions: vi.fn(async () => listSkillVersionsResult),
    ...overrides,
  };
}

async function restAndBrowserFetch(
  app: ReturnType<typeof createApp>,
  path: string,
  init: Readonly<{ method: 'GET' | 'POST'; headers?: Record<string, string>; body?: string }>,
) {
  const restResponse = await app.request(`http://localhost${path}`, {
    method: init.method,
    headers: { authorization: 'Bearer valid-jwt', ...init.headers },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  const browserResponse = await app.request(`http://localhost${path}`, {
    method: init.method,
    headers: {
      authorization: 'Bearer valid-jwt',
      'x-client': 'mustbeviral-browser',
      ...init.headers,
    },
    ...(init.body === undefined ? {} : { body: init.body }),
  });
  return { restResponse, browserResponse };
}

describe('P1b three-client parity for JWT management', () => {
  it('returns identical envelopes for list_api_keys across REST and browser fetch', async () => {
    const app = createApp();
    const { restResponse, browserResponse } = await restAndBrowserFetch(
      app,
      '/v1/workspaces/workspace-1/api-keys',
      { method: 'GET' },
    );

    expect(restResponse.status).toBe(200);
    expect(browserResponse.status).toBe(200);
    const restBody = (await restResponse.json()) as { data: unknown };
    const browserBody = (await browserResponse.json()) as { data: unknown };
    expect(restBody.data).toEqual(browserBody.data);
  });

  it('returns identical envelopes for list_skills across REST and browser fetch', async () => {
    const app = createApp();
    const { restResponse, browserResponse } = await restAndBrowserFetch(
      app,
      '/v1/workspaces/workspace-1/skills',
      { method: 'GET' },
    );

    expect(restResponse.status).toBe(200);
    expect(browserResponse.status).toBe(200);
    const restBody = (await restResponse.json()) as { data: unknown };
    const browserBody = (await browserResponse.json()) as { data: unknown };
    expect(restBody.data).toEqual(browserBody.data);
  });

  it('returns identical envelopes for list_skill_versions across REST and browser fetch', async () => {
    const app = createApp();
    const { restResponse, browserResponse } = await restAndBrowserFetch(
      app,
      '/v1/workspaces/workspace-1/skills/skill-1/versions',
      { method: 'GET' },
    );

    expect(restResponse.status).toBe(200);
    expect(browserResponse.status).toBe(200);
    const restBody = (await restResponse.json()) as { data: unknown };
    const browserBody = (await browserResponse.json()) as { data: unknown };
    expect(restBody.data).toEqual(browserBody.data);
  });

  it('returns identical envelopes for publish_skill across REST and browser fetch', async () => {
    const app = createApp();
    const body = JSON.stringify({
      name: 'launch-copy',
      title: 'Launch copy',
      instructions: 'Write concise launch copy.',
    });
    const { restResponse, browserResponse } = await restAndBrowserFetch(
      app,
      '/v1/workspaces/workspace-1/skills/publish',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'vector-idem-skill-1',
        },
        body,
      },
    );

    expect(restResponse.status).toBe(201);
    expect(browserResponse.status).toBe(201);
    const restBody = (await restResponse.json()) as { data: unknown };
    const browserBody = (await browserResponse.json()) as { data: unknown };
    expect(restBody.data).toEqual(browserBody.data);
  });

  it('returns identical not_found envelopes for revoke_api_key across REST and CLI-style fetch', async () => {
    const app = createApp();
    const { restResponse, browserResponse } = await restAndBrowserFetch(
      app,
      '/v1/api-keys/key-missing/revoke',
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'vector-idem-revoke-1',
          'x-workspace-id': 'workspace-1',
        },
      },
    );
    const cliResponse = await app.request('http://localhost/v1/api-keys/key-missing/revoke', {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid-jwt',
        'x-client': 'mustbeviral-cli',
        'content-type': 'application/json',
        'idempotency-key': 'vector-idem-revoke-1',
        'x-workspace-id': 'workspace-1',
      },
    });

    expect(restResponse.status).toBe(404);
    expect(browserResponse.status).toBe(404);
    expect(cliResponse.status).toBe(404);
    const restBody = (await restResponse.json()) as { error: { code: string } };
    const browserBody = (await browserResponse.json()) as { error: { code: string } };
    const cliBody = (await cliResponse.json()) as { error: { code: string } };
    expect(restBody.error.code).toBe('NOT_FOUND');
    expect(browserBody.error.code).toBe('NOT_FOUND');
    expect(cliBody.error.code).toBe('NOT_FOUND');
  });

  it('rejects API keys on JWT-only management routes', async () => {
    const port = createPort();
    const handlers = createP1bHandlers(port, workerCredentialGenerator);
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
      p1bHandlers: handlers,
    });

    const response = await app.request('http://localhost/v1/workspaces/workspace-1/skills', {
      method: 'GET',
      headers: { authorization: 'Bearer valid-jwt' },
    });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(port.listSkills).not.toHaveBeenCalled();
  });
});
