import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  CanvasFlow,
  CanvasResultBanner,
} from '../../../app/studio/[workspace]/(workflow)/canvas/canvas-flow';
import { createCanvasFixture, type CanvasPortResult } from './canvas-port';

describe('CanvasResultBanner result-union rendering', () => {
  it.each([
    [{ type: 'ok', model: createCanvasFixture() }, 'data-result="ok"', 'ready to quote'],
    [
      { type: 'conflict', expected_revision_id: '7f3a', actual_revision_id: '81c2' },
      'data-result="conflict"',
      'Reload latest revision',
    ],
    [
      {
        type: 'graph_invalid',
        issues: [{ code: 'ILLEGAL_EDGE', message: 'Repair this edge.' }],
      },
      'data-result="graph_invalid"',
      'Repair this edge.',
    ],
  ] satisfies ReadonlyArray<readonly [CanvasPortResult, string, string]>)(
    'renders the $result.type branch',
    (result, marker, text) => {
      const html = renderToStaticMarkup(<CanvasResultBanner result={result} />);
      expect(html).toContain(marker);
      expect(html).toContain(text);
    },
  );
});

describe('CanvasFlow semantic outline component parity', () => {
  it('renders outline rows in the same order and with the same statuses as graph data', () => {
    const graph = createCanvasFixture();
    const html = renderToStaticMarkup(<CanvasFlow workspace="lumen-skin" />);
    const ids = [...html.matchAll(/data-outline-id="([^"]+)"/gu)].map((match) => match[1]);
    const statuses = [...html.matchAll(/data-outline-status="([^"]+)"/gu)].map((match) => match[1]);
    expect(ids).toEqual(graph.nodes.map(({ id }) => id));
    expect(statuses).toEqual(graph.nodes.map(({ status }) => status));
    expect(html).toContain('aria-current="true"');
  });

  it('virtualizes the 100-node fixture while keeping every outline row available', () => {
    const html = renderToStaticMarkup(<CanvasFlow workspace="lumen-skin" fixtureNodeCount={100} />);
    const visualNodes = [...html.matchAll(/data-node-id="([^"]+)"/gu)];
    const outlineRows = [...html.matchAll(/data-outline-id="([^"]+)"/gu)];
    expect(visualNodes.length).toBeGreaterThan(0);
    expect(visualNodes.length).toBeLessThan(100);
    expect(outlineRows).toHaveLength(100);
  });
});
