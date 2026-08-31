import type { ApiKeyScope } from '@mustbeviral/contracts';
import type { ProgrammaticAuthPort, P1bHandlerResult } from '@mustbeviral/contracts';

import type { CoreBindings } from '../bindings';
import { SupabaseDataApiError, SupabaseDataApiExecutor } from '../data/supabase-data-api';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mapRpcError(error: unknown): P1bHandlerResult {
  if (!(error instanceof SupabaseDataApiError)) return { status: 'validation_failed' };
  switch (error.kind) {
    case 'forbidden':
      return { status: 'forbidden' };
    case 'not_found':
      return { status: 'not_found' };
    case 'conflict':
      return { status: 'conflict', reason: 'idempotency' };
    default:
      return { status: 'validation_failed' };
  }
}

function parseScopes(value: unknown): readonly ApiKeyScope[] {
  if (!Array.isArray(value) || !value.every((scope) => typeof scope === 'string')) return [];
  return Object.freeze([...(value as ApiKeyScope[])]);
}

function wireTimestamp(value: unknown): string {
  return typeof value === 'string' ? value : new Date(0).toISOString();
}

async function privilegedRpc(
  bindings: CoreBindings,
  functionName: string,
  args: Readonly<Record<string, unknown>>,
  fetchImplementation: typeof fetch = fetch,
): Promise<unknown> {
  const baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
  const privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  if (baseUrl === undefined || privilegedKey === undefined) {
    throw new Error('Supabase privileged access is not configured');
  }
  const response = await fetchImplementation(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      apikey: privilegedKey,
      authorization: `Bearer ${privilegedKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw mapRpcError(new SupabaseDataApiError(response.status >= 500 ? 'internal' : 'validation'));
  }
  return response.json();
}

export function createProgrammaticAuthPort(
  bindings: CoreBindings,
  callerJwt: string,
): ProgrammaticAuthPort {
  const publishableKey = bindings.SUPABASE_PUBLISHABLE_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = bindings.SUPABASE_URL;
  if (baseUrl === undefined || publishableKey === undefined) {
    throw new Error('Supabase user-scoped access is not configured');
  }
  const executor = new SupabaseDataApiExecutor({
    baseUrl,
    publishableKey,
    callerJwt,
  });

  async function selectRows(path: string): Promise<readonly Readonly<Record<string, unknown>>[]> {
    const rows = await executor.request<readonly Readonly<Record<string, unknown>>[]>({ path });
    return rows;
  }

  async function callRpc(
    functionName: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<unknown> {
    return executor.request({
      method: 'POST',
      path: `rpc/${encodeURIComponent(functionName)}`,
      body: args,
    });
  }

  return {
    async createApiKey(input) {
      try {
        const payload = await callRpc('create_api_key', {
          p_workspace_id: input.context.workspace_id,
          p_name: input.name,
          p_scopes: [...input.scopes],
          p_prefix: input.prefix,
          p_secret_hash: input.secretHash,
          p_idempotency_key: input.idempotency_key,
          p_request_id: input.context.request_id,
        });
        if (!isRecord(payload)) return { status: 'validation_failed' };
        return {
          status: 'ok',
          data: {
            key: {
              id: String(payload.key_id),
              name: String(payload.name),
              prefix: String(payload.prefix),
              scopes: parseScopes(payload.scopes),
              created_at: wireTimestamp(payload.created_at),
              last_used_at: null,
              revoked_at: null,
            },
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async listApiKeys(input) {
      try {
        const rows = await selectRows(
          `api_keys?workspace_id=eq.${encodeURIComponent(input.context.workspace_id)}&select=id,name,prefix,scopes,created_at,last_used_at,revoked_at&order=created_at.desc`,
        );
        return {
          status: 'ok',
          data: {
            keys: rows.map((row) => ({
              id: String(row.id),
              name: String(row.name),
              prefix: String(row.prefix),
              scopes: parseScopes(row.scopes),
              created_at: wireTimestamp(row.created_at),
              last_used_at:
                row.last_used_at === null || row.last_used_at === undefined
                  ? null
                  : wireTimestamp(row.last_used_at),
              revoked_at:
                row.revoked_at === null || row.revoked_at === undefined
                  ? null
                  : wireTimestamp(row.revoked_at),
            })),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async revokeApiKey(input) {
      try {
        const payload = await callRpc('revoke_api_key', {
          p_key_id: input.key_id,
          p_request_id: input.context.request_id,
        });
        if (!isRecord(payload)) return { status: 'validation_failed' };
        return {
          status: 'ok',
          data: {
            key_id: String(payload.key_id),
            revoked_at: wireTimestamp(payload.revoked_at),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async createOAuthClient(input) {
      try {
        const payload = await callRpc('create_oauth_client', {
          p_workspace_id: input.context.workspace_id,
          p_name: input.name,
          p_client_id: input.clientId,
          p_client_secret_hash: input.clientSecretHash,
          p_scopes: [...input.scopes],
          p_idempotency_key: input.idempotency_key,
          p_request_id: input.context.request_id,
        });
        if (!isRecord(payload)) return { status: 'validation_failed' };
        return {
          status: 'ok',
          data: {
            client: {
              id: String(payload.client_uuid),
              client_id: String(payload.client_id),
              name: String(payload.name),
              scopes: parseScopes(payload.scopes),
              created_at: wireTimestamp(payload.created_at),
              revoked_at: null,
            },
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async listOAuthClients(input) {
      try {
        const rows = await selectRows(
          `oauth_clients?workspace_id=eq.${encodeURIComponent(input.context.workspace_id)}&select=id,client_id,name,scopes,created_at,revoked_at&order=created_at.desc`,
        );
        return {
          status: 'ok',
          data: {
            clients: rows.map((row) => ({
              id: String(row.id),
              client_id: String(row.client_id),
              name: String(row.name),
              scopes: parseScopes(row.scopes),
              created_at: wireTimestamp(row.created_at),
              revoked_at:
                row.revoked_at === null || row.revoked_at === undefined
                  ? null
                  : wireTimestamp(row.revoked_at),
            })),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async revokeOAuthClient(input) {
      try {
        const payload = await callRpc('revoke_oauth_client', {
          p_client_uuid: input.client_uuid,
          p_request_id: input.context.request_id,
        });
        if (!isRecord(payload)) return { status: 'validation_failed' };
        return {
          status: 'ok',
          data: {
            client_uuid: String(payload.client_uuid),
            revoked_at: wireTimestamp(payload.revoked_at),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async issueOAuthToken(input) {
      try {
        const payload = await privilegedRpc(bindings, 'issue_oauth_access_token', {
          p_client_id: input.clientId,
          p_client_secret_hash: input.clientSecretHash,
          p_token_hash: input.tokenHash,
          p_expires_at: input.expiresAt,
        });
        if (!isRecord(payload) || payload.ok !== true) return { status: 'unauthenticated' };
        return {
          status: 'ok',
          data: {
            scopes: parseScopes(payload.scopes),
            expires_at: wireTimestamp(payload.expires_at),
          },
        };
      } catch (error) {
        if (error !== null && typeof error === 'object' && 'status' in error) {
          return error as P1bHandlerResult;
        }
        return { status: 'unauthenticated' };
      }
    },
    async publishSkill(input) {
      try {
        const payload = await callRpc('publish_skill', {
          p_workspace_id: input.context.workspace_id,
          p_name: input.name,
          p_title: input.title,
          p_instructions: input.instructions,
          p_idempotency_key: input.idempotency_key,
          p_request_id: input.context.request_id,
        });
        if (!isRecord(payload)) return { status: 'validation_failed' };
        return {
          status: 'ok',
          data: {
            skill_id: String(payload.skill_id),
            skill_version_id: String(payload.skill_version_id),
            name: String(payload.name),
            version_number: Number(payload.version_number),
            title: String(payload.title),
            published_at: wireTimestamp(payload.published_at),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async listSkills(input) {
      try {
        const skills = await selectRows(
          `skills?workspace_id=eq.${encodeURIComponent(input.context.workspace_id)}&select=id,name&order=name.asc`,
        );
        const skillIds = skills.map((skill) => String(skill.id));
        const versions =
          skillIds.length === 0
            ? []
            : await selectRows(
                `skill_versions?skill_id=in.(${skillIds.map(encodeURIComponent).join(',')})&select=id,skill_id,version_number,title,published_at&order=version_number.desc`,
              );
        const latestBySkill = new Map<string, (typeof versions)[number]>();
        for (const version of versions) {
          const skillId = String(version.skill_id);
          if (!latestBySkill.has(skillId)) latestBySkill.set(skillId, version);
        }
        return {
          status: 'ok',
          data: {
            skills: skills.map((skill) => {
              const latest = latestBySkill.get(String(skill.id));
              return {
                id: String(skill.id),
                name: String(skill.name),
                latest_version:
                  latest === undefined
                    ? null
                    : {
                        skill_id: String(skill.id),
                        skill_version_id: String(latest.id),
                        name: String(skill.name),
                        version_number: Number(latest.version_number),
                        title: String(latest.title),
                        published_at: wireTimestamp(latest.published_at),
                      },
              };
            }),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
    async listSkillVersions(input) {
      try {
        const skills = await selectRows(
          `skills?id=eq.${encodeURIComponent(input.skill_id)}&workspace_id=eq.${encodeURIComponent(input.context.workspace_id)}&select=id,name`,
        );
        if (skills.length === 0) return { status: 'not_found' };
        const skill = skills[0];
        if (skill === undefined) return { status: 'not_found' };
        const versions = await selectRows(
          `skill_versions?skill_id=eq.${encodeURIComponent(input.skill_id)}&select=id,skill_id,version_number,title,instructions,published_at&order=version_number.desc`,
        );
        return {
          status: 'ok',
          data: {
            skill_id: String(skill.id),
            name: String(skill.name),
            versions: versions.map((version) => ({
              skill_id: String(version.skill_id),
              skill_version_id: String(version.id),
              version_number: Number(version.version_number),
              title: String(version.title),
              instructions: String(version.instructions),
              published_at: wireTimestamp(version.published_at),
            })),
          },
        };
      } catch (error) {
        return mapRpcError(error);
      }
    },
  };
}
export function createPrivilegedProgrammaticAuthPort(
  bindings: CoreBindings,
): Pick<ProgrammaticAuthPort, 'issueOAuthToken'> {
  return {
    async issueOAuthToken(input) {
      try {
        const payload = await privilegedRpc(bindings, 'issue_oauth_access_token', {
          p_client_id: input.clientId,
          p_client_secret_hash: input.clientSecretHash,
          p_token_hash: input.tokenHash,
          p_expires_at: input.expiresAt,
        });
        if (!isRecord(payload) || payload.ok !== true) return { status: 'unauthenticated' };
        return {
          status: 'ok',
          data: {
            scopes: parseScopes(payload.scopes),
            expires_at: wireTimestamp(payload.expires_at),
          },
        };
      } catch (error) {
        if (error !== null && typeof error === 'object' && 'status' in error) {
          return error as P1bHandlerResult;
        }
        return { status: 'unauthenticated' };
      }
    },
  };
}
