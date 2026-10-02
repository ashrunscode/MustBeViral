import { z } from 'zod';

export const isResourceId = (value: string | undefined): value is string =>
  z.uuid().safeParse(value).success;

/** Studio-level sections in the order the experience contract lists them. */
export const STUDIO_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'brands', label: 'Brands' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'creators', label: 'Creators and partners' },
  { key: 'reports', label: 'Reports' },
  { key: 'team', label: 'Team' },
  { key: 'settings', label: 'Settings' },
] as const;
export type StudioSection = (typeof STUDIO_SECTIONS)[number]['key'];

export function isStudioSection(value: string | undefined): value is StudioSection {
  return STUDIO_SECTIONS.some((section) => section.key === value);
}

export function studioHref(studioId?: string, view?: StudioSection) {
  const query = new URLSearchParams();
  if (studioId) query.set('studio', studioId);
  if (view && view !== 'overview') query.set('view', view);
  return `/studio${query.size ? `?${query}` : ''}`;
}

/** Brand-level sections. `findings` keeps its URL value; its label is Brand intelligence. */
export const BRAND_SECTIONS = [
  { key: 'overview', label: 'Overview' },
  { key: 'draft', label: 'Brand draft' },
  { key: 'findings', label: 'Intelligence' },
  { key: 'assets', label: 'Assets' },
  { key: 'channels', label: 'Channels' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'content', label: 'Content' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'results', label: 'Results' },
  { key: 'locations', label: 'Locations' },
  { key: 'settings', label: 'Settings' },
] as const;
export type BrandSection = (typeof BRAND_SECTIONS)[number]['key'];

const BRAND_SECTION_ALIASES: Readonly<Record<string, BrandSection>> = {
  intelligence: 'findings',
};

/** Resolve a `?view=` value to a brand section; unknown values are reported, not swallowed. */
export function resolveBrandSection(value: string | undefined): {
  readonly section: BrandSection;
  readonly unknown: string | null;
} {
  if (value === undefined || value === '') return { section: 'overview', unknown: null };
  const aliased = BRAND_SECTION_ALIASES[value];
  if (aliased !== undefined) return { section: aliased, unknown: null };
  const match = BRAND_SECTIONS.find((section) => section.key === value);
  return match ? { section: match.key, unknown: null } : { section: 'overview', unknown: value };
}

export function brandHref(
  studioId: string,
  workspaceId: string,
  brandId: string,
  view?: BrandSection,
  locationId?: string,
) {
  const query = new URLSearchParams({ studio: studioId });
  if (view && view !== 'overview') query.set('view', view);
  if (locationId) query.set('location', locationId);
  return `/studio/${encodeURIComponent(workspaceId)}/brands/${encodeURIComponent(brandId)}?${query}`;
}

export function workspaceBillingHref(workspaceId: string, studioId: string, brandId?: string) {
  const query = new URLSearchParams({ studio: studioId });
  if (brandId) query.set('brand', brandId);
  return `/studio/${encodeURIComponent(workspaceId)}/billing?${query}`;
}

/** Campaign steps in production order. Each step names the URL parameter it needs to open. */
export const CAMPAIGN_STEPS = [
  { key: 'brief', label: 'Brief', path: 'brief', needs: null },
  { key: 'plan', label: 'Plan', path: 'canvas', needs: 'canvas' },
  { key: 'budget', label: 'Budget', path: 'quote', needs: 'canvas' },
  { key: 'content', label: 'Content', path: 'review', needs: 'run' },
  { key: 'approvals', label: 'Approvals', path: 'approvals', needs: 'run' },
  { key: 'collaborators', label: 'Collaborators', path: 'collaborators', needs: null },
  { key: 'calendar', label: 'Calendar', path: 'calendar', needs: null },
  { key: 'results', label: 'Results', path: 'receipt', needs: 'run' },
] as const;
export type CampaignStep = (typeof CAMPAIGN_STEPS)[number]['key'];

export interface CampaignContext {
  readonly studio?: string | undefined;
  readonly brand?: string | undefined;
  readonly canvas?: string | undefined;
  readonly revision?: string | undefined;
  readonly run?: string | undefined;
}

/** Carry studio, brand and campaign identifiers forward so every step keeps its context. */
export function campaignContextQuery(context: CampaignContext): URLSearchParams {
  const query = new URLSearchParams();
  for (const key of ['studio', 'brand', 'canvas', 'revision', 'run'] as const) {
    const value = context[key];
    if (value) query.set(key, value);
  }
  return query;
}

export function campaignHref(workspaceId: string, step: CampaignStep, context: CampaignContext) {
  const definition = CAMPAIGN_STEPS.find((entry) => entry.key === step);
  if (definition === undefined) throw new Error(`Unknown campaign step ${step}`);
  const query = campaignContextQuery(context);
  // A fresh brief starts a new campaign: it must not inherit another canvas or run.
  if (step === 'brief') {
    query.delete('canvas');
    query.delete('revision');
    query.delete('run');
  }
  const suffix = query.size ? `?${query}` : '';
  return `/studio/${encodeURIComponent(workspaceId)}/${definition.path}${suffix}`;
}

/** Which campaign step a workflow route segment belongs to. */
export function campaignStepForSegment(segment: string): CampaignStep | null {
  if (segment === 'compare') return 'content';
  const match = CAMPAIGN_STEPS.find((entry) => entry.path === segment);
  return match ? match.key : null;
}

export function campaignStepAvailable(step: CampaignStep, context: CampaignContext): boolean {
  const definition = CAMPAIGN_STEPS.find((entry) => entry.key === step);
  if (definition === undefined || definition.needs === null) return true;
  return Boolean(context[definition.needs]);
}
