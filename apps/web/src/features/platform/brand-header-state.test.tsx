// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const STUDIO = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const BRAND = '33333333-3333-4333-8333-333333333333';
const query = vi.hoisted(() => ({
  studio: { data: undefined as unknown, error: undefined as unknown, loading: true },
  brand: { data: undefined as unknown, error: undefined as unknown, loading: true },
  brands: { data: undefined as unknown, error: undefined as unknown, loading: false },
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('./use-platform-query', () => ({
  usePlatformQuery: (operation: string) => ({
    ...(operation === 'get_studio_access'
      ? query.studio
      : operation === 'get_brand_access'
        ? query.brand
        : query.brands),
    refresh: () => undefined,
  }),
}));
vi.mock('./brand-draft-editor', () => ({ BrandDraftEditor: () => <h1>Synthetic draft</h1> }));

import { BrandWorkspace } from './brand-workspace';
import { PlatformRequestError } from './platform-client';

afterEach(cleanup);
beforeEach(() => {
  query.studio = { data: undefined, error: undefined, loading: true };
  query.brand = { data: undefined, error: undefined, loading: true };
  query.brands = { data: undefined, error: undefined, loading: false };
});
function mount() {
  return render(
    <BrandWorkspace studioId={STUDIO} workspaceId={WORKSPACE} brandId={BRAND} view="draft" />,
  );
}

describe('brand header access states', () => {
  it('reserves loading slots without announcing an identity or offering a switch', () => {
    const { container } = mount();
    expect(screen.getByRole('status').textContent).toContain('Opening the selected brand');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe('Your studios');
    expect(container.querySelector('.platform-brand-switcher[aria-hidden="true"]')).not.toBeNull();
  });

  it('ends the loading presentation on denial and exposes only recovery', () => {
    query.studio = {
      data: undefined,
      error: new PlatformRequestError('FORBIDDEN', 'hidden'),
      loading: false,
    };
    const { container } = mount();
    expect(screen.getByRole('alert').textContent).toContain('You do not have access.');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(container.querySelector('.platform-context-skeleton')).toBeNull();
    expect(screen.getByRole('link', { name: 'Choose a permitted studio' })).toBeTruthy();
  });

  it('keeps paginated brand discovery out of the resolved header tracks', () => {
    query.studio = {
      data: { studio: { id: STUDIO, name: 'Synthetic studio' }, role: 'owner' },
      error: undefined,
      loading: false,
    };
    query.brand = {
      data: {
        brand: { id: BRAND, name: 'Synthetic brand', workspace_id: WORKSPACE, status: 'active' },
        actions: ['brand:write'],
        workspace_owner: true,
      },
      error: undefined,
      loading: false,
    };
    query.brands = {
      data: { items: [], next_cursor: 'synthetic-next-page' },
      error: undefined,
      loading: false,
    };
    mount();
    const more = screen.getByRole('button', { name: 'More brands' });
    expect(screen.getByRole('main').contains(more)).toBe(true);
    expect(more.closest('header')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Switch brand' }).textContent).toContain(
      'Synthetic brand',
    );
  });
});
