import { describe, expect, it, vi } from 'vitest';

import { MustBeViralClientError } from '@mustbeviral/contracts';

import { packshotContentType, sha256HexOfBytes, uploadPackshot } from './packshot-upload';

describe('packshot upload', () => {
  it('accepts jpeg png and webp names when the browser omits a type', () => {
    expect(packshotContentType(new File([new Uint8Array([1])], 'hero.PNG'))).toBe('image/png');
    expect(packshotContentType(new File([new Uint8Array([1])], 'hero.gif'))).toBeNull();
  });

  it('hashes bytes without leaking them into the error path', async () => {
    expect(await sha256HexOfBytes(Uint8Array.of(1, 2, 3))).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('signs then PUTs the exact bytes through the same-origin core rewrite', async () => {
    const file = new File([Uint8Array.of(9, 8, 7)], 'bottle.jpg', { type: 'image/jpeg' });
    const request = vi.fn(async () => ({
      data: {
        artifact_id: 'artifact-packshot',
        upload_url: 'https://core.example.test/v1/artifacts/artifact-packshot/content?token=upload',
        expires_at: '2026-08-18T12:00:00.000Z',
      },
    }));
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 204 }));
    await expect(
      uploadPackshot(
        { request } as never,
        'project-1',
        file,
        fetchImplementation as unknown as typeof fetch,
      ),
    ).resolves.toEqual({ type: 'ok', artifactId: 'artifact-packshot' });
    expect(request).toHaveBeenCalledWith(
      'create_artifact_upload',
      expect.objectContaining({
        body: expect.objectContaining({
          project_id: 'project-1',
          content_type: 'image/jpeg',
          purpose: 'packshot',
        }),
      }),
    );
    expect(fetchImplementation).toHaveBeenCalledWith(
      expect.stringContaining('/v1/artifacts/artifact-packshot/content'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('maps a missing browser token to session_expired without attempting the upload', async () => {
    const file = new File([Uint8Array.of(9, 8, 7)], 'bottle.jpg', { type: 'image/jpeg' });
    const request = vi.fn(async () => {
      throw new MustBeViralClientError('A Supabase session is required.', 'AUTH_REQUIRED');
    });
    const fetchImplementation = vi.fn();

    await expect(
      uploadPackshot(
        { request } as never,
        'project-1',
        file,
        fetchImplementation as unknown as typeof fetch,
      ),
    ).resolves.toEqual({ type: 'session_expired' });
    expect(request).toHaveBeenCalledOnce();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('maps Core UNAUTHENTICATED to session_expired without replaying or PUTting bytes', async () => {
    const file = new File([Uint8Array.of(9, 8, 7)], 'bottle.jpg', { type: 'image/jpeg' });
    const request = vi.fn(async () => ({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'The bearer session is missing or expired.',
        request_id: 'request-packshot-expired',
        retryable: false,
      },
    }));
    const fetchImplementation = vi.fn();

    await expect(
      uploadPackshot(
        { request } as never,
        'project-1',
        file,
        fetchImplementation as unknown as typeof fetch,
      ),
    ).resolves.toEqual({ type: 'session_expired' });
    expect(request).toHaveBeenCalledOnce();
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
