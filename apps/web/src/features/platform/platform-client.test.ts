import { describe, expect, it } from 'vitest';

import {
  platformErrorMessage,
  platformMutationErrorMessage,
  PlatformRequestError,
} from './platform-client';

describe('platform client errors', () => {
  it('keeps permission, missing, unavailable, and conflict failures distinct', () => {
    expect(platformErrorMessage(new PlatformRequestError('FORBIDDEN', 'hidden'))).toContain(
      'do not have permission',
    );
    expect(platformErrorMessage(new PlatformRequestError('NOT_FOUND', 'hidden'))).toContain(
      'unavailable or your access has changed',
    );
    expect(platformErrorMessage(new PlatformRequestError('INTERNAL_ERROR', 'hidden'))).toBe(
      'We could not confirm this request. Check your connection and retry.',
    );
    expect(
      platformErrorMessage(new PlatformRequestError('INTERNAL_ERROR', 'hidden')),
    ).not.toContain('not marked as saved');
    expect(platformErrorMessage(new Error('offline'))).not.toContain('not marked as saved');
    expect(platformErrorMessage(new PlatformRequestError('REVISION_CONFLICT', 'hidden'))).toContain(
      'newer version',
    );
    expect(
      platformMutationErrorMessage(new PlatformRequestError('INTERNAL_ERROR', 'hidden')),
    ).toContain('not marked as saved');
    expect(platformMutationErrorMessage(new Error('offline'))).toContain('not marked as saved');
    expect(
      platformMutationErrorMessage(new PlatformRequestError('REVISION_CONFLICT', 'hidden')),
    ).not.toContain('not marked as saved');
    expect(platformErrorMessage(new PlatformRequestError('EXPIRED_OFFER', 'hidden'))).toContain(
      'known expired offer',
    );
    expect(
      platformErrorMessage(new PlatformRequestError('CONTRADICTORY_KNOWLEDGE', 'hidden')),
    ).toContain('contradictory assertions');
  });
});
