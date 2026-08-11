import { describe, expect, expectTypeOf, it, vi } from 'vitest';

import {
  createMustBeViralRestClient,
  type MustBeViralClientError,
  type P0OperationResponse,
} from './index';

const success = {
  data: { workspace_id: 'workspace-1', role: 'owner' },
  meta: { request_id: 'request-0001' },
};

describe('MustBeViral REST client', () => {
  it('adds the Supabase bearer, idempotency and request headers to mutations', async () => {
    const fetchImplementation = vi.fn(async () => Response.json(success, { status: 201 }));
    const client = createMustBeViralRestClient({
      baseUrl: 'https://core.example.test/',
      getAccessToken: async () => 'session-jwt',
      fetch: fetchImplementation,
      createRequestId: () => 'request-0001',
    });

    const result = await client.request('create_workspace', {
      body: { name: 'Launch workspace' },
      idempotencyKey: 'create-workspace-1',
    });

    expectTypeOf(result).toEqualTypeOf<P0OperationResponse<'create_workspace'>>();
    expect(result).toEqual(success);
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const calls = fetchImplementation.mock.calls as unknown as readonly (readonly [
      RequestInfo | URL,
      RequestInit?,
    ])[];
    const [url, init] = calls[0] ?? [];
    expect(url).toBe('https://core.example.test/v1/workspaces');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer session-jwt');
    expect(headers.get('idempotency-key')).toBe('create-workspace-1');
    expect(headers.get('x-request-id')).toBe('request-0001');
    expect(init?.body).toBe(JSON.stringify({ name: 'Launch workspace' }));
  });

  it('encodes path identifiers and omits Idempotency-Key on reads', async () => {
    const response = {
      error: {
        code: 'NOT_FOUND',
        message: 'The resource was not found.',
        request_id: 'request-0002',
        retryable: false,
      },
    };
    const fetchImplementation = vi.fn(async () => Response.json(response, { status: 404 }));
    const client = createMustBeViralRestClient({
      baseUrl: 'https://core.example.test',
      getAccessToken: async () => 'session-jwt',
      fetch: fetchImplementation,
    });

    await expect(
      client.request('get_workspace', { id: 'workspace/with slash', requestId: 'request-0002' }),
    ).resolves.toEqual(response);
    const calls = fetchImplementation.mock.calls as unknown as readonly (readonly [
      RequestInfo | URL,
      RequestInit?,
    ])[];
    const [url, init] = calls[0] ?? [];
    expect(url).toBe('https://core.example.test/v1/workspaces/workspace%2Fwith%20slash');
    expect(new Headers(init?.headers).has('idempotency-key')).toBe(false);
  });

  it('fails closed without a session or when Core drifts from its response schema', async () => {
    const noSession = createMustBeViralRestClient({
      baseUrl: 'https://core.example.test',
      getAccessToken: async () => null,
      fetch: vi.fn(),
    });
    await expect(noSession.request('get_run', { id: 'run-1' })).rejects.toMatchObject({
      code: 'AUTH_REQUIRED',
    } satisfies Partial<MustBeViralClientError>);

    const drifted = createMustBeViralRestClient({
      baseUrl: 'https://core.example.test',
      getAccessToken: async () => 'session-jwt',
      fetch: async () => Response.json({ data: { status: 'mystery' } }),
    });
    await expect(drifted.request('get_run', { id: 'run-1' })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
    } satisfies Partial<MustBeViralClientError>);
  });
});
