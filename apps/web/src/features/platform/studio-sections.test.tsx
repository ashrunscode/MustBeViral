// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

import { StudioApprovals, StudioOverview, StudioTasks } from './studio-sections';

const studio = { id: STUDIO, name: 'North Studio' } as never;
const brand = (id: string, name: string) => ({
  id,
  name,
  workspace_id: WORKSPACE,
  status: 'active',
  version: 1,
});

function readyReview() {
  return {
    record: { id: 'ready-record', version: 4 },
    draft_hash: 'draft-4',
    extract_pending: false,
    current_questions: [],
    current_assertions: [{ id: 'assertion-1' }],
    current_proposals: [],
    approved_version: null,
  };
}

function waitingReview() {
  return {
    record: { id: 'waiting-record', version: 2 },
    draft_hash: null,
    extract_pending: false,
    current_questions: [],
    current_assertions: [],
    current_proposals: [],
    approved_version: null,
  };
}

function questionReview() {
  return {
    record: { id: 'question-record', version: 1 },
    draft_hash: 'draft-q',
    extract_pending: false,
    current_questions: [{ id: 'q1', status: 'open', prompt: 'Which price?' }],
    current_assertions: [{ id: 'assertion-q' }],
    current_proposals: [],
    approved_version: null,
  };
}

function expectExplicitAttentionLists(lists: NodeListOf<Element>) {
  expect(lists.length).toBeGreaterThan(0);
  for (const list of lists) {
    expect(list.getAttribute('role'), list.className).toBe('list');
    expect(list.querySelectorAll(':scope > li').length).toBeGreaterThan(0);
  }
}

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
    expect(screen.getByText('This request did not complete. Nothing changed.')).toBeTruthy();
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

  it('keeps the invitation failure visible on the overview beside other decisions', () => {
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: undefined, error: new Error('offline'), loading: false };
    state.reviews = {
      reviews: [
        {
          brand: brand('b2', 'WashBodega'),
          review: {
            record: { id: 'k1' },
            current_questions: [{ id: 'q1', status: 'open', text: 'Which price?' }],
            findings: [],
          },
          error: undefined,
        },
      ],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.getByText('Open question')).toBeTruthy();
    expect(screen.getByText('This request did not complete. Nothing changed.')).toBeTruthy();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
  });

  it('labels the approval count as incomplete while a brand read failed', () => {
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
    render(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.getByText('0 ready to approve, 1 brand not read')).toBeTruthy();
    expect(screen.queryByText(/brand versions ready to approve/u)).toBeNull();
  });

  it('does not count approvals when the brand list itself could not be read', () => {
    state.brands = { data: undefined, error: new Error('offline'), loading: false };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.getByText('Approvals could not be read')).toBeTruthy();
    expect(screen.queryByText(/ready to approve/u)).toBeNull();
  });

  it('scopes every clear to the brands that were read when the studio has more', () => {
    const clear = (id: string, name: string) => ({
      brand: brand(id, name),
      review: { record: null, current_questions: [], findings: [] },
      error: undefined,
    });
    state.brands = {
      data: { items: [brand('b1', 'UnPile'), brand('b2', 'WashBodega')], next_cursor: 'page-2' },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [clear('b1', 'UnPile'), clear('b2', 'WashBodega')],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioTasks studio={studio} />);
    expect(screen.getByText('No open tasks in the first 2 brands.')).toBeTruthy();
    expect(screen.queryByText('No open tasks.')).toBeNull();
    expect(
      screen.queryByText('Every brand question is answered and no invitation is waiting.'),
    ).toBeNull();
    cleanup();
    render(<StudioApprovals studio={studio} />);
    expect(
      screen.getByText('No brand version is waiting for approval in the first 2 brands.'),
    ).toBeTruthy();
    cleanup();
    render(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.getByText('0 ready to approve in the first 2 brands')).toBeTruthy();
    expect(
      screen.getByText('Only the first 2 brands were read. Open Brands for the rest.'),
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

  it('exposes populated approval, waiting and unread lists as lists', () => {
    state.brands = {
      data: {
        items: [brand('b1', 'UnPile'), brand('b2', 'WashBodega'), brand('b3', 'North Brand')],
      },
      error: undefined,
      loading: false,
    };
    state.reviews = {
      reviews: [
        { brand: brand('b1', 'UnPile'), review: null, error: new Error('timeout') },
        { brand: brand('b2', 'WashBodega'), review: readyReview(), error: undefined },
        { brand: brand('b3', 'North Brand'), review: waitingReview(), error: undefined },
      ],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const { container } = render(<StudioApprovals studio={studio} />);
    const unread = container.querySelector('[role="alert"] ul.platform-attention');
    const ready = container.querySelector('ol.platform-attention.platform-card.platform-pad');
    const waiting = container.querySelector('ul.platform-attention.platform-card.platform-pad');
    expect(unread?.textContent).toContain('UnPile');
    expect(ready?.textContent).toContain('Ready to approve');
    expect(ready?.textContent).toContain('WashBodega');
    expect(waiting?.textContent).toContain('North Brand');
    expect(waiting?.textContent).toContain('No findings captured yet.');
    expectExplicitAttentionLists(
      container.querySelectorAll('ol.platform-attention, ul.platform-attention'),
    );
    expect(container.querySelectorAll('ol.platform-attention, ul.platform-attention').length).toBe(
      3,
    );
  });

  it('exposes populated task questions, invitations and unread lists as lists', () => {
    state.brands = {
      data: { items: [brand('b1', 'UnPile'), brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = {
      data: {
        items: [
          {
            invitation: {
              id: 'inv-1',
              role: 'editor',
              expires_at: '2026-12-01T00:00:00.000Z',
            },
            studio_name: 'Harbor Studio',
          },
        ],
      },
      error: undefined,
      loading: false,
    };
    state.reviews = {
      reviews: [
        { brand: brand('b1', 'UnPile'), review: null, error: new Error('timeout') },
        { brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined },
      ],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const { container } = render(<StudioTasks studio={studio} />);
    const unread = container.querySelector('[role="alert"] ul.platform-attention');
    const questions = container.querySelector('ol.platform-attention.platform-card.platform-pad');
    const invitations = container.querySelector('ul.platform-attention.platform-card.platform-pad');
    expect(unread?.textContent).toContain('UnPile');
    expect(questions?.textContent).toContain('Open question');
    expect(questions?.textContent).toContain('Which price?');
    expect(invitations?.textContent).toContain('Harbor Studio');
    expect(invitations?.textContent).toContain('Editor');
    expectExplicitAttentionLists(
      container.querySelectorAll('ol.platform-attention, ul.platform-attention'),
    );
    expect(container.querySelectorAll('ol.platform-attention, ul.platform-attention').length).toBe(
      3,
    );
  });

  it('keeps the populated overview decision list explicit and outside the card padding', () => {
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const { container } = render(<StudioOverview studio={studio} canWrite={false} />);
    const lists = container.querySelectorAll('ol.platform-attention, ul.platform-attention');
    expect(lists.length).toBe(1);
    const decisions = lists[0];
    expect(decisions?.tagName).toBe('OL');
    expect(decisions?.getAttribute('role')).toBe('list');
    expect(decisions?.classList.contains('platform-pad')).toBe(false);
    expect(decisions?.classList.contains('platform-card')).toBe(false);
    expect(decisions?.textContent).toContain('Open question');
    expect(decisions?.textContent).toContain('WashBodega');
  });

  function expectLowerOverviewWithheld() {
    expect(screen.getByRole('heading', { name: 'Studio overview' })).toBeTruthy();
    expect(
      screen.getByText('What needs a decision across this studio, then the brands themselves.'),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Add a brand' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Needs a decision' })).toBeTruthy();
    expect(screen.getByText('Reading what is open across your brands…')).toBeTruthy();
    expect(document.querySelectorAll('.platform-skeleton').length).toBe(2);
    expect(document.querySelector('[aria-labelledby="approvals-now"]')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your brands' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Start with the essentials.' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open approvals' })).toBeNull();
    expect(screen.queryByText('Make room for your first brand.')).toBeNull();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
    expect(screen.queryByText('Approvals could not be read')).toBeNull();
    expect(screen.queryByText(/ready to approve/u)).toBeNull();
  }

  it('withholds lower overview sections while brand, review, or invitation reads are delayed', () => {
    state.brands = { data: undefined, error: undefined, loading: true };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite />);
    expectLowerOverviewWithheld();
    expect(screen.queryByRole('heading', { name: 'WashBodega' })).toBeNull();
    cleanup();

    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: undefined,
      loading: true,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite />);
    expectLowerOverviewWithheld();
    expect(screen.queryByRole('heading', { name: 'WashBodega' })).toBeNull();
    cleanup();

    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite />);
    expectLowerOverviewWithheld();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
    cleanup();

    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: undefined, error: undefined, loading: true };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: readyReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    render(<StudioOverview studio={studio} canWrite />);
    expectLowerOverviewWithheld();
    expect(screen.queryByRole('link', { name: 'Review and approve' })).toBeNull();
  });

  it('shows overview recovery when a delayed brand or invitation read fails', () => {
    state.brands = { data: undefined, error: undefined, loading: true };
    state.invitations = { data: undefined, error: undefined, loading: true };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const failedBrands = render(<StudioOverview studio={studio} canWrite />);
    expectLowerOverviewWithheld();
    state.brands = { data: undefined, error: new Error('offline'), loading: false };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    failedBrands.rerender(<StudioOverview studio={studio} canWrite />);
    expect(screen.queryByText('Reading what is open across your brands…')).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'This request did not complete. Nothing changed.' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approvals could not be read' })).toBeTruthy();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
    expect(screen.queryByText('Make room for your first brand.')).toBeNull();
    expect(screen.queryByText(/ready to approve/u)).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Brand name' })).toBeTruthy();
    cleanup();

    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: undefined, error: undefined, loading: true };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: readyReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const failedInvitations = render(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.queryByRole('heading', { name: '1 brand version ready to approve' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Review and approve' })).toBeNull();
    state.invitations = { data: undefined, error: new Error('offline'), loading: false };
    failedInvitations.rerender(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.getByRole('link', { name: 'Review and approve' })).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'This request did not complete. Nothing changed.' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1 brand version ready to approve' })).toBeTruthy();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
    expect(screen.getByRole('heading', { name: 'WashBodega' })).toBeTruthy();
  });

  it('keeps the unsaved new-brand form mounted across a same-studio refresh', () => {
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const view = render(<StudioOverview studio={studio} canWrite />);
    const input = screen.getByRole('textbox', { name: 'Brand name' });
    const form = document.getElementById('new-brand');
    expect(form).toBeTruthy();
    expect(input.closest('form')).toBe(form);
    fireEvent.change(input, { target: { value: 'Unsaved draft name' } });
    expect((input as HTMLInputElement).value).toBe('Unsaved draft name');

    state.brands = { data: undefined, error: undefined, loading: true };
    state.invitations = { data: undefined, error: undefined, loading: true };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    view.rerender(<StudioOverview studio={studio} canWrite />);
    const during = screen.getByRole('textbox', { name: 'Brand name' });
    expect(during).toBe(input);
    expect(during.closest('form')).toBe(form);
    expect((during as HTMLInputElement).value).toBe('Unsaved draft name');
    expect(screen.queryByText(/WashBodega/u)).toBeNull();
    expect(screen.getByText('Reading what is open across your brands…')).toBeTruthy();

    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    view.rerender(<StudioOverview studio={studio} canWrite />);
    expect(screen.getByRole('textbox', { name: 'Brand name' })).toBe(input);
    expect(document.getElementById('new-brand')).toBe(form);
    expect((input as HTMLInputElement).value).toBe('Unsaved draft name');
    expect(screen.getByRole('heading', { name: 'WashBodega' })).toBeTruthy();
  });

  it('resets the new-brand form and prior content when the studio changes', () => {
    const other = {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'South Studio',
    } as never;
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const view = render(<StudioOverview studio={studio} canWrite />);
    const input = screen.getByRole('textbox', { name: 'Brand name' });
    const form = document.getElementById('new-brand');
    fireEvent.change(input, { target: { value: 'Unsaved draft name' } });

    state.brands = { data: undefined, error: undefined, loading: true };
    state.invitations = { data: undefined, error: undefined, loading: true };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    view.rerender(<StudioOverview studio={other} canWrite />);
    expect(screen.queryByRole('textbox', { name: 'Brand name' })).toBeNull();
    expect(screen.queryByText('Unsaved draft name')).toBeNull();
    expect(screen.queryByText(/WashBodega/u)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Studio overview' })).toBeTruthy();
    expect(screen.getByText('Reading what is open across your brands…')).toBeTruthy();
    expect(document.querySelector('[aria-labelledby="approvals-now"]')).toBeNull();

    state.brands = {
      data: { items: [brand('b9', 'South Brand')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b9', 'South Brand'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    view.rerender(<StudioOverview studio={other} canWrite />);
    const next = screen.getByRole('textbox', { name: 'Brand name' });
    expect(next).not.toBe(input);
    expect(document.getElementById('new-brand')).not.toBe(form);
    expect((next as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'South Brand' })).toBeTruthy();
    expect(screen.queryByText(/WashBodega/u)).toBeNull();
    expect(screen.queryByText('Unsaved draft name')).toBeNull();
  });

  it('hides a denied brand read and drops the mounted form when write access is revoked', () => {
    state.brands = {
      data: { items: [brand('b2', 'WashBodega')] },
      error: undefined,
      loading: false,
    };
    state.invitations = { data: { items: [] }, error: undefined, loading: false };
    state.reviews = {
      reviews: [{ brand: brand('b2', 'WashBodega'), review: questionReview(), error: undefined }],
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    const view = render(<StudioOverview studio={studio} canWrite />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Brand name' }), {
      target: { value: 'Unsaved draft name' },
    });

    state.brands = { data: undefined, error: new Error('revoked'), loading: false };
    state.reviews = {
      reviews: undefined,
      loading: false,
      truncated: false,
      refresh: () => undefined,
    };
    view.rerender(<StudioOverview studio={studio} canWrite={false} />);
    expect(screen.queryByRole('textbox', { name: 'Brand name' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Add a brand' })).toBeNull();
    expect(screen.queryByText('Unsaved draft name')).toBeNull();
    expect(screen.queryByText(/WashBodega/u)).toBeNull();
    expect(screen.queryByText('Make room for your first brand.')).toBeNull();
    expect(screen.queryByText(/Nothing needs a decision right now/u)).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'This request did not complete. Nothing changed.' }),
    ).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Approvals could not be read' })).toBeTruthy();
  });
});
