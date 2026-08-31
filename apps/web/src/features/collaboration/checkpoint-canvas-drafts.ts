import {
  buildCanvasPatchFromDrafts,
  collectCheckpointDrafts,
  mergeDraftsIntoCanvasModel,
  type TextDraft,
} from '@mustbeviral/collaboration';

import type { CanvasModel, CanvasMutationPort, CanvasPortResult } from '../canvas/canvas-port';

export type CheckpointCanvasDraftsResult =
  | {
      readonly type: 'ok';
      readonly model: CanvasModel;
      readonly revisionId: string;
      readonly clearedDraftIds: readonly string[];
    }
  | Extract<CanvasPortResult, { type: 'conflict' }>
  | Extract<CanvasPortResult, { type: 'graph_invalid' }>
  | Extract<CanvasPortResult, { type: 'forbidden' }>
  | Extract<CanvasPortResult, { type: 'not_found' }>
  | Extract<CanvasPortResult, { type: 'session_expired' }>
  | Extract<CanvasPortResult, { type: 'error' }>
  | { readonly type: 'no_drafts' };

export function resolveCheckpointDrafts(input: {
  readonly snapshotTextDrafts: readonly TextDraft[];
  readonly localDrafts: Readonly<Record<string, Readonly<Record<string, string>>>>;
}): readonly TextDraft[] {
  return collectCheckpointDrafts(input);
}

export function canvasModelWithCheckpointDrafts(
  model: CanvasModel,
  drafts: readonly TextDraft[],
): CanvasModel {
  return mergeDraftsIntoCanvasModel(model, drafts);
}

export async function checkpointCanvasDrafts(input: {
  readonly model: CanvasModel;
  readonly drafts: readonly TextDraft[];
  readonly mutationPort: CanvasMutationPort;
  readonly reason?: string;
}): Promise<CheckpointCanvasDraftsResult> {
  const { patch, appliedDraftIds, skippedDraftIds } = buildCanvasPatchFromDrafts({
    nodes: input.model.nodes,
    drafts: input.drafts,
  });
  if (appliedDraftIds.length === 0) {
    return skippedDraftIds.length > 0 ? { type: 'no_drafts' } : { type: 'no_drafts' };
  }
  const checkpointedModel = canvasModelWithCheckpointDrafts(input.model, input.drafts);
  const patchedIds = new Set(patch.upsert_nodes.map((node) => node.id));
  const graphPatch = {
    upsert_nodes: checkpointedModel.nodes.filter((node) => patchedIds.has(node.id)),
    remove_node_ids: [] as string[],
    upsert_edges: [] as CanvasModel['edges'][number][],
    remove_edge_ids: [] as string[],
  };
  const result = await input.mutationPort.validateAndApply(checkpointedModel, {
    reason: input.reason ?? 'Checkpoint collaboration drafts',
    patch: graphPatch,
  });
  if (result.type !== 'ok') return result;
  return {
    type: 'ok',
    model: result.model,
    revisionId: result.model.revision,
    clearedDraftIds: appliedDraftIds,
  };
}
