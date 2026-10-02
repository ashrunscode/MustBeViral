import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  campaignResumeHref,
  clearCampaignProgress,
  readCampaignProgress,
  writeCampaignProgress,
  isCampaignWorkflowStep,
} from './campaign-progress';

describe('campaign progress', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    clearCampaignProgress();
  });

  it('builds resume hrefs for each workflow step', () => {
    expect(campaignResumeHref('campaign', 'brief')).toBe('/studio/campaign/brief');
    expect(campaignResumeHref('campaign', 'review')).toBe('/studio/campaign/review');
    expect(
      campaignResumeHref('campaign', 'review', {
        studio: 's1',
        brand: 'b1',
        canvas: 'c1',
        revision: 'r1',
        run: 'run1',
      }),
    ).toBe('/studio/campaign/review?studio=s1&brand=b1&canvas=c1&revision=r1&run=run1');
  });

  it('keeps the studio, brand, plan and run with the saved step', () => {
    const saved = writeCampaignProgress({
      workspace: 'campaign',
      step: 'quote',
      context: { studio: 's1', brand: 'b1', canvas: 'c1', revision: 'r1', run: 'run1' },
    });
    expect(saved.context).toEqual({
      studio: 's1',
      brand: 'b1',
      canvas: 'c1',
      revision: 'r1',
      run: 'run1',
    });
    expect(saved.resumeHref).toBe(
      '/studio/campaign/quote?studio=s1&brand=b1&canvas=c1&revision=r1&run=run1',
    );
    expect(readCampaignProgress()).toEqual(saved);
  });

  it('drops identifiers that are not well formed instead of trusting them', () => {
    const saved = writeCampaignProgress({
      workspace: 'campaign',
      step: 'canvas',
      context: { studio: 's1', brand: '<script>', canvas: 'c1' },
    });
    expect(saved.context).toEqual({ studio: 's1', canvas: 'c1' });
    expect(saved.resumeHref).toBe('/studio/campaign/canvas?studio=s1&canvas=c1');
  });

  it('rejects a stored record whose link disagrees with its context', () => {
    const saved = writeCampaignProgress({
      workspace: 'campaign',
      step: 'review',
      context: { studio: 's1', brand: 'b1', canvas: 'c1' },
    });
    window.sessionStorage.setItem(
      'mbv.campaign.progress',
      JSON.stringify({ ...saved, context: { ...saved.context, brand: 'b2' } }),
    );
    expect(readCampaignProgress()).toBeNull();
  });

  it('persists and reads progress from session storage', () => {
    clearCampaignProgress();
    const saved = writeCampaignProgress({ workspace: 'campaign', step: 'quote' });
    expect(saved.stepLabel).toBe('Quote and confirmation');
    expect(readCampaignProgress()).toEqual(saved);
    clearCampaignProgress();
    expect(readCampaignProgress()).toBeNull();
  });

  it.each(['billing', 'access', 'skills', '__proto__', 'constructor'])(
    'does not treat %s as a campaign resume step',
    (step) => {
      expect(isCampaignWorkflowStep(step)).toBe(false);
      const saved = writeCampaignProgress({ workspace: 'campaign', step: 'quote' });
      window.sessionStorage.setItem('mbv.campaign.progress', JSON.stringify({ ...saved, step }));
      expect(readCampaignProgress()).toBeNull();
    },
  );

  it.each([
    null,
    { workspace: 'campaign', step: 'review', resumeHref: 'https://example.test' },
    { workspace: 'campaign', step: 'review', resumeHref: '/studio/another/review' },
  ])('rejects malformed or unrelated stored destinations: %j', (value) => {
    window.sessionStorage.setItem('mbv.campaign.progress', JSON.stringify(value));
    expect(readCampaignProgress()).toBeNull();
  });

  it('recovers the label from the known step rather than trusting stale storage', () => {
    const saved = writeCampaignProgress({ workspace: 'campaign', step: 'review' });
    window.sessionStorage.setItem(
      'mbv.campaign.progress',
      JSON.stringify({ ...saved, stepLabel: null }),
    );
    expect(readCampaignProgress()?.stepLabel).toBe('Review and approval');
  });

  it('keeps the workflow usable when browser storage is denied', () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('SecurityError');
      },
    });
    expect(readCampaignProgress()).toBeNull();
    expect(() => writeCampaignProgress({ workspace: 'campaign', step: 'quote' })).not.toThrow();
    expect(() => clearCampaignProgress()).not.toThrow();
  });
});
