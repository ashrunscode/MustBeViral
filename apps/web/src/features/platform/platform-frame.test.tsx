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
