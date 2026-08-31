import { textDraftKey } from './conflict-resolution';
import type { TextDraft } from './protocol';

export interface CheckpointGraphNode {
  readonly id: string;
  readonly kind: string;
  readonly parameter_schema_version: number;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface CheckpointGraphPatch {
  readonly upsert_nodes: readonly CheckpointGraphNode[];
  readonly remove_node_ids: readonly string[];
  readonly upsert_edges: readonly never[];
  readonly remove_edge_ids: readonly never[];
}

export function isCanvasParameterDraft(fieldPath: string): boolean {
  return fieldPath.startsWith('parameters.');
}

export function parameterKeyFromFieldPath(fieldPath: string): string | null {
  if (!isCanvasParameterDraft(fieldPath)) return null;
  const key = fieldPath.slice('parameters.'.length);
  return key.length > 0 ? key : null;
}

export function applyParameterDraft(
  parameters: Readonly<Record<string, unknown>>,
  fieldPath: string,
  body: string,
): Record<string, unknown> {
  const key = parameterKeyFromFieldPath(fieldPath);
  if (key === null) return { ...parameters };
  return { ...parameters, [key]: body };
}

export function collectCheckpointDrafts(input: {
  readonly snapshotTextDrafts: readonly TextDraft[];
  readonly localDrafts: Readonly<Record<string, Readonly<Record<string, string>>>>;
}): readonly TextDraft[] {
  const byKey = new Map<string, TextDraft>();
  for (const draft of input.snapshotTextDrafts) {
    if (!isCanvasParameterDraft(draft.field_path)) continue;
    byKey.set(textDraftKey(draft.node_id, draft.field_path), draft);
  }
  for (const [nodeId, fields] of Object.entries(input.localDrafts)) {
    for (const [fieldPath, body] of Object.entries(fields)) {
      if (!isCanvasParameterDraft(fieldPath)) continue;
      const key = textDraftKey(nodeId, fieldPath);
      const existing = byKey.get(key);
      byKey.set(key, {
        draft_id: key,
        node_id: nodeId,
        field_path: fieldPath,
        body,
        author: existing?.author ?? { actor_id: 'local', display_name: 'You' },
        updated_at: new Date().toISOString(),
      });
    }
  }
  return [...byKey.values()];
}

export function buildCanvasPatchFromDrafts(input: {
  readonly nodes: readonly CheckpointGraphNode[];
  readonly drafts: readonly TextDraft[];
}): {
  readonly patch: CheckpointGraphPatch;
  readonly appliedDraftIds: readonly string[];
  readonly skippedDraftIds: readonly string[];
} {
  const nodeById = new Map(input.nodes.map((node) => [node.id, node]));
  const draftsByNode = new Map<string, TextDraft[]>();
  for (const draft of input.drafts) {
    if (!isCanvasParameterDraft(draft.field_path)) continue;
    const existing = draftsByNode.get(draft.node_id) ?? [];
    existing.push(draft);
    draftsByNode.set(draft.node_id, existing);
  }

  const upsertNodes: CheckpointGraphNode[] = [];
  const appliedDraftIds: string[] = [];
  const skippedDraftIds: string[] = [];

  for (const [nodeId, drafts] of draftsByNode) {
    const node = nodeById.get(nodeId);
    if (node === undefined) {
      skippedDraftIds.push(...drafts.map((draft) => draft.draft_id));
      continue;
    }
    let parameters = { ...node.parameters };
    for (const draft of drafts) {
      parameters = applyParameterDraft(parameters, draft.field_path, draft.body);
      appliedDraftIds.push(draft.draft_id);
    }
    upsertNodes.push({
      ...node,
      parameters,
    });
  }

  return {
    patch: {
      upsert_nodes: upsertNodes,
      remove_node_ids: [],
      upsert_edges: [],
      remove_edge_ids: [],
    },
    appliedDraftIds,
    skippedDraftIds,
  };
}

export function mergeDraftsIntoCanvasModel<
  Model extends { readonly nodes: readonly CheckpointGraphNode[] },
>(model: Model, drafts: readonly TextDraft[]): Model {
  const { patch } = buildCanvasPatchFromDrafts({ nodes: model.nodes, drafts });
  if (patch.upsert_nodes.length === 0) return model;
  const patchedById = new Map(patch.upsert_nodes.map((node) => [node.id, node.parameters]));
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const parameters = patchedById.get(node.id);
      return parameters === undefined ? node : { ...node, parameters };
    }),
  };
}
