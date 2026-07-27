import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SupabaseDataApiError,
  SupabaseDataApiExecutor,
  mapSupabaseFailure,
} from '../../src/data/supabase-data-api';

function jsonResponse(status: number, body: unknown): Response {
  return Response.json(body, { status });
}

describe('Supabase Data API executor', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('forwards the verified caller JWT and public apikey without a service identity', async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse(200, [{ id: 'workspace-1' }]));
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co/',
      publishableKey: 'sb_publishable_fixture',
      callerJwt: 'verified-caller-jwt',
      fetch: fetchImplementation,
    });

    await executor.select('workspaces', { id: 'eq.workspace-1', select: '*' });

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/workspaces?id=eq.workspace-1&select=*',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'sb_publishable_fixture',
          authorization: 'Bearer verified-caller-jwt',
        }),
      }),
    );
    expect(JSON.stringify(fetchImplementation.mock.calls)).not.toContain('service_role');
  });

  it('uses representation preference for RPCs and mutations', async () => {
    const fetchImplementation = vi.fn(async () => jsonResponse(200, { workspace_id: 'one' }));
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-key',
      callerJwt: 'caller-jwt',
      fetch: fetchImplementation,
    });

    await executor.rpc('create_workspace', {
      p_name: 'Launch',
      p_slug: 'launch',
      p_idempotency_key: 'idem-1',
      p_request_id: 'request-1',
    });

    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://project.supabase.co/rest/v1/rpc/create_workspace',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ prefer: 'return=representation' }),
      }),
    );
  });

  it.each([
    [401, { code: 'PGRST301', message: 'invalid token' }, 'forbidden'],
    [403, { code: '42501', message: 'permission denied' }, 'forbidden'],
    [406, { code: 'PGRST116', message: 'singular response' }, 'not_found'],
    [409, { code: '23505', message: 'duplicate key' }, 'conflict'],
    [400, { code: 'P0001', message: 'IDEMPOTENCY_CONFLICT' }, 'conflict'],
    [400, { code: 'P0001', message: 'REVISION_CONFLICT' }, 'conflict'],
    [400, { code: 'P0001', message: 'QUOTE_STALE' }, 'conflict'],
    [400, { code: 'P0001', message: 'QUOTE_ALREADY_USED' }, 'conflict'],
    [400, { code: 'P0001', message: 'QUOTE_EXPIRED' }, 'expired_quote'],
    [400, { code: 'P0001', message: 'BUDGET_EXCEEDED' }, 'cap_exceeded'],
    [400, { code: 'P0001', message: 'INSUFFICIENT_BALANCE' }, 'cap_exceeded'],
    [400, { code: 'P0001', message: 'GRAPH_INVALID' }, 'graph_invalid'],
    [400, { code: 'P0002', message: 'NOT_FOUND' }, 'not_found'],
    [400, { code: 'P0002', message: 'RESERVATION_NOT_FOUND' }, 'not_found'],
    [400, { code: '42501', message: 'FORBIDDEN' }, 'forbidden'],
    [400, { code: '42501', message: 'WORKSPACE_UNAVAILABLE' }, 'forbidden'],
    [400, { code: '22023', message: 'VALIDATION_FAILED' }, 'validation'],
    [503, { code: 'PGRSTX00', message: 'pool unavailable' }, 'internal'],
  ] as const)('maps HTTP %s fixture to %s', (status, fixture, expected) => {
    const error = mapSupabaseFailure(status, fixture);
    expect(error).toBeInstanceOf(SupabaseDataApiError);
    expect(error.kind).toBe(expected);
    expect(error.message).not.toContain(fixture.message);
    const conflictReason =
      fixture.message === 'QUOTE_STALE'
        ? 'quote_stale'
        : fixture.message === 'REVISION_CONFLICT'
          ? 'revision'
          : null;
    expect(error.safeDetails).toEqual(conflictReason === null ? {} : { conflictReason });
  });

  it('returns null only for the recorded PostgREST singular not-found response', async () => {
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-key',
      callerJwt: 'caller-jwt',
      fetch: async () => jsonResponse(406, { code: 'PGRST116', message: 'zero rows' }),
    });
    await expect(executor.selectOne('projects', { id: 'eq.missing' })).resolves.toBeNull();
  });

  it('fails opaquely when the Data API returns a non-JSON response', async () => {
    const executor = new SupabaseDataApiExecutor({
      baseUrl: 'https://project.supabase.co',
      publishableKey: 'public-key',
      callerJwt: 'caller-jwt',
      fetch: async () => new Response('<html>upstream failure</html>', { status: 502 }),
    });

    await expect(executor.select('projects', { select: '*' })).rejects.toMatchObject({
      kind: 'internal',
      message: 'Supabase Data API request failed: internal',
      safeDetails: {},
    });
  });
});
