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
  'Material and benefit still life: texture and form communicate the benefit without invented talent.',
  'Proof-forward composition: packaging and approved visual evidence carry the frame. Do not render prices, phone numbers, or legal paragraphs as type.',
] as const;

/**
 * fal accepted the GB-02 packshot-hero master, but repeatedly rejected the same product when the
 * only material change was the material-still-life or proof-forward direction (request history
 * 01a01231-440f-79f1-94d2-91d35f344058 accepted; 01a01231-4750-7f83-91b5-a4b124fdf46c,
 * 01a01231-40df-7810-9898-dd86500989f1, 01a015b4-318b-7991-a5f0-234afa3f18b1, and
 * 01a0166a-61a0-7611-9dab-7d4457fe0f9f were content-policy failures). Keep the proven
 * prompt family for every supplement master. fal generates independent variants when no seed is
 * supplied, so this preserves the three-master launch shape without reintroducing known failures.
 */
export const SUPPLEMENT_PACKSHOT_HERO_DIRECTION = MASTER_VISUAL_DIRECTIONS[0];

export const SUPPLEMENT_MASTER_VISUAL_DIRECTIONS = [
  SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
  SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
  SUPPLEMENT_PACKSHOT_HERO_DIRECTION,
] as const;

export function isSupplementCategory(category: string): boolean {
  const normalized = category.trim().toLowerCase();
  return normalized === 'supplements' || normalized.startsWith('supplements;');
}

/**
 * Words that live fal treated as the depicted concept on GB-02 FLUX.2 masters, even when the
 * brief used them as negatives. Image prompts must not teach the model those subjects.
 */
export const IMAGE_PROVIDER_BANNED_CONCEPT =
  /\b(doctors?|sleep(?:ing|s)?|bedrooms?|muscles?|medical|clinical(?:-calm)?|white[\s-]?coats?|body[\s-]+transformation|insomnia|anxiety)\b/iu;

const NAMED_IMAGE_PROHIBITION =
  /\b(no|without|never|avoid)\b[\s\S]{0,160}\b(doctors?|sleep(?:ing|s)?|bedrooms?|muscles?|medical|white[\s-]?coats?|body[\s-]+transformation|insomnia|anxiety)\b/iu;

export const PRODUCT_ONLY_VISUAL_RIGHTS =
  'Product packaging only. Preserve supplied labels unaltered. No lifestyle talent.';

export function imageSafeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (NAMED_IMAGE_PROHIBITION.test(trimmed) || /body[\s-]+transformation/iu.test(trimmed)) {
    return PRODUCT_ONLY_VISUAL_RIGHTS;
  }
  if (!IMAGE_PROVIDER_BANNED_CONCEPT.test(trimmed)) return trimmed;
  const stripped = trimmed
    .replace(new RegExp(IMAGE_PROVIDER_BANNED_CONCEPT.source, 'giu'), ' ')
    .replace(/\s+/gu, ' ')
    .replace(/\s+([,.;:])/gu, '$1')
    .trim();
  return stripped.length > 0 ? stripped : undefined;
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

export function buildFailedImageProbeGraph(
  brief: GoldenCampaignBrief,
  masterIndex: 1 | 2 | 3,
): GraphSnapshot {
  const masterId = `master-${String(masterIndex)}`;
  return {
    nodes: [
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
      node(masterId, 'image_generation', {
        asset_role: 'master_static',
        master: masterIndex,
        visual_direction:
          masterVisualDirectionsFor(brief.category)[masterIndex - 1] ?? MASTER_VISUAL_DIRECTIONS[0],
        product: brief.product,
        packshots: brief.packshots,
        creative_constraints_rights: brief.creativeConstraintsRights,
      }),
    ],
    edges: [edge('brief', 'brand-context'), edge('brand-context', masterId)],
  };
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
