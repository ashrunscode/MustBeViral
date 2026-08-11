import { validateGraph } from '@mustbeviral/graph';
import { createMustBeViralRestClient } from '@mustbeviral/contracts';
import { describe, expect, it } from 'vitest';

import {
  CANVAS_LOD_THRESHOLD,
  InMemoryCanvasPort,
  WorkerCanvasReadPort,
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
      const result = await new InMemoryCanvasPort({ scenario }).validate('7f3a');
      expect(result.type).toBe(scenario);
    },
  );
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
