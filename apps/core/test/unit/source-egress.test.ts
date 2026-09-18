import { describe, expect, it, vi } from 'vitest';

import {
  createSourceCaptureEgress,
  SourceCaptureEgressUnavailableError,
} from '../../src/composition/source-egress';

describe('source capture egress', () => {
  it('fails closed locally when the public-only binding is missing', () => {
    expect(() => createSourceCaptureEgress({})).toThrow(SourceCaptureEgressUnavailableError);
  });
  it('does not fall back to unrestricted global fetch in development', async () => {
    const globalFetch = vi.fn<typeof fetch>();
    const original = globalThis.fetch;
    globalThis.fetch = globalFetch;
    try {
      expect(() => createSourceCaptureEgress({ APP_ENV: 'development' })).toThrow(
        SourceCaptureEgressUnavailableError,
      );
      expect(globalFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = original;
    }
  });
  it('strips credentials on the synthetic test seam and labels it', async () => {
    const synthetic = vi.fn<typeof fetch>(
      async () => new Response('synthetic-website', { status: 200 }),
    );
    const egress = createSourceCaptureEgress({}, { syntheticFetch: synthetic });
    expect(egress.mode).toBe('synthetic-test-seam');
    await egress.fetch(
      new Request('https://washbodega.example/', {
        headers: { authorization: 'Bearer user-jwt', apikey: 'secret', cookie: 'session=1' },
      }),
    );
    const forwarded = new Request(synthetic.mock.calls[0]?.[0] as RequestInfo);
    expect(forwarded.headers.get('authorization')).toBeNull();
    expect(forwarded.headers.get('apikey')).toBeNull();
    expect(forwarded.headers.get('cookie')).toBeNull();
    expect(forwarded.redirect).toBe('manual');
  });
  it('uses public-only binding when present and never the caller JWT', async () => {
    const bound = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
    const egress = createSourceCaptureEgress({
      PUBLIC_EGRESS: { fetch: bound } as unknown as Fetcher,
    });
    expect(egress.mode).toBe('public-egress-binding');
    await egress.fetch('https://example.test/', { headers: { authorization: 'Bearer leaked' } });
    expect(
      new Request(bound.mock.calls[0]?.[0] as RequestInfo).headers.get('authorization'),
    ).toBeNull();
  });
  it('uses strictly-public global fetch only for staging and production', async () => {
    const globalFetch = vi.fn<typeof fetch>(async () => new Response('ok', { status: 200 }));
    const original = globalThis.fetch;
    globalThis.fetch = globalFetch;
    try {
      const egress = createSourceCaptureEgress({ APP_ENV: 'production' });
      expect(egress.mode).toBe('strict-public-global-fetch');
      await egress.fetch('https://example.test/', { headers: { authorization: 'Bearer leaked' } });
      expect(
        new Request(globalFetch.mock.calls[0]?.[0] as RequestInfo).headers.get('authorization'),
      ).toBeNull();
    } finally {
      globalThis.fetch = original;
    }
  });
});
