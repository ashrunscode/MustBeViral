import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClaims = vi.hoisted(() => vi.fn());
const getSession = vi.hoisted(() => vi.fn());

vi.mock('../../src/lib/supabase/server', () => ({
  createServerSupabaseClient: async () => ({ auth: { getClaims, getSession } }),
}));

vi.mock('../../src/config/public-environment', () => ({
  readWebPublicEnvironment: () => ({
    NEXT_PUBLIC_APP_ORIGIN: 'https://staging.mustbeviral.example',
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.example',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value-for-test',
    NEXT_PUBLIC_CORE_API_URL: 'https://core.example',
  }),
}));

import { GET } from '../../app/api/download/[id]/route';

const artifactId = '10000000-0000-4000-8000-000000000021';
const capability = `payload.${'s'.repeat(43)}`;

function request(query = `token=${capability}`): Request {
  return new Request(`https://staging.mustbeviral.example/api/download/${artifactId}?${query}`);
}

function context(id = artifactId) {
  return { params: Promise.resolve({ id }) };
}

describe('authenticated customer download bridge', () => {
  beforeEach(() => {
    getClaims.mockReset();
    getSession.mockReset();
    getClaims.mockResolvedValue({ data: { claims: { sub: 'actor-1' } }, error: null });
    getSession.mockResolvedValue({
      data: { session: { access_token: 'caller-access-token', user: { id: 'actor-1' } } },
      error: null,
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it.each([
    { id: '../foreign', query: `token=${capability}` },
    { id: artifactId, query: 'token=malformed' },
    { id: artifactId, query: `token=${capability}&next=https://attacker.invalid` },
    { id: artifactId, query: `token=${capability}&token=${capability}` },
  ])('rejects malformed or expanded input before authentication: $id $query', async (input) => {
    const response = await GET(request(input.query), context(input.id));

    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(getClaims).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fails closed when the cookie claims are missing', async () => {
    getClaims.mockResolvedValue({ data: { claims: null }, error: null });

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  it('fails closed when the validated claims have no cookie session', async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null });

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  it('fails closed when the cookie session is expired or disagrees with the claims', async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: 'stale-token', user: { id: 'different-actor' } } },
      error: { code: 'session_expired' },
    });

    const response = await GET(request(), context());

    expect(response.status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toBeNull();
  });

  it('forwards the caller bearer and streams only safe download headers', async () => {
    const upstreamBytes = Uint8Array.of(0x50, 0x4b, 0x03);
    const upstreamFetch = vi.mocked(fetch);
    upstreamFetch.mockResolvedValue(
      new Response(upstreamBytes, {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="mustbeviral-launch-pack-run-safe.zip"',
          'content-length': String(upstreamBytes.byteLength),
          'content-type': 'application/zip',
          location: 'https://attacker.invalid/redirect',
          'set-cookie': 'secret=leak',
          'x-internal-object-key': 'private/customer/object',
        },
      }),
    );

    const response = await GET(request(), context());

    expect(upstreamFetch).toHaveBeenCalledOnce();
    const [url, init] = upstreamFetch.mock.calls[0] ?? [];
    expect(String(url)).toBe(
      `https://core.example/v1/artifacts/${artifactId}/content?token=${capability}`,
    );
    expect(init).toMatchObject({ method: 'GET', cache: 'no-store', redirect: 'manual' });
    const forwardedHeaders = new Headers(init?.headers);
    expect(forwardedHeaders.get('authorization')).toBe('Bearer caller-access-token');
    expect(forwardedHeaders.get('cache-control')).toBe('no-store');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-length')).toBe('3');
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="mustbeviral-launch-pack-run-safe.zip"',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-internal-object-key')).toBeNull();
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(upstreamBytes);
  });

  it('never follows or returns an upstream redirect', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://attacker.invalid/download' },
      }),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('passes a bounded expired-capability status without proxying its body', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('raw upstream detail', {
        status: 410,
        headers: { 'content-type': 'text/plain', 'x-provider-detail': 'private' },
      }),
    );

    const response = await GET(request(), context());

    expect(response.status).toBe(410);
    expect(await response.text()).toBe('');
    expect(response.headers.get('x-provider-detail')).toBeNull();
  });

  it('maps network and unexpected upstream failures to a generic no-store response', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('private network detail'));
    const networkFailure = await GET(request(), context());
    expect(networkFailure.status).toBe(502);
    expect(await networkFailure.text()).toBe('');

    vi.mocked(fetch).mockResolvedValueOnce(new Response('private core detail', { status: 500 }));
    const upstreamFailure = await GET(request(), context());
    expect(upstreamFailure.status).toBe(502);
    expect(await upstreamFailure.text()).toBe('');
    expect(upstreamFailure.headers.get('cache-control')).toBe('private, no-store');
  });
});
