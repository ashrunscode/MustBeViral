import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import { config as proxyConfig } from '../../proxy';
import { studioHeroMedia } from './public-copy';

const assets = [
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

  it('uses long-lived caching only for the two content-versioned hero files', async () => {
    expect(studioHeroMedia?.video?.src).toBe(assets[0][0]);
    expect(studioHeroMedia?.poster.src).toBe(assets[1][0]);
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
