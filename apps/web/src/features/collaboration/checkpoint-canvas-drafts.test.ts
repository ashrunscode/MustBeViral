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
