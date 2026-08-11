import { validateGraph } from '@mustbeviral/graph';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANVAS_LOD_THRESHOLD,
  InMemoryCanvasPort,
  WorkerCanvasReadPort,
  WorkerCanvasMutationPort,
  canvasModelFromContext,
  createCanvasFixture,
  isSimplifiedCanvasLod,
  mapCanvasNodesToOutline,
  mapCanvasStatusToChip,
} from './canvas-port';

describe('canvas presentation mappings', () => {
  it.each([
    ['verified', 'Verified'],
    ['running', 'Running'],
    ['queued', 'Queued'],
    ['failed', 'Failed'],
    ['notes', 'Notes'],
  ] as const)('maps %s to the matching status chip', (status, label) => {
    expect(mapCanvasStatusToChip(status)).toEqual({ status, label });
  });

  it('switches to simplified chrome only below the golden LOD threshold', () => {
    expect(isSimplifiedCanvasLod(CANVAS_LOD_THRESHOLD - 0.01)).toBe(true);
    expect(isSimplifiedCanvasLod(CANVAS_LOD_THRESHOLD)).toBe(false);
    expect(isSimplifiedCanvasLod(1)).toBe(false);
  });

  it('preserves semantic outline order and statuses from the visual graph source', () => {
    const graph = createCanvasFixture();
    const outline = mapCanvasNodesToOutline(graph.nodes);
    expect(outline.map(({ id }) => id)).toEqual(graph.nodes.map(({ id }) => id));
    expect(outline.map(({ status }) => status)).toEqual(graph.nodes.map(({ status }) => status));
  });

  it('provides a valid typed 100-node performance fixture', () => {
    const graph = createCanvasFixture(100);
    expect(graph.nodes).toHaveLength(100);
    expect(validateGraph({ nodes: graph.nodes, edges: graph.edges })).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('provides a deterministic valid 500-node mixed stress fixture', () => {
    const first = createCanvasFixture(500);
    const second = createCanvasFixture(500);
    expect(first).toEqual(second);
    expect(first.nodes).toHaveLength(500);
    expect(new Set(first.nodes.map(({ kind }) => kind)).size).toBeGreaterThanOrEqual(5);
    expect(new Set(first.nodes.map(({ status }) => status))).toEqual(
      new Set(['verified', 'running', 'queued', 'failed', 'notes']),
    );
    expect(validateGraph({ nodes: first.nodes, edges: first.edges })).toEqual({
      valid: true,
      issues: [],
    });
  });
});

describe('InMemoryCanvasPort result union', () => {
  it.each(['ok', 'conflict', 'graph_invalid'] as const)(
    'returns the %s branch',
    async (scenario) => {
      const result = await new InMemoryCanvasPort({ scenario }).validateAndApply(
        createCanvasFixture(),
      );
      expect(result.type).toBe(scenario);
    },
  );
});

describe('WorkerCanvasMutationPort', () => {
  it('validates first, then applies the current snapshot with expected revision and idempotency', async () => {
    const calls: Array<Readonly<{ body: unknown; headers: Headers; url: string }>> = [];
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-mutation-0001',
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({ body: init?.body, headers: new Headers(init?.headers), url });
        const payload = url.endsWith('/validate')
          ? {
              data: {
                canvasId: 'canvas-live',
                revisionId: 'revision-live',
                valid: true,
                issues: [],
              },
              meta: { request_id: 'request-mutation-0001' },
            }
          : {
              data: {
                canvasId: 'canvas-live',
                revisionId: 'revision-next',
                canonicalHash: 'b'.repeat(64),
                affectedDescendants: [],
              },
              meta: { request_id: 'request-mutation-0001' },
            };
        return new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const model = { ...createCanvasFixture(), revision: 'revision-live' };

    await expect(
      new WorkerCanvasMutationPort(
        client,
        'canvas-live',
        () => 'canvas-idem-0001',
      ).validateAndApply(model),
    ).resolves.toMatchObject({ type: 'ok', model: { revision: 'revision-next' } });
    expect(calls.map(({ url }) => url)).toEqual([
      'https://api.example.test/v1/canvases/canvas-live/validate',
      'https://api.example.test/v1/canvases/canvas-live/patches',
    ]);
    expect(calls[0]?.headers.get('idempotency-key')).toBeNull();
    expect(calls[1]?.headers.get('idempotency-key')).toBe('canvas-idem-0001');
    expect(JSON.parse(String(calls[1]?.body))).toMatchObject({
      expected_revision_id: 'revision-live',
      reason: 'Validated canvas draft',
    });
  });

  it('maps the live revision-conflict detail into the locked recovery state', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-mutation-0002',
      fetch: async (input) => {
        const url = String(input);
        return new Response(
          JSON.stringify(
            url.endsWith('/validate')
              ? {
                  data: {
                    canvasId: 'canvas-live',
                    revisionId: 'revision-live',
                    valid: true,
                    issues: [],
                  },
                  meta: { request_id: 'request-mutation-0002' },
                }
              : {
                  error: {
                    code: 'REVISION_CONFLICT',
                    message: 'The requested state change conflicts with current state.',
                    request_id: 'request-mutation-0002',
                    retryable: false,
                    details: { reason: 'revision', actual: 'revision-current' },
                  },
                },
          ),
          { status: url.endsWith('/validate') ? 200 : 409 },
        );
      },
    });

    await expect(
      new WorkerCanvasMutationPort(
        client,
        'canvas-live',
        () => 'canvas-idem-0002',
      ).validateAndApply({ ...createCanvasFixture(), revision: 'revision-live' }),
    ).resolves.toEqual({
      type: 'conflict',
      expected_revision_id: 'revision-live',
      actual_revision_id: 'revision-current',
    });
  });
});

describe('WorkerCanvasReadPort', () => {
  const context = {
    canvasId: 'canvas-live',
    projectId: 'project-live',
    headRevisionId: 'revision-live',
    graphSchemaVersion: 1,
    canonicalHash: 'a'.repeat(64),
    graphSnapshot: {
      nodes: [
        {
          id: 'brief-live',
          kind: 'brief' as const,
          parameter_schema_version: 1,
          parameters: { label: 'Live campaign brief' },
        },
      ],
      edges: [],
    },
  };

  it('maps the authenticated Core response into the existing canvas presentation model', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-live-0001',
      fetch: async () =>
        new Response(
          JSON.stringify({
            data: { canvas: context },
            meta: { request_id: 'request-live-0001' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(new WorkerCanvasReadPort(client, context.canvasId).read()).resolves.toEqual({
      type: 'ok',
      model: canvasModelFromContext(context),
    });
  });

  it('preserves a not-found result instead of falling back to fixture data', async () => {
    const client = createMustBeViralRestClient({
      baseUrl: 'https://api.example.test',
      getAccessToken: async () => 'session-token',
      createRequestId: () => 'request-live-0002',
      fetch: async () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Canvas not found.',
              request_id: 'request-live-0002',
              retryable: false,
            },
          }),
          { status: 404, headers: { 'content-type': 'application/json' } },
        ),
    });

    await expect(new WorkerCanvasReadPort(client, 'missing-canvas').read()).resolves.toEqual({
      type: 'not_found',
      canvas_id: 'missing-canvas',
    });
  });
});
