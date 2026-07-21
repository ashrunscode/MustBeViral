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

export interface GoldenCampaignBrief {
  readonly briefId: GoldenBriefId;
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
