import { describe, expect, it } from 'vitest';

import { parseCoreEnvironment, parseWebPublicEnvironment } from './index';

describe('typed environment boundaries', () => {
  it('accepts explicit local web configuration', () => {
    expect(
      parseWebPublicEnvironment({
        NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
        NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
        NEXT_PUBLIC_COLLABORATION_API_URL: 'http://127.0.0.1:8788',
      }),
    ).toMatchObject({
      NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
    });
  });

  it('requires the web application URL to be an exact origin', () => {
    expect(() =>
      parseWebPublicEnvironment({
        NEXT_PUBLIC_APP_ORIGIN: 'https://mustbeviral.com/studio',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
        NEXT_PUBLIC_CORE_API_URL: 'https://api.mustbeviral.com',
      }),
    ).toThrow();
  });

  it('rejects undocumented fields and unsafe URL protocols', () => {
    expect(() =>
      parseCoreEnvironment({
        APP_ENV: 'production',
        SUPABASE_URL: 'file:///tmp/database',
        SUPABASE_JWT_AUDIENCE: 'authenticated',
        CORS_ALLOWED_ORIGINS: 'https://mustbeviral.com',
        HIDDEN_SECRET: 'must-not-pass',
      }),
    ).toThrow();
  });
  it('requires https for the collaboration API outside loopback development', () => {
    const base = {
      NEXT_PUBLIC_APP_ORIGIN: 'http://127.0.0.1:3000',
      NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'local-publishable-key-value',
      NEXT_PUBLIC_CORE_API_URL: 'http://127.0.0.1:8787',
    };
    for (const accepted of [
      'https://collab.mustbeviral.com',
      'http://127.0.0.1:8788',
      'http://localhost:8788',
      'http://[::1]:8788',
    ]) {
      expect(
        parseWebPublicEnvironment({ ...base, NEXT_PUBLIC_COLLABORATION_API_URL: accepted })
          .NEXT_PUBLIC_COLLABORATION_API_URL,
        accepted,
      ).toBe(accepted);
    }
    for (const rejected of [
      'http://collab.mustbeviral.com',
      'http://127.0.0.1.example.com:8788',
      'http://localhost.example.com',
      'http://localhost@collab.mustbeviral.com',
      'http://collab.mustbeviral.com\\@127.0.0.1',
      'http://10.0.0.5:8788',
      'ws://127.0.0.1:8788',
    ]) {
      expect(
        () => parseWebPublicEnvironment({ ...base, NEXT_PUBLIC_COLLABORATION_API_URL: rejected }),
        rejected,
      ).toThrow();
    }
  });
});
