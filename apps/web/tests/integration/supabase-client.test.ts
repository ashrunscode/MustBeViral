import { describe, expect, it } from 'vitest';

import { createBrowserSupabaseClient } from '../../src/lib/supabase/client';

describe('Supabase browser boundary', () => {
  it('constructs the supported client from typed public configuration without network access', () => {
    const client = createBrowserSupabaseClient({
      NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
      NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
      NEXT_PUBLIC_COLLABORATION_API_URL: 'http://127.0.0.1:8788',
    });
    expect(client.auth).toBeDefined();
    expect(client.storage).toBeDefined();
  });
});
