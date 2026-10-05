// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InternalOperationsPanel } from './internal-operations-panel';

const reads = vi.hoisted(() => ({
  core: vi.fn(() => {
    throw new Error('Operations must not read Core without an operator grant.');
  }),
  supabase: vi.fn(() => {
    throw new Error('Operations must not read Supabase without an operator grant.');
  }),
  progress: vi.fn(() => null),
  subscribe: vi.fn(() => () => undefined),
}));

vi.mock('../../lib/core/browser-client', () => ({ createBrowserCoreClient: reads.core }));
vi.mock('../../lib/supabase/client', () => ({ createBrowserSupabaseClient: reads.supabase }));
vi.mock('../campaign/campaign-progress', () => ({
  campaignProgressSnapshot: reads.progress,
  subscribeCampaignProgress: reads.subscribe,
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('internal operations access', () => {
  it('blocks operations before reading any workspace, switch or saved campaign state', () => {
    render(<InternalOperationsPanel />);

    expect(reads.core).not.toHaveBeenCalled();
    expect(reads.supabase).not.toHaveBeenCalled();
    expect(reads.progress).not.toHaveBeenCalled();
    expect(reads.subscribe).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Operations');
    expect(screen.getByRole('status').textContent).toContain('Operations access is unavailable.');
    expect(screen.getByRole('link', { name: 'Return to your studios' }).getAttribute('href')).toBe(
      '/studio',
    );
    expect(screen.queryByText('Product safety gates')).toBeNull();
    expect(screen.queryByText('Landed cost honesty')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
