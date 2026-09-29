import type { ApiKeyScope } from '@mustbeviral/contracts';

import { createBrowserSupabaseClient } from '../supabase/client';
import { resolveBrowserCoreBaseUrl } from './browser-client';
import { readWebPublicEnvironment } from '../../config/public-environment';

export interface ApiKeyListItem {
  readonly id: string;
  readonly name: string;
  readonly prefix: string;
  readonly scopes: readonly ApiKeyScope[];
  readonly created_at: string;
  readonly last_used_at: string | null;
  readonly revoked_at: string | null;
}

export interface SkillListItem {
  readonly id: string;
  readonly name: string;
  readonly latest_version: Readonly<{
    readonly skill_id: string;
    readonly skill_version_id: string;
    readonly name: string;
    readonly version_number: number;
    readonly title: string;
    readonly published_at: string;
  }> | null;
}

export interface SkillVersionDetail {
  readonly skill_id: string;
  readonly skill_version_id: string;
  readonly version_number: number;
  readonly title: string;
  readonly instructions: string;
  readonly published_at: string;
}

export interface PublishSkillInput {
  readonly name: string;
  readonly title: string;
  readonly instructions: string;
}

export interface PublishSkillResult {
  readonly skill_id: string;
  readonly skill_version_id: string;
  readonly name: string;
  readonly version_number: number;
  readonly title: string;
  readonly published_at: string;
}

interface ApiEnvelope<T> {
  readonly data: T;
}

async function accessToken(): Promise<string> {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.auth.getSession();
  if (error !== null || data.session?.access_token === undefined) {
    throw new Error('Sign in is required to manage API keys.');
  }
  return data.session.access_token;
}

function coreBaseUrl(): string {
  const environment = readWebPublicEnvironment();
  return resolveBrowserCoreBaseUrl(
    environment.NEXT_PUBLIC_CORE_API_URL,
    typeof window === 'undefined' ? undefined : window.location.origin,
  );
}

async function request<T>(
  path: string,
  init: Readonly<{
    method: 'GET' | 'POST';
    body?: unknown;
    idempotencyKey?: string;
    workspaceId?: string;
  }>,
): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`${coreBaseUrl()}${path}`, {
    method: init.method,
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.idempotencyKey === undefined ? {} : { 'idempotency-key': init.idempotencyKey }),
      ...(init.workspaceId === undefined ? {} : { 'x-workspace-id': init.workspaceId }),
    },
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });
  const payload = (await response.json()) as ApiEnvelope<T> | { error: { message: string } };
  if (!response.ok) {
    const message = 'error' in payload ? payload.error.message : 'Request failed.';
    throw new Error(message);
  }
  return (payload as ApiEnvelope<T>).data;
}

export interface P1bManagementClient {
  listApiKeys(workspaceId: string): Promise<readonly ApiKeyListItem[]>;
  createApiKey(
    workspaceId: string,
    input: Readonly<{ name: string; scopes: readonly ApiKeyScope[] }>,
  ): Promise<Readonly<{ secret: string; key: ApiKeyListItem }>>;
  revokeApiKey(keyId: string, workspaceId: string): Promise<void>;
  listSkills(workspaceId: string): Promise<readonly SkillListItem[]>;
  listSkillVersions(
    workspaceId: string,
    skillId: string,
  ): Promise<Readonly<{ skill_id: string; name: string; versions: readonly SkillVersionDetail[] }>>;
  publishSkill(workspaceId: string, input: PublishSkillInput): Promise<PublishSkillResult>;
}

export async function createP1bManagementClient(): Promise<P1bManagementClient> {
  return {
    async listApiKeys(workspaceId) {
      const data = await request<{ keys: readonly ApiKeyListItem[] }>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
        { method: 'GET' },
      );
      return data.keys;
    },
    async createApiKey(workspaceId, input) {
      return request<{ secret: string; key: ApiKeyListItem }>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/api-keys`,
        {
          method: 'POST',
          body: input,
          idempotencyKey: crypto.randomUUID(),
        },
      );
    },
    async revokeApiKey(keyId, workspaceId) {
      await request<{ key_id: string }>(`/v1/api-keys/${encodeURIComponent(keyId)}/revoke`, {
        method: 'POST',
        idempotencyKey: crypto.randomUUID(),
        workspaceId,
      });
    },
    async listSkills(workspaceId) {
      const data = await request<{ skills: readonly SkillListItem[] }>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/skills`,
        { method: 'GET' },
      );
      return data.skills;
    },
    async listSkillVersions(workspaceId, skillId) {
      return request<{ skill_id: string; name: string; versions: readonly SkillVersionDetail[] }>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/skills/${encodeURIComponent(skillId)}/versions`,
        { method: 'GET' },
      );
    },
    async publishSkill(workspaceId, input) {
      return request<PublishSkillResult>(
        `/v1/workspaces/${encodeURIComponent(workspaceId)}/skills/publish`,
        {
          method: 'POST',
          body: input,
          idempotencyKey: crypto.randomUUID(),
        },
      );
    },
  };
}
