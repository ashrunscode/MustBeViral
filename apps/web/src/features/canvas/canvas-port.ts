import {
  validateGraph,
  type GraphEdge,
  type GraphNode,
  type GraphNodeKind,
  type GraphSnapshot,
  type GraphValidationIssue,
} from '@mustbeviral/graph';
import type { ChipStatus } from '@mustbeviral/ui';

export type CanvasNodeStatus = 'verified' | 'running' | 'queued' | 'failed' | 'notes';
export type CanvasEdgeState = 'default' | 'active' | 'transfer';

export interface CanvasNode extends GraphNode {
  readonly label: string;
  readonly kindLabel: string;
  readonly status: CanvasNodeStatus;
  readonly statusDetail: string;
  readonly model: string;
  readonly x: number;
  readonly y: number;
  readonly invalidReason?: string;
}

export interface CanvasEdge extends GraphEdge {
  readonly state: CanvasEdgeState;
}

export interface CanvasModel {
  readonly revision: string;
  readonly nodes: readonly CanvasNode[];
  readonly edges: readonly CanvasEdge[];
  readonly width: number;
  readonly height: number;
}

export interface CanvasOutlineRow {
  readonly id: string;
  readonly kindLabel: string;
  readonly label: string;
  readonly status: CanvasNodeStatus;
  readonly statusDetail: string;
}

export type CanvasPortResult =
  | { readonly type: 'ok'; readonly model: CanvasModel }
  | {
      readonly type: 'conflict';
      readonly expected_revision_id: string;
      readonly actual_revision_id: string;
    }
  | { readonly type: 'graph_invalid'; readonly issues: readonly GraphValidationIssue[] };

export interface CanvasPort {
  read(): CanvasModel;
  validate(expectedRevisionId: string): Promise<CanvasPortResult>;
  reloadLatest(): Promise<Extract<CanvasPortResult, { type: 'ok' }>>;
}

export type CanvasPortScenario = CanvasPortResult['type'];

const GOLDEN_NODE_WIDTH = 184;
export const CANVAS_LOD_THRESHOLD = 0.7;

export function isSimplifiedCanvasLod(zoom: number): boolean {
  return zoom < CANVAS_LOD_THRESHOLD;
}

export function mapCanvasStatusToChip(status: CanvasNodeStatus): Readonly<{
  status: ChipStatus;
  label: string;
}> {
  const labels: Readonly<Record<CanvasNodeStatus, string>> = {
    verified: 'Verified',
    running: 'Running',
    queued: 'Queued',
    failed: 'Failed',
    notes: 'Notes',
  };
  return { status, label: labels[status] };
}

export function mapCanvasNodesToOutline(nodes: readonly CanvasNode[]): readonly CanvasOutlineRow[] {
  return nodes.map(({ id, kindLabel, label, status, statusDetail }) => ({
    id,
    kindLabel,
    label,
    status,
    statusDetail,
  }));
}

function node(
  id: string,
  kind: GraphNodeKind,
  kindLabel: string,
  label: string,
  status: CanvasNodeStatus,
  statusDetail: string,
  model: string,
  x: number,
  y: number,
  invalidReason?: string,
): CanvasNode {
  return {
    id,
    kind,
    parameter_schema_version: 1,
    parameters: { label },
    kindLabel,
    label,
    status,
    statusDetail,
    model,
    x,
    y,
    ...(invalidReason === undefined ? {} : { invalidReason }),
  };
}

const goldenNodes: readonly CanvasNode[] = [
  node(
    '1',
    'brief',
    'Input node',
    'Campaign brief',
    'verified',
    'Brief locked',
    'rev 7f3a',
    16,
    306,
  ),
  node(
    '2',
    'planner_text',
    'Concept logic',
    'Concept A',
    'verified',
    'Selected',
    'kimi-2.6',
    232,
    18,
  ),
  node(
    '3',
    'planner_text',
    'Concept logic',
    'Concept B',
    'running',
    'Generating 2/3',
    'kimi-2.6',
    232,
    270,
  ),
  node(
    '4',
    'planner_text',
    'Concept logic',
    'Concept C',
    'queued',
    'Waiting',
    'kimi-2.6',
    232,
    528,
  ),
  node(
    '5',
    'image_generation',
    'Visual gen',
    'Asset 01 — Hero',
    'verified',
    'Output verified',
    'flux-2-klein',
    448,
    154,
  ),
  node(
    '6',
    'image_generation',
    'Visual gen',
    'Asset 02 — Detail',
    'verified',
    'Ready',
    'flux-2-klein',
    448,
    316,
  ),
  node(
    '7',
    'image_generation',
    'Visual gen',
    'Asset 03 — Texture',
    'failed',
    'Retry available',
    'flux-2-klein',
    448,
    490,
    'Source texture is below the minimum 1024px input size.',
  ),
  node(
    '8',
    'image_edit',
    'Output matrix',
    'Adaptations',
    'queued',
    '9 renders queued',
    'flux-kontext-pro',
    664,
    316,
  ),
  node('9', 'planner_text', 'Copy gen', 'Copy set', 'verified', '3 variants', 'kimi-2.6', 448, 18),
  node(
    '10',
    'video_generation',
    'Motion gen',
    'Motion 9:16',
    'queued',
    '6 second render',
    'seedance-1.0',
    880,
    44,
  ),
  node('11', 'qa', 'Review gate', 'QA review', 'notes', '2 notes', 'policy-v2', 880, 306),
  node(
    '12',
    'output_export',
    'Output pack',
    'Export bundle',
    'queued',
    'Meta-ready',
    'rev 7f3a',
    880,
    566,
  ),
];

const goldenEdges: readonly CanvasEdge[] = [
  ['1-2', '1', '2', 'active'],
  ['1-3', '1', '3', 'default'],
  ['1-4', '1', '4', 'default'],
  ['2-5', '2', '5', 'active'],
  ['2-6', '2', '6', 'active'],
  ['2-7', '2', '7', 'default'],
  ['3-6', '3', '6', 'transfer'],
  ['5-8', '5', '8', 'active'],
  ['6-8', '6', '8', 'active'],
  ['7-8', '7', '8', 'default'],
  ['1-9', '1', '9', 'active'],
  ['8-10', '8', '10', 'default'],
  ['9-10', '9', '10', 'active'],
  ['8-11', '8', '11', 'default'],
  ['9-11', '9', '11', 'active'],
  ['10-11', '10', '11', 'default'],
  ['11-12', '11', '12', 'default'],
].map(([id, source_node_id, target_node_id, state]) => ({
  id,
  kind: 'dependency',
  source_node_id,
  target_node_id,
  state,
})) as readonly CanvasEdge[];

export function createCanvasFixture(nodeCount: 12 | 100 = 12): CanvasModel {
  if (nodeCount === 12) {
    return { revision: '7f3a', nodes: goldenNodes, edges: goldenEdges, width: 1080, height: 680 };
  }

  const extraNodes: CanvasNode[] = [];
  const extraEdges: CanvasEdge[] = [];
  for (let index = 13; index <= 100; index += 1) {
    const position = index - 13;
    const column = Math.floor(position / 11);
    const row = position % 11;
    const id = String(index);
    extraNodes.push(
      node(
        id,
        'image_edit',
        'Adaptation',
        `Placement ${String(position + 1).padStart(2, '0')}`,
        index % 9 === 0 ? 'running' : 'queued',
        index % 9 === 0 ? 'Rendering' : 'Queued',
        'flux-kontext-pro',
        1120 + column * 216,
        16 + row * 104,
      ),
    );
    extraEdges.push({
      id: `8-${id}`,
      kind: 'dependency',
      source_node_id: '8',
      target_node_id: id,
      state: index % 9 === 0 ? 'transfer' : 'default',
    });
  }
  return {
    revision: '7f3a',
    nodes: [...goldenNodes, ...extraNodes],
    edges: [...goldenEdges, ...extraEdges],
    width: 1120 + Math.ceil(extraNodes.length / 11) * 216,
    height: 1160,
  };
}

function asSnapshot(model: CanvasModel): GraphSnapshot {
  return { nodes: model.nodes, edges: model.edges };
}

export class InMemoryCanvasPort implements CanvasPort {
  readonly #model: CanvasModel;
  readonly #scenario: CanvasPortScenario;

  constructor(options: Readonly<{ nodeCount?: 12 | 100; scenario?: CanvasPortScenario }> = {}) {
    this.#model = createCanvasFixture(options.nodeCount ?? 12);
    this.#scenario = options.scenario ?? 'ok';
  }

  read(): CanvasModel {
    return this.#model;
  }

  async validate(expectedRevisionId: string): Promise<CanvasPortResult> {
    if (this.#scenario === 'conflict') {
      return {
        type: 'conflict',
        expected_revision_id: expectedRevisionId,
        actual_revision_id: '81c2',
      };
    }
    if (this.#scenario === 'graph_invalid') {
      return {
        type: 'graph_invalid',
        issues: [
          {
            code: 'ILLEGAL_EDGE',
            edge_id: '7-8',
            node_id: '7',
            message: 'Asset 03 must be repaired before its adaptations can run.',
          },
        ],
      };
    }
    const validation = validateGraph(asSnapshot(this.#model));
    return validation.valid
      ? { type: 'ok', model: this.#model }
      : { type: 'graph_invalid', issues: validation.issues };
  }

  async reloadLatest(): Promise<Extract<CanvasPortResult, { type: 'ok' }>> {
    return { type: 'ok', model: { ...this.#model, revision: '81c2' } };
  }
}

export { GOLDEN_NODE_WIDTH };
