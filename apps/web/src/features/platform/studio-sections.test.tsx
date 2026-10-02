// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const STUDIO = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';

const state = vi.hoisted(() => ({
  brands: { data: undefined as unknown, error: undefined as unknown, loading: false },
  invitations: { data: undefined as unknown, error: undefined as unknown, loading: false },
  reviews: {
    reviews: undefined as unknown,
    loading: false,
    truncated: false,
    refresh: () => undefined,
  },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined }),
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./use-platform-query', () => ({
  usePlatformQuery: (operation: string) => ({
    ...(operation === 'list_my_invitations' ? state.invitations : state.brands),
    refresh: () => undefined,
  }),
}));
vi.mock('./use-brand-reviews', async (importOriginal) => {
  const original = await importOriginal<typeof import('./use-brand-reviews')>();
  return { ...original, useBrandReviews: () => state.reviews };
});

import { StudioApprovals, StudioTasks } from './studio-sections';

const studio = { id: STUDIO, name: 'North Studio' } as never;
const brand = (id: string, name: string) => ({
  id,
  name,
  workspace_id: WORKSPACE,
  status: 'active',
  version: 1,
});

afterEach(() => cleanup());

describe('studio sections and failed reads', () => {
  it('does not call the studio clear when a brand could not be read', () => {
    state.brands = {
      data: { items: [brand('b1', 'UnPile'), brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [
        { brand: brand('b1', 'UnPile'), review: null, error: new Error('timeout') },
        {
          brand: brand('b2', 'WashBodega'),
          review: { record: null, current_questions: [], findings: [] },
          error: undefined,
        },
      ],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioTasks studio={studio} />);
    expect(screen.queryByText('No open tasks.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('UnPile');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows the recovery instead of the clear when invitations could not be read', () => {
    state.brands = { data: { items: [] }, error: undefined, loading: false };
    state.invitations = { data: undefined, error: new Error('offline'), loading: false };
    state.reviews = { reviews: [], loading: false, truncated: false, refresh: () => undefined };
    render(<StudioTasks studio={studio} />);
    expect(screen.queryByText('No open tasks.')).toBeNull();
    expect(screen.getByText('Let’s get you back to your work.')).toBeTruthy();
  });

  it('names where content approvals happen when no brand version is waiting', () => {
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.reviews = {
      reviews: [
        {
          brand: brand('b2', 'WashBodega'),
          review: { record: null, current_questions: [], findings: [] },
          error: undefined,
        },
      ],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioApprovals studio={studio} />);
    expect(screen.getByText('No brand version is waiting for approval.')).toBeTruthy();
    expect(
      screen.getByText(/Content approvals happen on each campaign’s Content step/u),
    ).toBeTruthy();
  });

  it('withholds the approvals clear while a brand read failed', () => {
    state.brands = { data: { items: [brand('b1', 'UnPile')] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b1', 'UnPile'), review: null, error: new Error('timeout') }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioApprovals studio={studio} />);
    expect(screen.queryByText('No brand version is waiting for approval.')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('UnPile');
  });
});
