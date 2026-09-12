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
    expect(html).toContain('Sign out');
    expect(html).toContain('Studio team');
    expect(html).not.toContain('impressions');
    expect(html).not.toContain('engagement rate');
  });

  it('explains revoked, archived, and unsigned-in recovery without inventing access', () => {
    const denied = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('FORBIDDEN', 'hidden')} />,
    );
    expect(denied).toContain('Return to your studio');
    expect(denied).toContain('Choose a studio');
    const archived = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('RESOURCE_ARCHIVED', 'hidden')} />,
    );
    expect(archived).toContain('archived, revoked or expired');
    const signedOut = renderToStaticMarkup(
      <PlatformRecovery error={new PlatformRequestError('UNAUTHENTICATED', 'hidden')} />,
    );
    expect(signedOut).toContain('Sign in');
  });
});
