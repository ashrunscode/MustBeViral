import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const OTHER_WORKSPACE = '99999999-9999-4999-8999-999999999999';
const STUDIO = '11111111-1111-4111-8111-111111111111';
const BRAND = '33333333-3333-4333-8333-333333333333';

const queries = vi.hoisted(() => ({
  studio: { data: undefined as unknown, error: undefined as unknown, loading: false },
  brand: { data: undefined as unknown, error: undefined as unknown, loading: false },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => `/studio/${WORKSPACE}/canvas`,
  useSearchParams: () => new URLSearchParams(`studio=${STUDIO}&brand=${BRAND}&canvas=c1`),
}));
vi.mock('./use-platform-query', () => ({
  usePlatformQuery: (operation: string) => ({
    ...(operation === 'get_studio_access' ? queries.studio : queries.brand),
    refresh: () => undefined,
  }),
}));

import { WorkspaceFrame } from './workspace-frame';
import { PlatformRequestError } from './platform-client';

function render() {
  return renderToStaticMarkup(
    <WorkspaceFrame workspace={WORKSPACE} presentation="authenticated">
      <p>campaign-content</p>
    </WorkspaceFrame>,
  );
}

const studioAccess = { studio: { id: STUDIO, name: 'North Studio' }, role: 'owner' };

describe('WorkspaceFrame scope', () => {
  it('renders the campaign only when the brand belongs to the route workspace', () => {
    queries.studio = { data: studioAccess, error: undefined, loading: false };
    queries.brand = {
      data: {
        brand: { id: BRAND, name: 'UnPile', workspace_id: WORKSPACE },
        actions: [],
        workspace_owner: true,
      },
      error: undefined,
      loading: false,
    };
    const html = render();
    expect(html).toContain('campaign-content');
    expect(html).toContain('North Studio');
    expect(html).toContain('UnPile');
  });

  it('refuses a link whose brand lives in another workspace and shows nothing from it', () => {
    queries.studio = { data: studioAccess, error: undefined, loading: false };
    queries.brand = {
      data: {
        brand: { id: BRAND, name: 'Elsewhere', workspace_id: OTHER_WORKSPACE },
        actions: [],
        workspace_owner: true,
      },
      error: undefined,
      loading: false,
    };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('mixes two workspaces');
  });

  it('shows the access recovery instead of the campaign when the brand is not permitted', () => {
    queries.studio = { data: studioAccess, error: undefined, loading: false };
    queries.brand = {
      data: undefined,
      error: new PlatformRequestError('FORBIDDEN', 'hidden'),
      loading: false,
    };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('You do not have access.');
  });

  it('holds the campaign while the scope is still being confirmed', () => {
    queries.studio = { data: studioAccess, error: undefined, loading: false };
    queries.brand = { data: undefined, error: undefined, loading: true };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('Confirming the studio and brand');
  });
});
