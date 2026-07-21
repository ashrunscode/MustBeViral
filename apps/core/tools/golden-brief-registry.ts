import { readFile } from 'node:fs/promises';

import {
  GOLDEN_BRIEF_IDS,
  type GoldenBriefId,
  type GoldenCampaignBrief,
} from '@mustbeviral/contracts';

const DEFAULT_BRIEF_SOURCE = new URL('../../../docs/research/GOLDEN_BRIEFS.md', import.meta.url);

function nativeFilePath(source: URL): string {
  const pathname = decodeURIComponent(source.pathname);
  return /^\/[A-Za-z]:\//u.test(pathname) ? pathname.slice(1).replaceAll('/', '\\') : pathname;
}

const FIELD_LABELS = {
  product: 'Product',
  category: 'Category',
  packshots: 'Packshots',
  features: 'Features',
  benefits: 'Benefits',
  evidence: 'Evidence',
  approvedFacts: 'Approved facts',
  offer: 'Offer',
  pricePresentation: 'Price presentation',
  urgency: 'Urgency',
  destination: 'Destination',
  brandKit: 'Brand kit',
  audienceAndAwareness: 'Audience and awareness',
  painsDesiresObjections: 'Pains, desires, objections',
  requiredClaimsLegal: 'Required claims/legal',
  prohibitedClaims: 'Prohibited claims',
  creativeConstraintsRights: 'Creative constraints/rights',
  stressVector: 'Stress vector',
} as const satisfies Readonly<Record<keyof Omit<GoldenCampaignBrief, 'briefId'>, string>>;

function isGoldenBriefId(value: string): value is GoldenBriefId {
  return GOLDEN_BRIEF_IDS.some((candidate) => candidate === value);
}

function requiredField(
  fields: ReadonlyMap<string, string>,
  label: string,
  briefId: string,
): string {
  const value = fields.get(label);
  if (value === undefined || value.length === 0) {
    throw new TypeError(`${briefId} is missing the ${label} field`);
  }
  return value;
}

function parseSection(briefId: GoldenBriefId, section: string): GoldenCampaignBrief {
  const fields = new Map<string, string>();
  for (const match of section.matchAll(/^- ([^:]+): (.+)$/gmu)) {
    const label = match[1];
    const value = match[2];
    if (label !== undefined && value !== undefined) fields.set(label, value.trim());
  }
  const value = <Key extends keyof typeof FIELD_LABELS>(key: Key): string =>
    requiredField(fields, FIELD_LABELS[key], briefId);
  return {
    briefId,
    product: value('product'),
    category: value('category'),
    packshots: value('packshots'),
    features: value('features'),
    benefits: value('benefits'),
    evidence: value('evidence'),
    approvedFacts: value('approvedFacts'),
    offer: value('offer'),
    pricePresentation: value('pricePresentation'),
    urgency: value('urgency'),
    destination: value('destination'),
    brandKit: value('brandKit'),
    audienceAndAwareness: value('audienceAndAwareness'),
    painsDesiresObjections: value('painsDesiresObjections'),
    requiredClaimsLegal: value('requiredClaimsLegal'),
    prohibitedClaims: value('prohibitedClaims'),
    creativeConstraintsRights: value('creativeConstraintsRights'),
    stressVector: value('stressVector'),
  };
}

/** Parses the registered records from doc_id golden-briefs without duplicating brief prose. */
export function parseGoldenBriefRegistry(markdown: string): readonly GoldenCampaignBrief[] {
  const briefs: GoldenCampaignBrief[] = [];
  const sections = markdown.matchAll(
    /^### `(?<briefId>GB-\d{2})`\s*$\r?\n(?<section>[\s\S]*?)(?=^### `GB-|^## Coverage matrix)/gmu,
  );
  for (const match of sections) {
    const briefId = match.groups?.briefId;
    const section = match.groups?.section;
    if (briefId === undefined || section === undefined || !isGoldenBriefId(briefId)) {
      throw new TypeError('Golden brief source contains an unregistered brief id');
    }
    briefs.push(parseSection(briefId, section));
  }
  const actualIds = briefs.map((brief) => brief.briefId);
  if (
    actualIds.length !== GOLDEN_BRIEF_IDS.length ||
    actualIds.some((briefId, index) => briefId !== GOLDEN_BRIEF_IDS[index])
  ) {
    throw new TypeError('Golden brief source must contain GB-01 through GB-20 in order');
  }
  return briefs;
}

export async function loadGoldenBriefRegistry(
  source: URL = DEFAULT_BRIEF_SOURCE,
): Promise<readonly GoldenCampaignBrief[]> {
  return parseGoldenBriefRegistry(await readFile(nativeFilePath(source), 'utf8'));
}
