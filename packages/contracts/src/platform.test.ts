import { describe, expect, it, vi } from 'vitest';

import { createPlatformHandlers, PLATFORM_OPERATIONS, type PlatformPort } from './platform';

const actor = 'a2000000-0000-4000-8000-000000000001';
const workspace = 'b2000000-0000-4000-8000-000000000001';
const brand = 'c2000000-0000-4000-8000-000000000001';
const context = { actor_id: actor, request_id: 'platform-test-request' };
const brandRecord = {
  id: brand,
  workspace_id: workspace,
  name: 'WashBodega',
  slug: 'washbodega',
  status: 'active',
  version: 1,
  created_by: actor,
  created_at: '2026-09-10T20:00:00+00:00',
  updated_at: '2026-09-10T20:00:00+00:00',
};

describe('platform shared boundary', () => {
  it.each([
    { workspace_id: workspace, name: 'WashBodega', slug: 'washbodega', actor_id: actor },
    { workspace_id: 'not-a-uuid', name: 'WashBodega', slug: 'washbodega' },
    { workspace_id: workspace, name: ' ', slug: 'washbodega' },
    { workspace_id: workspace, name: 'WashBodega', slug: 'bad/slug' },
  ])('rejects malformed or forged command input before the port', async (input) => {
    const execute = vi.fn<PlatformPort['execute']>();
    const result = await createPlatformHandlers({ execute }).execute(
      'create_brand',
      input,
      context,
      'create-key',
    );
    expect(result).toEqual({ status: 'error', code: 'VALIDATION_FAILED' });
    expect(execute).not.toHaveBeenCalled();
  });
  it('requires mutation idempotency and forwards the authenticated actor context', async () => {
    const execute = vi
      .fn<PlatformPort['execute']>()
      .mockResolvedValue({ status: 'ok', data: { record: brandRecord } });
    const handlers = createPlatformHandlers({ execute });
    const input = { workspace_id: workspace, name: 'WashBodega', slug: 'washbodega' };
    expect(await handlers.execute('create_brand', input, context)).toEqual({
      status: 'error',
      code: 'VALIDATION_FAILED',
    });
    expect(await handlers.execute('create_brand', input, context, 'create-key')).toEqual({
      status: 'ok',
      data: { record: brandRecord },
    });
    expect(execute).toHaveBeenCalledExactlyOnceWith({
      operation: 'create_brand',
      input,
      context,
      idempotencyKey: 'create-key',
    });
  });
  it.each([
    'FORBIDDEN',
    'NOT_FOUND',
    'IDEMPOTENCY_CONFLICT',
    'REVISION_CONFLICT',
    'RESOURCE_ARCHIVED',
  ] as const)('preserves authoritative %s without a success substitute', async (code) => {
    const handlers = createPlatformHandlers({ execute: async () => ({ status: 'error', code }) });
    expect(
      await handlers.execute('get_brand', { workspace_id: workspace, brand_id: brand }, context),
    ).toEqual({ status: 'error', code });
  });
  it('rejects malformed output and strips no unexpected sensitive fields into a success', async () => {
    const handlers = createPlatformHandlers({
      execute: async () => ({
        status: 'ok',
        data: { record: { ...brandRecord, token: 'synthetic-secret-canary' } },
      }),
    });
    expect(
      await handlers.execute('get_brand', { workspace_id: workspace, brand_id: brand }, context),
    ).toEqual({ status: 'error', code: 'INTERNAL_ERROR' });
  });
  it.each([0, 101, 1.5, '20'])('rejects invalid pagination %s', (limit) => {
    expect(
      PLATFORM_OPERATIONS.list_brands.input.safeParse({ workspace_id: workspace, limit }).success,
    ).toBe(false);
  });
  it.each([
    ['billing:read'],
    ['brand:write'],
    ['brand:read', 'location:write'],
    ['brand:read', 'brand:read'],
  ])('rejects implicit, incomplete or duplicate action grants %j', (...actions) => {
    expect(
      PLATFORM_OPERATIONS.grant_workspace_access.input.safeParse({
        workspace_id: workspace,
        studio_id: brand,
        actions,
      }).success,
    ).toBe(false);
  });
  it('keeps create and update versions separate', () => {
    expect(
      PLATFORM_OPERATIONS.update_brand.input.safeParse({
        workspace_id: workspace,
        brand_id: brand,
        name: 'UnPile',
        slug: 'unpile',
      }).success,
    ).toBe(false);
    expect(
      PLATFORM_OPERATIONS.create_brand.input.safeParse({
        workspace_id: workspace,
        name: 'UnPile',
        slug: 'unpile',
        expected_version: 1,
      }).success,
    ).toBe(false);
  });
});
