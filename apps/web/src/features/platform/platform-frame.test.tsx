import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/22222222-2222-4222-8222-222222222222/brands/3',
  useSearchParams: () => new URLSearchParams('studio=11111111-1111-4111-8111-111111111111'),
}));

import {
  PlatformEmptySection,
  PlatformFrame,
  PlatformLoading,
  PlatformRecovery,
} from './platform-frame';
import { PlatformRequestError } from './platform-client';

const studio = { id: '11111111-1111-4111-8111-111111111111', name: 'North Studio', role: 'owner' };
const brand = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'UnPile',
  workspaceId: '22222222-2222-4222-8222-222222222222',
};

describe('platform shell', () => {
  it('keeps a skip link, the studio rail, a breadcrumb, sign-out, and no decorative metrics', () => {
    const html = renderToStaticMarkup(
      <PlatformFrame studio={studio} section="brands">
        <PlatformLoading />
      </PlatformFrame>,
    );
    expect(html).toContain('Skip to content');
    expect(html).toContain('id="platform-main"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Sign out');
    expect(html).toContain('aria-label="Studio navigation"');
    expect(html).toContain('aria-label="Breadcrumb"');
    expect(html).toContain('North Studio');
    expect(html).toContain('aria-current="page"');
    expect(html).toMatch(/aria-current="page"[^>]*>Brands</);
    expect(html).toContain('>Owner<');
    expect(html).not.toContain('impressions');
    expect(html).not.toContain('engagement rate');
    expect(html).not.toContain('→');
  });

  it('names the brand and campaign in the breadcrumb and exposes billing only for owners', () => {
    const withoutBilling = renderToStaticMarkup(
      <PlatformFrame studio={studio} brand={brand} section="brands">
        <p>Brand</p>
      </PlatformFrame>,
    );
    expect(withoutBilling).toContain('UnPile');
    expect(withoutBilling).not.toContain('>Billing</a>');
    expect(withoutBilling).not.toContain('Workspace<');
    const billed = renderToStaticMarkup(
      <PlatformFrame
        studio={studio}
        brand={brand}
        section="brands"
        campaignLabel="Campaign: Brief"
        showBilling
      >
        <p>Wallet</p>
      </PlatformFrame>,
    );
    expect(billed).toContain('>Billing</a>');
    expect(billed).toContain(
      '/studio/22222222-2222-4222-8222-222222222222/billing?studio=11111111-1111-4111-8111-111111111111&amp;brand=33333333-3333-4333-8333-333333333333',
    );
    expect(billed).toContain('Campaign: Brief');
  });

  it('shows the preview banner instead of sign-out when nothing is signed in', () => {
    const html = renderToStaticMarkup(
      <PlatformFrame presentation="preview" flush>
        <p>Sample</p>
      </PlatformFrame>,
    );
    expect(html).toContain('Preview. Sample work only.');
    expect(html).not.toContain('Sign out');
    expect(html).toContain('platform-app--flush');
    expect(html).toContain('platform-main--flush');
  });

  it('explains denied, missing, archived, and unsigned-in recovery without inventing access', () => {
    const denied = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('FORBIDDEN', 'hidden')} />,
    );
    expect(denied).toContain('You do not have access.');
    expect(denied).toContain('Choose a permitted studio');
    expect(denied).toContain('Sign in with another account');
    const missing = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('NOT_FOUND', 'hidden')} />,
    );
    expect(missing).toContain('unavailable or your access has changed');
    const archived = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('RESOURCE_ARCHIVED', 'hidden')} />,
    );
    expect(archived).toContain('archived, revoked or expired');
    const signedOut = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('UNAUTHENTICATED', 'hidden')} />,
    );
    expect(signedOut).toContain('Your session ended.');
    expect(signedOut).toContain('Sign in to continue');
    expect(signedOut).toContain('next=');
    const unavailable = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('INTERNAL_ERROR', 'hidden')} />,
    );
    expect(unavailable).toContain('We could not confirm this request');
    expect(unavailable).not.toContain('not marked as saved');
  });

  it('renders an honest empty section with the missing contract and one action', () => {
    const html = renderToStaticMarkup(
      <PlatformEmptySection
        title="No channels connected."
        body="Nothing publishes."
        missing="No channel command is registered."
        action={{ href: '/studio', label: 'Choose a studio' }}
      />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('No channel command is registered.');
    expect(html).toContain('href="/studio"');
    expect(html).not.toMatch(/\b0 channels\b/);
  });
});
