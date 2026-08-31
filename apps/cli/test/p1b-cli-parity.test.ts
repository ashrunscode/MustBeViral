import { PRODUCTION_MCP_TOOL_NAMES } from '@mustbeviral/contracts';
import { describe, expect, it, vi } from 'vitest';

import { MemoryCliCredentialStore, createCliClient } from '../src/index.js';
import {
  PRODUCTION_COMMAND_TO_OPERATION,
  runProductionCommand,
} from '../src/production-commands.js';

const successEnvelope = Object.freeze({
  data: { fixture: 'cli-vector' },
  meta: { request_id: 'cli-vector-0001' },
});

describe('P1b CLI production parity vectors', () => {
  it('maps every production MCP tool to a CLI command', () => {
    expect(Object.values(PRODUCTION_COMMAND_TO_OPERATION).sort()).toEqual(
      [...PRODUCTION_MCP_TOOL_NAMES].sort(),
    );
  });

  it.each([
    ['get-canvas-context', 'get_canvas_context', ['canvas-1']] as const,
    ['get-run', 'get_run', ['run-1']] as const,
    ['validate-graph', 'validate_graph', ['canvas-1']] as const,
  ])('%s issues the same REST operation as MCP (%s)', async (command, operation, args) => {
    const captured: Array<{ operation: string; input: unknown }> = [];
    const client = {
      request: vi.fn(async (op: string, input: unknown) => {
        captured.push({ operation: op, input });
        return successEnvelope;
      }),
    };
    const result = await runProductionCommand(client as never, command, [...args], {});
    expect(result.exitCode).toBe(0);
    expect(captured[0]?.operation).toBe(operation);
  });

  it('preserves start_run confirmation semantics before transport', async () => {
    const request = vi.fn();
    await expect(
      runProductionCommand({ request } as never, 'start-run', ['quote-1'], {
        confirmationToken: 'confirmation-token-123456',
      }),
    ).rejects.toThrow(/confirmed/u);
    expect(request).not.toHaveBeenCalled();
  });

  it('forwards confirmed start_run payloads with idempotency keys', async () => {
    const request = vi.fn(async () => successEnvelope);
    await runProductionCommand({ request } as never, 'start-run', ['quote-1'], {
      confirmationToken: 'confirmation-token-123456',
      confirmed: true,
      idempotencyKey: 'vector-idem-1',
    });
    expect(request).toHaveBeenCalledWith('start_run', {
      id: 'quote-1',
      body: { confirmed: true, confirmation_token: 'confirmation-token-123456' },
      idempotencyKey: 'vector-idem-1',
    });
  });

  it('creates a REST client against /v1 without duplicating the version prefix', async () => {
    const errorEnvelope = {
      error: {
        code: 'NOT_FOUND',
        message: 'The resource was not found.',
        request_id: 'cli-vector-0001',
        retryable: false,
      },
    };
    const fetchImplementation = vi.fn(async () => Response.json(errorEnvelope));
    const store = new MemoryCliCredentialStore();
    await store.write('staging', 'session-jwt');
    const client = await createCliClient({
      environment: 'staging',
      credentialStore: store,
      baseUrl: 'https://core.example.test',
      fetch: fetchImplementation,
    });
    await client.request('get_run', { id: 'run-1' });
    expect(fetchImplementation).toHaveBeenCalledOnce();
    const calls = fetchImplementation.mock.calls as unknown as ReadonlyArray<
      readonly [string, RequestInit | undefined]
    >;
    const firstCall = calls[0];
    expect(firstCall?.[0]).toBe('https://core.example.test/v1/runs/run-1');
    expect(new Headers(firstCall?.[1]?.headers).get('authorization')).toBe('Bearer session-jwt');
  });
});
