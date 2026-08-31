import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  campaignResumeHref,
  clearCampaignProgress,
  readCampaignProgress,
  writeCampaignProgress,
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
  });

  it('persists and reads progress from session storage', () => {
    clearCampaignProgress();
    const saved = writeCampaignProgress({ workspace: 'campaign', step: 'quote' });
    expect(saved.stepLabel).toBe('Quote and confirmation');
    expect(readCampaignProgress()).toEqual(saved);
    clearCampaignProgress();
    expect(readCampaignProgress()).toBeNull();
  });
});
