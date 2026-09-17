import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PlatformFrame, PlatformLoading, PlatformRecovery } from './platform-frame';
import { PlatformRequestError } from './platform-client';

describe('platform shell', () => {
  it('keeps a skip link, sign-out, and recovery without decorative metrics', () => {
    const html = renderToStaticMarkup(
      <PlatformFrame
        studioId="11111111-1111-4111-8111-111111111111"
        studioName="Studio"
        role="owner"
      >
        <PlatformLoading />
      </PlatformFrame>,
    );
    expect(html).toContain('Skip to content');
    expect(html).toContain('id="platform-main"');
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('Sign out');
    expect(html).toContain('Studio team');
    expect(html).not.toContain('impressions');
    expect(html).not.toContain('engagement rate');
  });

  it('exposes billing only when the workspace owner context is provided', () => {
    const withoutBilling = renderToStaticMarkup(
      <PlatformFrame studioId="11111111-1111-4111-8111-111111111111" role="owner">
        <p>Portfolio</p>
      </PlatformFrame>,
    );
    expect(withoutBilling).not.toContain('Billing');
    const billed = renderToStaticMarkup(
      <PlatformFrame
        studioId="11111111-1111-4111-8111-111111111111"
        workspaceId="22222222-2222-4222-8222-222222222222"
        role="owner"
        showBilling
        billingCurrent
      >
        <p>Wallet</p>
      </PlatformFrame>,
    );
    expect(billed).toContain('>Billing</a>');
    expect(billed).toContain('/studio/22222222-2222-4222-8222-222222222222/billing?studio=');
    expect(billed).not.toContain('studio=22222222-2222-4222-8222-222222222222');
  });

  it('explains denied, missing, archived, and unsigned-in recovery without inventing access', () => {
    const denied = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('FORBIDDEN', 'hidden')} />,
    );
    expect(denied).toContain('do not have permission');
    expect(denied).toContain('Choose a studio');
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
    expect(signedOut).toContain('Sign in');
    const unavailable = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('INTERNAL_ERROR', 'hidden')} />,
    );
    expect(unavailable).toContain('We could not confirm this request');
    expect(unavailable).not.toContain('not marked as saved');
  });
});
