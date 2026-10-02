import { GraphNodeSchema } from '@mustbeviral/contracts';
import { describe, expect, it, vi } from 'vitest';

import { createCanvasFixture } from '../canvas/canvas-port';
import {
  canvasModelWithCheckpointDrafts,
  checkpointCanvasDrafts,
  resolveCheckpointDrafts,
} from './checkpoint-canvas-drafts';

describe('checkpointCanvasDrafts', () => {
  it('merges drafts into the model before applying through the mutation port', async () => {
    const model = createCanvasFixture();
    const mutationPort = {
      validateAndApply: vi.fn(async (nextModel: ReturnType<typeof createCanvasFixture>) => ({
        type: 'ok' as const,
        model: { ...nextModel, revision: '81c2' },
      })),
    };
    const drafts = resolveCheckpointDrafts({
      snapshotTextDrafts: [
        {
          draft_id: '7::parameters.prompt',
          node_id: '7',
          field_path: 'parameters.prompt',
          body: 'Checkpointed prompt',
          author: { actor_id: 'a', display_name: 'A' },
          updated_at: '2026-08-31T12:00:00.000Z',
        },
      ],
      localDrafts: {},
    });
    const merged = canvasModelWithCheckpointDrafts(model, drafts);
    expect(merged.nodes.find((node) => node.id === '7')?.parameters.prompt).toBe(
      'Checkpointed prompt',
    );
    const result = await checkpointCanvasDrafts({
      model,
      drafts,
      mutationPort,
    });
    expect(result).toMatchObject({
      type: 'ok',
      revisionId: '81c2',
      clearedDraftIds: ['7::parameters.prompt'],
    });
    expect(mutationPort.validateAndApply).toHaveBeenCalledWith(
      merged,
      expect.objectContaining({ reason: 'Checkpoint collaboration drafts' }),
    );
  });

  it('sends Core only the graph fields of a patched node, never the screen fields', async () => {
    const model = createCanvasFixture();
    const validateAndApply = vi.fn(
      async (nextModel: ReturnType<typeof createCanvasFixture>, options?: unknown) => {
        void options;
        return { type: 'ok' as const, model: { ...nextModel, revision: '81c2' } };
      },
    );
    const mutationPort = { validateAndApply };
    const drafts = resolveCheckpointDrafts({
      snapshotTextDrafts: [],
      localDrafts: { '7': { 'parameters.prompt': 'A note typed on the plan' } },
    });
    await checkpointCanvasDrafts({ model, drafts, mutationPort });
    const options = validateAndApply.mock.calls[0]?.[1] as
      { patch?: { upsert_nodes: ReadonlyArray<Record<string, unknown>> } } | undefined;
    const sent = options?.patch?.upsert_nodes ?? [];
    expect(sent.length).toBeGreaterThan(0);
    for (const node of sent) {
      expect(Object.keys(node).sort()).toEqual(
        ['id', 'kind', 'parameter_schema_version', 'parameters'].sort(),
      );
      // The strict contract that the browser client enforces before any request leaves.
      expect(GraphNodeSchema.safeParse(node).success).toBe(true);
    }
  });

  it('returns conflict without clearing drafts when expected revision is stale', async () => {
    const mutationPort = {
      validateAndApply: vi.fn(async () => ({
        type: 'conflict' as const,
        expected_revision_id: '7f3a',
        actual_revision_id: '81c2',
      })),
    };
    const result = await checkpointCanvasDrafts({
      model: createCanvasFixture(),
      drafts: resolveCheckpointDrafts({
        snapshotTextDrafts: [
          {
            draft_id: '7::parameters.prompt',
            node_id: '7',
            field_path: 'parameters.prompt',
            body: 'Stale checkpoint',
            author: { actor_id: 'a', display_name: 'A' },
            updated_at: '2026-08-31T12:00:00.000Z',
          },
        ],
        localDrafts: {},
      }),
      mutationPort,
    });
    expect(result).toEqual({
      type: 'conflict',
      expected_revision_id: '7f3a',
      actual_revision_id: '81c2',
    });
  });
});
