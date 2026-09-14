import { describe, expect, it, vi } from 'vitest';
import {
  createPlatformHandlers,
  createPlatformRestClient,
  PLATFORM_ERRORS,
  PLATFORM_OPERATION_NAMES,
  PLATFORM_OPERATIONS,
  type PlatformOperation,
  type PlatformPort,
  type PlatformInput,
} from '@mustbeviral/contracts';

import { createCoreApp } from '../../src/app';
import { runPlatformCommand } from '../../../cli/src/platform-commands';

const user = 'a3000000-0000-4000-8000-000000000001';
const workspace = 'b3000000-0000-4000-8000-000000000001';
const studio = 'c3000000-0000-4000-8000-000000000001';
const brand = 'd3000000-0000-4000-8000-000000000001';
const location = 'e3000000-0000-4000-8000-000000000001';
const context = { actor_id: user, request_id: 'platform-parity-test' };
const fields: Record<string, unknown> = {
  name: 'Synthetic brand',
  slug: 'synthetic-brand',
  workspace_id: workspace,
  studio_id: studio,
  brand_id: brand,
  location_id: location,
  grant_id: location,
  user_id: user,
  role: 'viewer',
  actions: ['brand:read'],
  expected_version: 1,
  time_zone: 'America/Chicago',
  invitation_id: location,
  project_id: location,
  recipient_email: 'recipient@example.test',
  website_url: 'https://example.test',
  description: 'Synthetic operator input',
  audience: 'Synthetic audience',
  goals: 'Synthetic goals',
  current_step: 'details',
  expected_updated_at: '2026-09-10T20:00:00+00:00',
  job_id: location,
  source_id: location,
  candidate_id: location,
  url: 'https://example.test',
  filename: 'notes.md',
  media_type: 'text/markdown',
  text_content: 'Synthetic operator document',
  value_text: 'Corrected unknown',
  excerpt: 'Operator correction excerpt',
  locator: 'manual',
};

function inputFor(operation: PlatformOperation): PlatformInput<PlatformOperation> {
  const definition = PLATFORM_OPERATIONS[operation];
  return definition.input.parse(
    Object.fromEntries(
      Object.keys(definition.input.shape)
        .filter((key) => Object.hasOwn(fields, key))
        .map((key) => [key, fields[key]]),
    ),
  );
}

function fixture(
  port: PlatformPort,
  authenticationMethod: 'supabase_jwt' | 'api_key' = 'supabase_jwt',
) {
  const handlers = createPlatformHandlers(port);
  const app = createCoreApp({
    handlers: {} as never,
    jwt: { verify: vi.fn(async () => ({ actorId: user, authenticationMethod })) },
    workspaces: {
      resolve: async () => {
        throw new Error('Legacy workspace resolver must not authorize portfolio commands');
      },
    },
    platformHandlers: handlers,
  });
  const fetcher: typeof fetch = async (input, init) => app.request(String(input), init);
  const client = createPlatformRestClient({
    baseUrl: 'https://platform.test',
    getAccessToken: async () => 'synthetic-session',
    fetch: fetcher,
    createRequestId: () => context.request_id,
  });
  const mcp = async (operation: PlatformOperation, input: unknown, key?: string) => {
    const response = await app.request('https://platform.test/mcp', {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-session',
        accept: 'application/json, text/event-stream',
        'content-type': 'application/json',
        'x-request-id': context.request_id,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: operation,
          arguments: {
            ...(input as Record<string, unknown>),
            ...(key === undefined ? {} : { idempotency_key: key }),
          },
        },
      }),
    });
    return response.json() as Promise<{ result: { isError: boolean; structuredContent: unknown } }>;
  };
  return { handlers, app, client, mcp, fetcher };
}

describe('platform registry transport parity', () => {
  it.each(PLATFORM_OPERATION_NAMES)(
    '%s uses the same validation and database denial in REST, CLI and MCP',
    async (operation) => {
      const execute = vi
        .fn<PlatformPort['execute']>()
        .mockResolvedValue({ status: 'error', code: 'NOT_FOUND' });
      const { client, mcp, fetcher } = fixture({ execute });
      const input = inputFor(operation);
      const key = PLATFORM_OPERATIONS[operation].method === 'GET' ? undefined : 'parity-key';
      const rest = await client.execute(operation, input, key);
      expect(rest).toMatchObject({ error: { code: 'NOT_FOUND', retryable: false } });
      const rpc = await mcp(operation, input, key);
      expect(rpc.result.structuredContent).toMatchObject({
        error: { code: 'NOT_FOUND', retryable: false },
      });
      expect(rpc.result.isError).toBe(true);
      const cli = await runPlatformCommand({
        command: operation.replaceAll('_', '-'),
        bodyJson: JSON.stringify(input),
        idempotencyKey: key,
        baseUrl: 'https://platform.test/v1',
        readAccessToken: async () => 'synthetic-session',
        fetch: fetcher,
      });
      expect(cli.exitCode).toBe(6);
      expect(cli.payload).toMatchObject({ error: { code: 'NOT_FOUND', retryable: false } });
      expect(execute).toHaveBeenCalledTimes(3);
      for (const [call] of execute.mock.calls)
        expect(call).toMatchObject({ operation, input, context: { actor_id: user } });
    },
  );
  it('returns a validated successful read through all three clients', async () => {
    const data = { items: [], next_cursor: null };
    const { client, mcp, fetcher } = fixture({ execute: async () => ({ status: 'ok', data }) });
    expect(await client.execute('list_studios', {})).toMatchObject({ data });
    expect((await mcp('list_studios', {})).result).toMatchObject({
      isError: false,
      structuredContent: { data },
    });
    expect(
      await runPlatformCommand({
        command: 'list-studios',
        baseUrl: 'https://platform.test',
        readAccessToken: async () => 'synthetic-session',
        fetch: fetcher,
      }),
    ).toMatchObject({ exitCode: 0, payload: { data } });
  });
  it.each([
    'FORBIDDEN',
    'REVISION_CONFLICT',
    'IDEMPOTENCY_CONFLICT',
    'RESOURCE_ARCHIVED',
    'RESOURCE_CONFLICT',
  ] as const)('preserves %s on each adapter', async (code) => {
    const { client, mcp, fetcher } = fixture({ execute: async () => ({ status: 'error', code }) });
    const input = inputFor('update_brand');
    expect(
      await client.execute('update_brand', input as PlatformInput<'update_brand'>, 'error-key'),
    ).toMatchObject({ error: { code } });
    expect((await mcp('update_brand', input, 'error-key')).result.structuredContent).toMatchObject({
      error: { code },
    });
    expect(
      await runPlatformCommand({
        command: 'update-brand',
        bodyJson: JSON.stringify(input),
        idempotencyKey: 'error-key',
        baseUrl: 'https://platform.test',
        readAccessToken: async () => 'synthetic-session',
        fetch: fetcher,
      }),
    ).toMatchObject({ exitCode: code === 'FORBIDDEN' ? 5 : 7, payload: { error: { code } } });
  });
  it('maps SOURCE_UNSAFE to HTTP 400 on REST, CLI and MCP without a job payload', async () => {
    const execute = vi.fn<PlatformPort['execute']>();
    const { app, client, mcp, fetcher } = fixture({ execute });
    const input = {
      workspace_id: workspace,
      brand_id: brand,
      url: 'https://127.0.0.1/',
    };
    const restHttp = await app.request(
      `https://platform.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/website`,
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer synthetic-session',
          'content-type': 'application/json',
          'idempotency-key': 'unsafe-key',
          'x-request-id': context.request_id,
        },
        body: JSON.stringify({ url: input.url }),
      },
    );
    expect(restHttp.status).toBe(PLATFORM_ERRORS.SOURCE_UNSAFE.httpStatus);
    const restBody = await restHttp.json();
    expect(restBody).toMatchObject({
      error: {
        code: 'SOURCE_UNSAFE',
        message: PLATFORM_ERRORS.SOURCE_UNSAFE.message,
        retryable: false,
      },
    });
    expect(restBody).not.toHaveProperty('data');
    expect(await client.execute('start_website_capture', input, 'unsafe-key')).toMatchObject({
      error: { code: 'SOURCE_UNSAFE', retryable: false },
    });
    expect((await mcp('start_website_capture', input, 'unsafe-key')).result).toMatchObject({
      isError: true,
      structuredContent: { error: { code: 'SOURCE_UNSAFE', retryable: false } },
    });
    expect(
      await runPlatformCommand({
        command: 'start-website-capture',
        bodyJson: JSON.stringify(input),
        idempotencyKey: 'unsafe-key',
        baseUrl: 'https://platform.test',
        readAccessToken: async () => 'synthetic-session',
        fetch: fetcher,
      }),
    ).toMatchObject({ exitCode: 4, payload: { error: { code: 'SOURCE_UNSAFE' } } });
    expect(execute).not.toHaveBeenCalled();
  });
  it.each([
    ['SOURCE_TIMEOUT', 8],
    ['SOURCE_UNREACHABLE', 8],
    ['SOURCE_INTERRUPTED', 8],
    ['SOURCE_TOO_LARGE', 4],
    ['FORBIDDEN', 5],
    ['NOT_FOUND', 6],
  ] as const)(
    'maps completed %s to the public HTTP status on REST, CLI and MCP without a payload',
    async (code, exitCode) => {
      const execute = vi.fn<PlatformPort['execute']>().mockResolvedValue({ status: 'error', code });
      const { app, client, mcp, fetcher } = fixture({ execute });
      const input = {
        workspace_id: workspace,
        brand_id: brand,
        url: 'https://example.test',
      };
      const restHttp = await app.request(
        `https://platform.test/v1/workspaces/${workspace}/brands/${brand}/source-jobs/website`,
        {
          method: 'POST',
          headers: {
            authorization: 'Bearer synthetic-session',
            'content-type': 'application/json',
            'idempotency-key': 'timeout-key',
            'x-request-id': context.request_id,
          },
          body: JSON.stringify({ url: input.url }),
        },
      );
      expect(restHttp.status).toBe(PLATFORM_ERRORS[code].httpStatus);
      const restBody = await restHttp.json();
      expect(restBody).toMatchObject({
        error: {
          code,
          message: PLATFORM_ERRORS[code].message,
          retryable: PLATFORM_ERRORS[code].retryable,
        },
      });
      expect(restBody).not.toHaveProperty('data');
      expect(await client.execute('start_website_capture', input, 'timeout-key')).toMatchObject({
        error: { code, retryable: PLATFORM_ERRORS[code].retryable },
      });
      expect((await mcp('start_website_capture', input, 'timeout-key')).result).toMatchObject({
        isError: true,
        structuredContent: { error: { code, retryable: PLATFORM_ERRORS[code].retryable } },
      });
      expect(
        await runPlatformCommand({
          command: 'start-website-capture',
          bodyJson: JSON.stringify(input),
          idempotencyKey: 'timeout-key',
          baseUrl: 'https://platform.test',
          readAccessToken: async () => 'synthetic-session',
          fetch: fetcher,
        }),
      ).toMatchObject({ exitCode, payload: { error: { code } } });
    },
  );
  it('rejects missing idempotency in HTTP and MCP before executing', async () => {
    const execute = vi.fn<PlatformPort['execute']>();
    const { app, mcp } = fixture({ execute });
    const response = await app.request('https://platform.test/v1/studios', {
      method: 'POST',
      headers: { authorization: 'Bearer synthetic-session', 'content-type': 'application/json' },
      body: '{"name":"Test","slug":"test"}',
    });
    expect(response.status).toBe(400);
    expect(
      (await mcp('create_studio', { name: 'Test', slug: 'test' })).result.structuredContent,
    ).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects programmatic identity before the user-scoped port', async () => {
    const execute = vi.fn<PlatformPort['execute']>();
    const { client, mcp } = fixture({ execute }, 'api_key');
    expect(await client.execute('list_studios', {})).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    expect((await mcp('list_studios', {})).result.structuredContent).toMatchObject({
      error: { code: 'FORBIDDEN' },
    });
    expect(execute).not.toHaveBeenCalled();
  });
  it('rejects duplicated route/query identifiers and repeated pagination fields', async () => {
    const execute = vi.fn<PlatformPort['execute']>();
    const { app } = fixture({ execute });
    for (const path of [
      `/v1/workspaces/${workspace}/brands?workspace_id=${workspace}`,
      '/v1/studios?limit=1&limit=2',
    ]) {
      expect(
        (
          await app.request(`https://platform.test${path}`, {
            headers: { authorization: 'Bearer synthetic-session' },
          })
        ).status,
      ).toBe(400);
    }
    expect(execute).not.toHaveBeenCalled();
  });
});
