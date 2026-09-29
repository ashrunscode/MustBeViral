import { describe, expect, it } from 'vitest';

import { readWebPublicEnvironment } from './public-environment';

describe('web public environment', () => {
  it('fails closed when an environment is incomplete', () => {
    expect(() => readWebPublicEnvironment({})).toThrow();
  });

  it('returns only registered public settings', () => {
    expect(
      readWebPublicEnvironment({
        NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
        NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
        NEXT_PUBLIC_COLLABORATION_API_URL: 'http://127.0.0.1:8788',
        UNREGISTERED_VALUE: 'ignored',
      }),
    ).not.toHaveProperty('UNREGISTERED_VALUE');
  });
});
