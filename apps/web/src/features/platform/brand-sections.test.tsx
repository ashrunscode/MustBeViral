// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearCampaignProgress, writeCampaignProgress } from '../campaign/campaign-progress';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}));

import { SavedCampaignStep } from './brand-sections';

const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const STUDIO = '11111111-1111-4111-8111-111111111111';
const BRAND = '33333333-3333-4333-8333-333333333333';
const OTHER_BRAND = '44444444-4444-4444-8444-444444444444';

const brand = { id: BRAND, workspace_id: WORKSPACE, name: 'UnPile', status: 'active' } as never;

afterEach(() => {
  cleanup();
  clearCampaignProgress();
});

describe('SavedCampaignStep', () => {
  it('resumes only a step saved for this brand, with its plan and run', () => {
    writeCampaignProgress({
      workspace: WORKSPACE,
      step: 'review',
      context: { studio: STUDIO, brand: BRAND, canvas: 'c1', revision: 'r1', run: 'run1' },
    });
    render(<SavedCampaignStep brand={brand} compact />);
    expect(
      screen.getByRole('link', { name: 'Resume review and approval' }).getAttribute('href'),
    ).toBe(
      `/studio/${WORKSPACE}/review?studio=${STUDIO}&brand=${BRAND}&canvas=c1&revision=r1&run=run1`,
    );
  });

  it('shows nothing from another brand of the same workspace', () => {
    writeCampaignProgress({
      workspace: WORKSPACE,
      step: 'canvas',
      context: { studio: STUDIO, brand: OTHER_BRAND, canvas: 'c2' },
    });
    render(<SavedCampaignStep brand={brand} compact />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('No campaign step is saved in this browser.')).toBeTruthy();
  });

  it('does not attach a brand to a saved step that never named one', () => {
    writeCampaignProgress({ workspace: WORKSPACE, step: 'quote' });
    render(<SavedCampaignStep brand={brand} compact />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
