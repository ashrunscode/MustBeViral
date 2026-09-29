import { describe, expect, it } from 'vitest';

import { brandHref, isResourceId, studioHref, workspaceBillingHref } from './platform-navigation';

describe('platform navigation', () => {
  it('builds studio and brand hrefs from durable identifiers only', () => {
    const studio = '11111111-1111-4111-8111-111111111111';
    const workspace = '22222222-2222-4222-8222-222222222222';
    const brand = '33333333-3333-4333-8333-333333333333';
    expect(isResourceId('campaign')).toBe(false);
    expect(isResourceId(studio)).toBe(true);
    expect(studioHref()).toBe('/studio');
    expect(studioHref(studio, 'team')).toBe(`/studio?studio=${studio}&view=team`);
    expect(brandHref(studio, workspace, brand, 'locations', brand)).toContain(
      `/studio/${workspace}/brands/${brand}?`,
    );
    expect(brandHref(studio, workspace, brand)).toContain(`studio=${studio}`);
    expect(workspaceBillingHref(workspace, studio)).toBe(
      `/studio/${workspace}/billing?studio=${studio}`,
    );
    expect(workspaceBillingHref(workspace, studio)).not.toContain(`studio=${workspace}`);
  });
});
