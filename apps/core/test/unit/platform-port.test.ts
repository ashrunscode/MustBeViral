import { describe, expect, it, vi } from 'vitest';
import { createPlatformHandlers } from '@mustbeviral/contracts';

import { createPlatformPort } from '../../src/composition/platform';

const bindings = {
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable',
};
const context = {
  actor_id: 'a2000000-0000-4000-8000-000000000001',
  request_id: 'platform-port-test',
};
const workspace = 'b2000000-0000-4000-8000-000000000001';

describe('platform user-scoped database port', () => {
  it('forwards the caller JWT and never accepts an actor ID as RPC authorization', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ items: [], next_cursor: null }));
    const handlers = createPlatformHandlers(
      createPlatformPort(bindings, 'synthetic-user-jwt', fetcher),
    );
    expect(await handlers.execute('list_brands', { workspace_id: workspace }, context)).toEqual({
      status: 'ok',
      data: { items: [], next_cursor: null },
    });
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe('http://127.0.0.1:54321/rest/v1/rpc/platform_query');
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer synthetic-user-jwt');
    expect(JSON.parse(String(options?.body))).toEqual({
      p_operation: 'list_brands',
      p_input: { workspace_id: workspace },
    });
  });
  it('refuses service-role fallback when the publishable configuration is missing', () => {
    expect(() =>
      createPlatformPort(
        { SUPABASE_URL: bindings.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: 'fixture' },
        'synthetic-user-jwt',
      ),
    ).toThrow('User-scoped platform access is not configured');
  });
  it.each([
    'NOT_FOUND',
    'FORBIDDEN',
    'REVISION_CONFLICT',
    'IDEMPOTENCY_CONFLICT',
    'RESOURCE_ARCHIVED',
    'RESOURCE_CONFLICT',
  ] as const)('preserves the safe database %s outcome', async (code) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { code: 'P0001', message: code, details: 'synthetic-private-detail' },
          { status: 400 },
        ),
      );
    const result = await createPlatformHandlers(
      createPlatformPort(bindings, 'synthetic-user-jwt', fetcher),
    ).execute(
      'create_brand',
      { workspace_id: workspace, name: 'WashBodega', slug: 'washbodega' },
      context,
      'same-key',
    );
    expect(result).toEqual({ status: 'error', code });
    expect(JSON.stringify(result)).not.toContain('synthetic-private-detail');
  });
  it('does not report database unavailability as successful empty data', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('synthetic database connection failure'));
    expect(
      await createPlatformHandlers(
        createPlatformPort(bindings, 'synthetic-user-jwt', fetcher),
      ).execute('list_studios', {}, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
});
