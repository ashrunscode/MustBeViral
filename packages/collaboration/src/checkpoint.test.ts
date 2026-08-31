import { describe, expect, it } from 'vitest';

import {
  applyParameterDraft,
  buildCanvasPatchFromDrafts,
  collectCheckpointDrafts,
  isCanvasParameterDraft,
  mergeDraftsIntoCanvasModel,
} from './checkpoint';

const nodes = [
  {
    id: '7',
    kind: 'image_generation',
    parameter_schema_version: 1,
    parameters: { prompt: 'Original prompt', notes: '' },
  },
  {
    id: 'brief',
    kind: 'brief',
    parameter_schema_version: 1,
    parameters: { product: 'Serum', notes: '' },
  },
] as const;

describe('collaboration checkpoint', () => {
  it('identifies canvas parameter drafts only', () => {
    expect(isCanvasParameterDraft('parameters.prompt')).toBe(true);
    expect(isCanvasParameterDraft('accessibility_description')).toBe(false);
  });

  it('merges remote and local drafts with local overrides winning', () => {
    const drafts = collectCheckpointDrafts({
      snapshotTextDrafts: [
        {
          draft_id: '7::parameters.prompt',
          node_id: '7',
          field_path: 'parameters.prompt',
          body: 'Remote prompt',
          author: { actor_id: 'a', display_name: 'A' },
          updated_at: '2026-08-31T12:00:00.000Z',
        },
      ],
      localDrafts: {
        '7': { 'parameters.prompt': 'Local prompt' },
      },
    });
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.body).toBe('Local prompt');
  });

  it('builds an upsert patch without removing nodes or edges', () => {
    const { patch, appliedDraftIds, skippedDraftIds } = buildCanvasPatchFromDrafts({
      nodes,
      drafts: [
        {
          draft_id: '7::parameters.prompt',
          node_id: '7',
          field_path: 'parameters.prompt',
          body: 'Macro ceramic texture',
          author: { actor_id: 'a', display_name: 'A' },
          updated_at: '2026-08-31T12:00:00.000Z',
        },
        {
          draft_id: 'missing::parameters.notes',
          node_id: 'missing',
          field_path: 'parameters.notes',
          body: 'Orphan draft',
          author: { actor_id: 'a', display_name: 'A' },
          updated_at: '2026-08-31T12:00:00.000Z',
        },
      ],
    });
    expect(appliedDraftIds).toEqual(['7::parameters.prompt']);
    expect(skippedDraftIds).toEqual(['missing::parameters.notes']);
    expect(patch.remove_node_ids).toEqual([]);
    expect(patch.remove_edge_ids).toEqual([]);
    expect(patch.upsert_nodes).toHaveLength(1);
    expect(patch.upsert_nodes[0]?.parameters.prompt).toBe('Macro ceramic texture');
    expect(patch.upsert_nodes[0]?.parameters.notes).toBe('');
  });

  it('applies parameter drafts into an in-memory canvas model', () => {
    const merged = mergeDraftsIntoCanvasModel({ revision: 'rev-1', nodes }, [
      {
        draft_id: 'brief::parameters.product',
        node_id: 'brief',
        field_path: 'parameters.product',
        body: 'Lumen Skin Serum',
        author: { actor_id: 'a', display_name: 'A' },
        updated_at: '2026-08-31T12:00:00.000Z',
      },
    ]);
    expect(merged.revision).toBe('rev-1');
    expect(merged.nodes.find((node) => node.id === 'brief')?.parameters.product).toBe(
      'Lumen Skin Serum',
    );
  });

  it('leaves parameters unchanged for non-parameter draft paths', () => {
    const parameters = applyParameterDraft({ prompt: 'keep' }, 'review_notes', 'ignore');
    expect(parameters).toEqual({ prompt: 'keep' });
  });
});
