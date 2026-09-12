import { describe, expect, it } from 'vitest';

import { platformErrorMessage, PlatformRequestError } from './platform-client';

describe('platform client errors', () => {
  it('keeps permission, conflict, and transport failures distinct', () => {
    expect(platformErrorMessage(new PlatformRequestError('NOT_FOUND', 'hidden'))).toContain(
      'unavailable or your access has changed',
    );
    expect(platformErrorMessage(new PlatformRequestError('REVISION_CONFLICT', 'hidden'))).toContain(
      'newer version',
    );
    expect(platformErrorMessage(new Error('offline'))).toContain('not marked as saved');
  });
});
