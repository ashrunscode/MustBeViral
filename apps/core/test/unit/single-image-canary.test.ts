import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildSingleImageCanaryGraph,
  containsForbiddenDeliveryHost,
  runSingleImageCanary,
  singleImageCanaryArguments,
} from '../../tools/single-image-canary';

const WORKSPACE_ID = 'a53cc127-1102-4ecf-bc80-3bac45b75e6e';
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('single-image canary', () => {
  it('builds the exact one-priced-node graph', () => {
    const graph = buildSingleImageCanaryGraph();
    const pricedNodes = graph.nodes.filter((node) => {
      const parameters = node.parameters as Readonly<Record<string, unknown>>;
      return typeof parameters.asset_role === 'string';
    });

    expect(graph.nodes.map((node) => [node.id, node.kind])).toEqual([
      ['brief', 'brief'],
      ['brand-context', 'brand_context'],
      ['master-static', 'image_generation'],
    ]);
    expect(graph.edges.map((edge) => [edge.source_node_id, edge.target_node_id])).toEqual([
      ['brief', 'brand-context'],
      ['brand-context', 'master-static'],
    ]);
    expect(pricedNodes).toHaveLength(1);
    expect(pricedNodes[0]?.parameters).toMatchObject({ asset_role: 'master_static' });
  });

  it('requires an explicit mode, existing workspace, and output directory', () => {
    expect(
      singleImageCanaryArguments([
        '--dry-run',
        '--workspace',
        WORKSPACE_ID,
        '--out',
        'canary-output',
        '--timeout-ms',
        '120000',
      ]),
    ).toMatchObject({
      mode: 'dry-run',
      workspaceId: WORKSPACE_ID,
      outDirectory: 'canary-output',
      timeoutMilliseconds: 120000,
    });
    expect(() =>
      singleImageCanaryArguments([
        '--staging',
        '--dry-run',
        '--workspace',
        WORKSPACE_ID,
        '--out',
        'canary-output',
      ]),
    ).toThrow('Select exactly one mode');
    expect(() => singleImageCanaryArguments(['--staging', '--out', 'canary-output'])).toThrow(
      '--workspace requires',
    );
  });

  it('recognizes only forbidden provider delivery hosts', () => {
    expect(containsForbiddenDeliveryHost('https://files.fal.media/output.png')).toBe(true);
    expect(containsForbiddenDeliveryHost('https://queue.fal.run/request')).toBe(true);
    expect(containsForbiddenDeliveryHost('https://fal.ai/models')).toBe(true);
    expect(containsForbiddenDeliveryHost('fal-ai/flux-2-pro')).toBe(false);
    expect(containsForbiddenDeliveryHost('workspaces/workspace/runs/run/artifact.png')).toBe(false);
  });

  it('proves the full chain through composed in-memory handlers without network access', async () => {
    const outDirectory = await mkdtemp(join(tmpdir(), 'mustbeviral-single-image-canary-'));
    temporaryDirectories.push(outDirectory);
    const logs: string[] = [];

    await expect(
      runSingleImageCanary(
        ['--dry-run', '--workspace', WORKSPACE_ID, '--out', outDirectory],
        (message) => logs.push(message),
      ),
    ).resolves.toBe(0);

    const evidence = JSON.parse(
      await readFile(join(outDirectory, 'single-image-canary-evidence.json'), 'utf8'),
    ) as {
      mode: string;
      quote_micros: string;
      money: { captured_micros: string; residual_micros: string };
      assertions: Array<{ passed: boolean }>;
      error: unknown;
    };
    expect(evidence).toMatchObject({
      mode: 'dry-run',
      quote_micros: '500000',
      money: { captured_micros: '500000', residual_micros: '0' },
      error: null,
    });
    expect(evidence.assertions.every((assertion) => assertion.passed)).toBe(true);
    expect(logs.some((message) => message.includes('"passed":true'))).toBe(true);
  });
});
