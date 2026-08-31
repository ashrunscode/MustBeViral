'use client';

import { API_KEY_SCOPES, type ApiKeyScope } from '@mustbeviral/contracts';
import { Button, Dialog, LedgerTable, MonoCaps } from '@mustbeviral/ui';
import { useCallback, useEffect, useState } from 'react';

import { createP1bManagementClient, type ApiKeyListItem } from '../../lib/core/p1b-client';

const DEFAULT_SCOPES: readonly ApiKeyScope[] = ['run:read', 'canvas:read'];

function formatTimestamp(value: string | null): string {
  if (value === null) return 'Never';
  return value.replace('T', ' ').replace(/\.\d+Z$/u, ' UTC');
}

function scopeLabel(scope: ApiKeyScope): string {
  return scope.replace(':', ' · ');
}

export function ApiKeysAccessPanel({ workspaceId }: Readonly<{ workspaceId: string }>) {
  const [keys, setKeys] = useState<readonly ApiKeyListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [name, setName] = useState('Automation key');
  const [selectedScopes, setSelectedScopes] = useState<readonly ApiKeyScope[]>(DEFAULT_SCOPES);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      const listed = await client.listApiKeys(workspaceId);
      setKeys(listed);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'API keys are unavailable in this environment.',
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    async function loadKeys() {
      setError(null);
      try {
        const client = await createP1bManagementClient();
        const listed = await client.listApiKeys(workspaceId);
        if (!cancelled) setKeys(listed);
      } catch (cause) {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'API keys are unavailable in this environment.',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadKeys();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      const created = await client.createApiKey(workspaceId, {
        name,
        scopes: [...selectedScopes],
      });
      setCreatedSecret(created.secret);
      setCreateOpen(false);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The API key could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setBusy(true);
    setError(null);
    try {
      const client = await createP1bManagementClient();
      await client.revokeApiKey(keyId);
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The API key could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  function toggleScope(scope: ApiKeyScope) {
    setSelectedScopes((current) =>
      current.includes(scope) ? current.filter((entry) => entry !== scope) : [...current, scope],
    );
  }

  return (
    <main className="access-panel" id="main-content">
      <section className="access-panel__card" aria-labelledby="access-heading">
        <MonoCaps>Programmatic access</MonoCaps>
        <h1 id="access-heading">API keys and audit</h1>
        <p>
          Scoped keys authorize REST, MCP, and CLI automation. Keys cannot bypass quote confirmation
          or spend autonomously. Revocation is immediate.
        </p>
        <div className="access-panel__actions">
          <Button type="button" onClick={() => setCreateOpen(true)} disabled={busy}>
            Create API key
          </Button>
        </div>
        {error === null ? null : (
          <p className="access-panel__error" role="alert">
            {error}
          </p>
        )}
      </section>

      <section className="access-panel__card" aria-labelledby="keys-heading">
        <MonoCaps>Workspace keys</MonoCaps>
        <h2 id="keys-heading">Issued credentials</h2>
        {loading ? <p role="status">Loading keys…</p> : null}
        {!loading && keys.length === 0 ? (
          <p>No API keys yet. Create one for automation with explicit scopes.</p>
        ) : null}
        {!loading && keys.length > 0 ? (
          <LedgerTable>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Prefix</th>
                <th scope="col">Scopes</th>
                <th scope="col">Last used</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td>
                    <code>{key.prefix}…</code>
                  </td>
                  <td>{key.scopes.map(scopeLabel).join(', ')}</td>
                  <td>{formatTimestamp(key.last_used_at)}</td>
                  <td>
                    <span
                      className={`access-status access-status--${key.revoked_at === null ? 'active' : 'revoked'}`}
                    >
                      {key.revoked_at === null ? 'Active' : 'Revoked'}
                    </span>
                  </td>
                  <td>
                    {key.revoked_at === null ? (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void handleRevoke(key.id)}
                      >
                        Revoke
                      </Button>
                    ) : (
                      formatTimestamp(key.revoked_at)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </LedgerTable>
        ) : null}
      </section>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create scoped API key"
        description="Choose the minimum scopes required. The secret is shown once."
      >
        <label className="access-panel__field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
        </label>
        <fieldset className="access-panel__scopes">
          <legend>Scopes</legend>
          {API_KEY_SCOPES.map((scope) => (
            <label key={scope} className="access-panel__scope">
              <input
                type="checkbox"
                checked={selectedScopes.includes(scope)}
                onChange={() => toggleScope(scope)}
              />
              <span>{scopeLabel(scope)}</span>
            </label>
          ))}
        </fieldset>
        <div className="access-panel__actions">
          <Button
            type="button"
            disabled={busy || selectedScopes.length === 0}
            onClick={() => void handleCreate()}
          >
            Issue key
          </Button>
          <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={createdSecret !== null}
        onClose={() => setCreatedSecret(null)}
        title="Copy your API key now"
        description="This secret cannot be shown again. Store it in your OS credential manager."
      >
        {createdSecret === null ? null : (
          <>
            <code className="access-panel__secret">{createdSecret}</code>
            <p>Programmatic clients must still confirm quotes before any paid run.</p>
            <Button type="button" onClick={() => setCreatedSecret(null)}>
              I saved the secret
            </Button>
          </>
        )}
      </Dialog>
    </main>
  );
}
