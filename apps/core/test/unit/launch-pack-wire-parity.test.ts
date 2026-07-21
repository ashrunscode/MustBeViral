import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  P0_REST_OPERATIONS,
  type P0HandlerResult,
  type P0RestHandlers,
} from '@mustbeviral/contracts';

import { createCoreApp } from '../../src/app';
import type { V1Dependencies } from '../../src/routes/v1';
import {
  HARNESS_OPERATIONS,
  StagingLaunchPackTransport,
  type HarnessOperation,
} from '../../tools/launch-pack-harness-lib';

const context = {
  workspace_id: 'workspace-1',
  actor_id: 'actor-1',
  request_id: 'request-wire-0001',
};

const validInputs: Readonly<Record<HarnessOperation, Readonly<Record<string, unknown>>>> = {
  create_workspace: {
    context,
    name: 'Golden brief workspace',
    idempotency_key: 'wire-workspace',
  },
  create_project: {
    context,
    workspace_id: 'workspace-1',
    name: 'Golden brief project',
    idempotency_key: 'wire-project',
  },
  create_canvas: {
    context,
    project_id: 'project-1',
    name: 'Golden brief canvas',
    idempotency_key: 'wire-canvas',
  },
  apply_canvas_patch: {
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    reason: 'Wire parity patch',
    patch: {},
    idempotency_key: 'wire-patch',
  },
  validate_graph: { context, canvas_id: 'canvas-1' },
  quote_run: {
    context,
    canvas_id: 'canvas-1',
    expected_revision_id: 'revision-1',
    idempotency_key: 'wire-quote',
  },
  start_run: {
    context,
    quote_id: 'quote-1',
    confirmed: true,
    confirmation_token: 'wire-confirmation-token',
    idempotency_key: 'wire-start',
  },
};

function handlers(calls: HarnessOperation[]): P0RestHandlers {
  return Object.fromEntries(
    P0_REST_OPERATIONS.map((operation) => [
      operation,
      async () => {
        if (HARNESS_OPERATIONS.some((candidate) => candidate === operation)) {
          calls.push(operation as HarnessOperation);
        }
        return { status: 'ok' } satisfies P0HandlerResult;
      },
    ]),
  ) as unknown as P0RestHandlers;
}

function dependencies(calls: HarnessOperation[]): V1Dependencies {
  return {
    handlers: handlers(calls),
    jwt: {
      verify: async (token) => {
        if (token !== 'wire-caller-token') throw new Error('invalid fixture token');
        return { actorId: 'actor-1', authenticationMethod: 'supabase_jwt' };
      },
    },
    workspaces: { resolve: async () => 'workspace-1' },
  };
}

const bindings = {
  PROVIDER_RUNS_ENABLED: 'true',
  FAL_KEY: 'fixture-provider-key',
} as unknown as PlatformBindings;

function appFetch(app: ReturnType<typeof createCoreApp>, invalidJson = false): typeof fetch {
  return async (input, init) =>
    app.request(
      String(input),
      {
        ...init,
        ...(invalidJson ? { body: '{' } : {}),
      },
      bindings,
    );
}

describe('launch-pack staging wire parity', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('Unexpected global fetch');
      }),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(HARNESS_OPERATIONS)('passes %s through the real v1 parser', async (operation) => {
    const calls: HarnessOperation[] = [];
    const app = createCoreApp(dependencies(calls));
    const transport = new StagingLaunchPackTransport(
      'https://core.example',
      'wire-caller-token',
      appFetch(app),
    );

    await expect(transport.call(operation, validInputs[operation])).resolves.toMatchObject({
      ok: true,
    });
    expect(calls).toContain(operation);
  });

  it.each(HARNESS_OPERATIONS)(
    'preserves %s validation failures with step and status',
    async (operation) => {
      const calls: HarnessOperation[] = [];
      const app = createCoreApp(dependencies(calls));
      const transport = new StagingLaunchPackTransport(
        'https://core.example',
        'wire-caller-token',
        appFetch(app, true),
      );

      await expect(transport.call(operation, validInputs[operation])).resolves.toEqual({
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'The request is invalid.',
          operation,
          http_status: 400,
        },
      });
      expect(calls).not.toContain(operation);
    },
  );
});
