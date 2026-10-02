import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const OTHER_WORKSPACE = '99999999-9999-4999-8999-999999999999';
const STUDIO = '11111111-1111-4111-8111-111111111111';
const BRAND = '33333333-3333-4333-8333-333333333333';

const state = vi.hoisted(() => ({
  search: '',
  studio: { data: undefined as unknown, error: undefined as unknown, loading: false },
  brand: { data: undefined as unknown, error: undefined as unknown, loading: false },
  scope: { status: 'ok' } as Record<string, unknown>,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => `/studio/${WORKSPACE}/review`,
  useSearchParams: () => new URLSearchParams(state.search),
}));
vi.mock('./use-platform-query', () => ({
  usePlatformQuery: (operation: string) => ({
    ...(operation === 'get_studio_access' ? state.studio : state.brand),
    refresh: () => undefined,
  }),
}));
vi.mock('./campaign-scope', () => ({
  useCampaignScope: () => ({ ...state.scope, retry: () => undefined }),
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
const brandAccess = (workspaceId: string, name: string) => ({
  brand: { id: BRAND, name, workspace_id: workspaceId },
  actions: [],
  workspace_owner: true,
});

beforeEach(() => {
  state.search = `studio=${STUDIO}&brand=${BRAND}&canvas=c1&run=r1`;
  state.studio = { data: studioAccess, error: undefined, loading: false };
  state.brand = { data: brandAccess(WORKSPACE, 'UnPile'), error: undefined, loading: false };
  state.scope = { status: 'ok' };
});

describe('WorkspaceFrame scope', () => {
  it('renders the campaign only once studio, brand, plan and run are confirmed as one scope', () => {
    const html = render();
    expect(html).toContain('campaign-content');
    expect(html).toContain('North Studio');
    expect(html).toContain('UnPile');
  });

  it('refuses a link whose brand lives in another workspace and shows nothing from it', () => {
    state.brand = {
      data: brandAccess(OTHER_WORKSPACE, 'Elsewhere'),
      error: undefined,
      loading: false,
    };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).not.toContain('Elsewhere');
    expect(html).toContain('mixes two workspaces');
  });

  it('refuses a link whose run or plan does not belong to this workspace, brand or plan', () => {
    state.scope = {
      status: 'mismatch',
      reason: 'The run in this link belongs to another workspace.',
    };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('The run in this link belongs to another workspace.');
  });

  it('shows the access recovery instead of the campaign when the brand is not permitted', () => {
    state.brand = {
      data: undefined,
      error: new PlatformRequestError('FORBIDDEN', 'hidden'),
      loading: false,
    };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('You do not have access.');
  });

  it('shows the recovery when the plan or run read fails', () => {
    state.scope = { status: 'error', error: new PlatformRequestError('NOT_FOUND', 'gone') };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('Let’s get you back to your work.');
  });

  it('holds the campaign while the scope is still being confirmed', () => {
    state.brand = { data: undefined, error: undefined, loading: true };
    expect(render()).not.toContain('campaign-content');
    state.brand = { data: brandAccess(WORKSPACE, 'UnPile'), error: undefined, loading: false };
    state.scope = { status: 'pending' };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('Confirming the studio and brand');
  });

  it('refuses a campaign step opened without its studio and brand', () => {
    state.search = `studio=${STUDIO}`;
    state.brand = { data: undefined, error: undefined, loading: false };
    const html = render();
    expect(html).not.toContain('campaign-content');
    expect(html).toContain('Open this campaign from its brand.');
  });
});
