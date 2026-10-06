import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import { config as proxyConfig } from '../../proxy';
import { studioEnHeroMedia, studioHeroMedia } from './public-copy';

const plateAssets = [
  [
    '/films/s0-studio-hero-d55af8ec3d69.mp4',
    2163648,
    'd55af8ec3d692af3545e001bc40d7c559fbff9c09de281da1c9a7cfca0cf01bb',
  ],
  [
    '/films/s0-studio-hero-poster-41da8acddb3f.jpg',
    119229,
    '41da8acddb3fbf938ba8f250228641dca41cf24414601c13ae79855d00e81fe5',
  ],
] as const;

const englishAssets = [
  [
    '/films/s0-studio-hero-en-06371b2bb52f.mp4',
    2916577,
    '06371b2bb52f125b3912aebed340fc643710e7afea38554a4e397dc0c07f30c3',
  ],
  [
    '/films/s0-studio-hero-en-poster-e838d8416399.jpg',
    137672,
    'e838d84163994eb30a824571d1d2a860a34a9e6cfb322f8372e589cadcdf2304',
  ],
  [
    '/films/s0-studio-hero-en-5a3deeb9fb23.vtt',
    328,
    '5a3deeb9fb235176288a6df16226ee6862d6b68cc21ca22369bf5c792bc16650',
  ],
] as const;

const assets = [...plateAssets, ...englishAssets] as const;

describe('Approved S0 assets', () => {
  it.each(assets)(
    'serves the byte-identical, versioned plate asset %s outside the auth namespace',
    (src, bytes, sha256) => {
      const path = new URL(`../../public${src}`, import.meta.url);
      expect(statSync(path).size).toBe(bytes);
      expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(sha256);
      const matcher = new RegExp(`^${proxyConfig.matcher[0]}$`, 'u');
      expect(matcher.test(src)).toBe(false);
      expect(matcher.test('/studio/internal')).toBe(true);
    },
  );

  it('uses long-lived caching only for the content-versioned hero files', async () => {
    expect(studioHeroMedia.video?.src).toBe(plateAssets[0][0]);
    expect(studioHeroMedia.poster.src).toBe(plateAssets[1][0]);
    expect(studioEnHeroMedia.video?.src).toBe(englishAssets[0][0]);
    expect(studioEnHeroMedia.poster.src).toBe(englishAssets[1][0]);
    expect(studioEnHeroMedia.video?.captions).toBe(englishAssets[2][0]);
    const headers = await nextConfig.headers?.();
    const immutable = headers?.filter((rule) =>
      rule.headers.some(({ key, value }) => key === 'Cache-Control' && value.includes('immutable')),
    );
    expect(immutable).toEqual(
      assets.map(([source]) => ({
        source,
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      })),
    );
    for (const rule of headers ?? []) {
      if (!assets.some(([source]) => source === rule.source)) {
        expect(rule.headers.some(({ key }) => key === 'Cache-Control')).toBe(false);
      }
    }
  });
});
