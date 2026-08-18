import type { GraphEdge, GraphNode, GraphSnapshot } from '@mustbeviral/graph';

export const GOLDEN_BRIEF_IDS = Array.from(
  { length: 20 },
  (_, index) => `GB-${String(index + 1).padStart(2, '0')}`,
) as readonly GoldenBriefId[];

export type GoldenBriefId = `GB-${
  | '01'
  | '02'
  | '03'
  | '04'
  | '05'
  | '06'
  | '07'
  | '08'
  | '09'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'}`;

export const COPY_SET_ANGLES = [
  'Problem-recognition hook: name the buyer’s current friction in the first line, then the supplied promise and proof. Do not invent a diagnosis.',
  'Proof-first hook: lead with supplied evidence or an approved fact, then the benefit. Do not invent studies, ratings, or endorsements.',
  'Offer-clarity hook: state the supplied price and conditions verbatim, then the next honest step. Do not invent urgency or scarcity.',
] as const;

export const MASTER_VISUAL_DIRECTIONS = [
  'Packshot-as-hero: product fills the frame, label readable, no logo-only open, no invented lifestyle talent.',
  'Material and benefit still life: texture and form communicate the benefit without banned likeness or medical staging.',
  'Proof-forward composition: packaging and approved visual evidence carry the frame. Do not render prices, phone numbers, or legal paragraphs as type.',
] as const;

export const SUPPLEMENT_MASTER_VISUAL_DIRECTIONS = [
  MASTER_VISUAL_DIRECTIONS[0],
  'Material still life: bottle, capsules, carton, and readable packaging only. No lifestyle talent.',
  MASTER_VISUAL_DIRECTIONS[2],
] as const;

export function isSupplementCategory(category: string): boolean {
  const normalized = category.trim().toLowerCase();
  return normalized === 'supplements' || normalized.startsWith('supplements;');
}

export function masterVisualDirectionsFor(category: string): readonly [string, string, string] {
  return isSupplementCategory(category)
    ? SUPPLEMENT_MASTER_VISUAL_DIRECTIONS
    : MASTER_VISUAL_DIRECTIONS;
}

export interface GoldenCampaignBrief {
  readonly briefId: string;
  readonly product: string;
  readonly category: string;
  readonly packshots: string;
  readonly features: string;
  readonly benefits: string;
  readonly evidence: string;
  readonly approvedFacts: string;
  readonly offer: string;
  readonly pricePresentation: string;
  readonly urgency: string;
  readonly destination: string;
  readonly brandKit: string;
  readonly audienceAndAwareness: string;
  readonly painsDesiresObjections: string;
  readonly requiredClaimsLegal: string;
  readonly prohibitedClaims: string;
  readonly creativeConstraintsRights: string;
  readonly stressVector: string;
}

export interface LaunchPackShape {
  readonly masterStatics: 3;
  readonly adaptations: 9;
  readonly copySets: 3;
  readonly motionBranches: 1;
}

export const LAUNCH_PACK_SHAPE: LaunchPackShape = {
  masterStatics: 3,
  adaptations: 9,
  copySets: 3,
  motionBranches: 1,
};

function node(id: string, kind: GraphNode['kind'], parameters: GraphNode['parameters']): GraphNode {
  return { id, kind, parameter_schema_version: 1, parameters };
}

function edge(source: string, target: string): GraphEdge {
  return {
    id: `edge-${source}-${target}`,
    kind: 'dependency',
    source_node_id: source,
    target_node_id: target,
  };
}

export function buildGoldenLaunchPackGraph(brief: GoldenCampaignBrief): GraphSnapshot {
  const nodes: GraphNode[] = [
    node('brief', 'brief', {
      brief_id: brief.briefId,
      product: brief.product,
      category: brief.category,
      offer: brief.offer,
      price_presentation: brief.pricePresentation,
      audience_and_awareness: brief.audienceAndAwareness,
      required_claims_legal: brief.requiredClaimsLegal,
      prohibited_claims: brief.prohibitedClaims,
      creative_constraints_rights: brief.creativeConstraintsRights,
    }),
    node('brand-context', 'brand_context', {
      brand_kit: brief.brandKit,
      approved_facts: brief.approvedFacts,
      evidence: brief.evidence,
    }),
  ];
  const edges: GraphEdge[] = [edge('brief', 'brand-context')];

  for (let index = 1; index <= LAUNCH_PACK_SHAPE.copySets; index += 1) {
    const id = `copy-${String(index)}`;
    nodes.push(
      node(id, 'planner_text', {
        asset_role: 'copy_set',
        copy_set: index,
        angle: COPY_SET_ANGLES[index - 1] ?? COPY_SET_ANGLES[0],
        offer: brief.offer,
        urgency: brief.urgency,
        stress_vector: brief.stressVector,
      }),
    );
    edges.push(edge('brand-context', id));
  }

  for (let master = 1; master <= LAUNCH_PACK_SHAPE.masterStatics; master += 1) {
    const masterId = `master-${String(master)}`;
    nodes.push(
      node(masterId, 'image_generation', {
        asset_role: 'master_static',
        master,
        visual_direction:
          masterVisualDirectionsFor(brief.category)[master - 1] ?? MASTER_VISUAL_DIRECTIONS[0],
        product: brief.product,
        packshots: brief.packshots,
        creative_constraints_rights: brief.creativeConstraintsRights,
      }),
    );
    edges.push(edge('brand-context', masterId), edge(`copy-${String(master)}`, masterId));

    for (let adaptation = 1; adaptation <= 3; adaptation += 1) {
      const adaptationId = `adaptation-${String(master)}-${String(adaptation)}`;
      nodes.push(
        node(adaptationId, 'image_edit', {
          asset_role: 'adaptation',
          master,
          adaptation,
          aspect_ratio: ['4:5', '1:1', '9:16'][adaptation - 1] ?? '4:5',
          safe_zone:
            'Keep logo, price, and CTA out of Meta safe bands: top 14%, bottom 20% (35% if this is an ad CTA), sides 6%. Full-bleed, no watermark, no letterbox.',
        }),
      );
      edges.push(edge(masterId, adaptationId));
    }
  }

  nodes.push(
    node('motion-1', 'video_generation', {
      asset_role: 'motion_branch',
      duration_seconds: 8,
      aspect_ratio: '9:16',
      motion_direction:
        '6–10s 9:16. Frame-1 hook, product legible by 3s, sound-on, burned-in captions, last 0.5s loops into first, no third-party watermark, no logo-only open.',
    }),
  );
  edges.push(edge('master-1', 'motion-1'), edge('copy-1', 'motion-1'));

  const reviewableIds = nodes
    .filter((candidate) =>
      ['planner_text', 'image_generation', 'image_edit', 'video_generation'].includes(
        candidate.kind,
      ),
    )
    .map((candidate) => candidate.id);
  nodes.push(node('qa', 'qa', { brief_id: brief.briefId }), node('export', 'output_export', {}));
  edges.push(...reviewableIds.map((id) => edge(id, 'qa')), edge('qa', 'export'));

  return { nodes, edges };
}

export function launchPackGraphPatch(snapshot: GraphSnapshot): {
  upsert_nodes: GraphSnapshot['nodes'][number][];
  remove_node_ids: string[];
  upsert_edges: GraphSnapshot['edges'][number][];
  remove_edge_ids: string[];
} {
  return {
    upsert_nodes: [...snapshot.nodes],
    remove_node_ids: [],
    upsert_edges: [...snapshot.edges],
    remove_edge_ids: [],
  };
}

export function graphLooksLikeLaunchPack(
  snapshot: Readonly<{
    readonly nodes: readonly Readonly<{
      readonly id: string;
      readonly parameters: Readonly<Record<string, unknown>>;
    }>[];
  }>,
  product: string,
): boolean {
  const brief = snapshot.nodes.find((node) => node.id === 'brief');
  return (
    brief?.parameters.product === product &&
    snapshot.nodes.some((node) => node.id === 'copy-1') &&
    snapshot.nodes.some((node) => node.id === 'master-1') &&
    snapshot.nodes.some((node) => node.id === 'motion-1')
  );
}

export function launchPackShapeOf(snapshot: GraphSnapshot): LaunchPackShape {
  const count = (role: string): number =>
    snapshot.nodes.filter((candidate) => candidate.parameters.asset_role === role).length;
  return {
    masterStatics: count('master_static') as 3,
    adaptations: count('adaptation') as 9,
    copySets: count('copy_set') as 3,
    motionBranches: count('motion_branch') as 1,
  };
}
