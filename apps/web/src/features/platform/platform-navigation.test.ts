import { describe, expect, it } from 'vitest';

import {
  brandHref,
  campaignHref,
  campaignStepAvailable,
  campaignStepForSegment,
  resolveBrandSection,
  studioHref,
  workspaceBillingHref,
} from './platform-navigation';

const studio = '11111111-1111-4111-8111-111111111111';
const workspace = '22222222-2222-4222-8222-222222222222';
const brand = '33333333-3333-4333-8333-333333333333';

describe('studio and brand links', () => {
  it('keeps the overview free of a view parameter and encodes every other section', () => {
    expect(studioHref()).toBe('/studio');
    expect(studioHref(studio)).toBe(`/studio?studio=${studio}`);
    expect(studioHref(studio, 'overview')).toBe(`/studio?studio=${studio}`);
    expect(studioHref(studio, 'approvals')).toBe(`/studio?studio=${studio}&view=approvals`);
    expect(brandHref(studio, workspace, brand)).toBe(
      `/studio/${workspace}/brands/${brand}?studio=${studio}`,
    );
    expect(brandHref(studio, workspace, brand, 'findings', 'loc')).toBe(
      `/studio/${workspace}/brands/${brand}?studio=${studio}&view=findings&location=loc`,
    );
    expect(workspaceBillingHref(workspace, studio, brand)).toBe(
      `/studio/${workspace}/billing?studio=${studio}&brand=${brand}`,
    );
  });

  it('resolves brand sections, aliases intelligence, and reports unknown values', () => {
    expect(resolveBrandSection(undefined)).toEqual({ section: 'overview', unknown: null });
    expect(resolveBrandSection('intelligence')).toEqual({ section: 'findings', unknown: null });
    expect(resolveBrandSection('calendar')).toEqual({ section: 'calendar', unknown: null });
    expect(resolveBrandSection('reports')).toEqual({ section: 'overview', unknown: 'reports' });
  });
});

describe('campaign links', () => {
  const context = { studio, brand, canvas: 'c1', revision: 'r1', run: 'run1' };

  it('carries the studio, brand, plan and run through every step', () => {
    expect(campaignHref(workspace, 'plan', context)).toBe(
      `/studio/${workspace}/canvas?studio=${studio}&brand=${brand}&canvas=c1&revision=r1&run=run1`,
    );
    expect(campaignHref(workspace, 'results', context)).toContain('/receipt?');
    expect(campaignHref(workspace, 'approvals', context)).toContain('/approvals?');
  });

  it('starts a fresh brief without inheriting another plan or run', () => {
    expect(campaignHref(workspace, 'brief', context)).toBe(
      `/studio/${workspace}/brief?studio=${studio}&brand=${brand}`,
    );
  });

  it('opens plan and budget only with a canvas, and content and results only with a run', () => {
    expect(campaignStepAvailable('brief', {})).toBe(true);
    expect(campaignStepAvailable('plan', {})).toBe(false);
    expect(campaignStepAvailable('plan', { canvas: 'c1' })).toBe(true);
    expect(campaignStepAvailable('budget', { canvas: 'c1' })).toBe(true);
    expect(campaignStepAvailable('content', { canvas: 'c1' })).toBe(false);
    expect(campaignStepAvailable('content', { run: 'run1' })).toBe(true);
    expect(campaignStepAvailable('results', { run: 'run1' })).toBe(true);
    expect(campaignStepAvailable('calendar', {})).toBe(true);
    expect(campaignStepAvailable('collaborators', {})).toBe(true);
  });

  it('maps route segments to steps, including compare under content', () => {
    expect(campaignStepForSegment('brief')).toBe('brief');
    expect(campaignStepForSegment('canvas')).toBe('plan');
    expect(campaignStepForSegment('quote')).toBe('budget');
    expect(campaignStepForSegment('review')).toBe('content');
    expect(campaignStepForSegment('compare')).toBe('content');
    expect(campaignStepForSegment('receipt')).toBe('results');
    expect(campaignStepForSegment('access')).toBeNull();
  });
});
