import { describe, expect, it } from 'vitest';

import { isEnabledProviderTransport } from './index';

describe('provider boundary', () => {
  it('starts with fal behind provider-neutral interfaces', () => {
    expect(isEnabledProviderTransport('fal')).toBe(true);
    expect(isEnabledProviderTransport('google-direct')).toBe(false);
  });
});
