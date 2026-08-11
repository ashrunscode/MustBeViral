import { describe, expect, it } from 'vitest';

import { createBrowserCoreClient } from './browser-client';

describe('browser Core client boundary', () => {
  it('constructs the typed client from public configuration without making a request', () => {
    const client = createBrowserCoreClient({
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
      NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
    });
    expect(client.request).toBeTypeOf('function');
  });
});
