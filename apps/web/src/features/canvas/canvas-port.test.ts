import { validateGraph } from '@mustbeviral/graph';
import { describe, expect, it } from 'vitest';

import {
  CANVAS_LOD_THRESHOLD,
  InMemoryCanvasPort,
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
