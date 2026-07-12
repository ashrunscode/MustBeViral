import { describe, expect, it } from 'vitest';

import { requirePrivateArtifact } from './index';

describe('artifact visibility', () => {
  it('fails closed for public canonical media', () => {
    expect(requirePrivateArtifact('private')).toBe('private');
    expect(() => requirePrivateArtifact('public')).toThrow('must remain private');
  });
});
