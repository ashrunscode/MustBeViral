import { describe, expect, it, vi } from 'vitest';

import { createRequestAuthenticator } from '../../src/auth/authenticate';
import { createApiKeyVerifier } from '../../src/auth/api-key';
import { createOAuthTokenVerifier } from '../../src/auth/oauth-token';
import type { CoreBindings } from '../../src/bindings';

describe('programmatic credential auth', () => {
  it('authorizes scoped API keys by operation', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        ok: true,
        key_id: 'key-1',
        workspace_id: 'workspace-1',
        actor_id: 'owner-1',
        scopes: ['run:read'],
      }),
    );
    const apiKeyVerifier = createApiKeyVerifier(fetchMock);
    const bindings = {
      SUPABASE_URL: 'https://example.supabase.co',
      SUPABASE_SECRET_KEY: 'secret',
    } as CoreBindings;
    const actor = await apiKeyVerifier.verify('mbv_sk_test_secret', bindings);
    const authenticator = createRequestAuthenticator({
      verify: vi.fn(),
    });
    expect(actor.workspaceId).toBe('workspace-1');
    expect(authenticator.authorizeOperation(actor, 'get_run')).toBe(true);
    expect(authenticator.authorizeOperation(actor, 'start_run')).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects revoked OAuth tokens from verification RPC', async () => {
    const fetchMock = vi.fn(async () => Response.json({ ok: false }));
    const oauthVerifier = createOAuthTokenVerifier(fetchMock);
    await expect(
      oauthVerifier.verify('mbv_oauth_test_revoked', {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SECRET_KEY: 'secret',
      } as CoreBindings),
    ).rejects.toThrow(/invalid|expired|revoked/i);
  });
});
