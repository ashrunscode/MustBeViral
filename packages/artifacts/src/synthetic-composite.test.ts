import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

// Mechanics only. The pixels below are created in this test. They are not customer media,
// not a brand fixture, and not evidence of real-media fidelity.

const MECHANICS_ONLY = 'mechanics only';
const WIDTH = 64;
const HEIGHT = 48;
const RECTANGLE = { left: 8, top: 6, width: 20, height: 12 } as const;

async function compositeSyntheticRectangle(): Promise<{
  readonly label: typeof MECHANICS_ONLY;
  readonly width: number;
  readonly height: number;
  readonly sha256: string;
  readonly png: Buffer;
}> {
  const base = await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 16, g: 32, b: 64 },
    },
  })
    .png()
    .toBuffer();
  const rectangle = await sharp({
    create: {
      width: RECTANGLE.width,
      height: RECTANGLE.height,
      channels: 4,
      background: { r: 220, g: 40, b: 40, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
  const png = await sharp(base)
    .composite([{ input: rectangle, left: RECTANGLE.left, top: RECTANGLE.top }])
    .png()
    .toBuffer();
  const metadata = await sharp(png).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error('synthetic composite is missing dimensions');
  }
  return {
    label: MECHANICS_ONLY,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash('sha256').update(png).digest('hex'),
    png,
  };
}

describe('synthetic sharp composite', () => {
  it('composites a deterministic rectangle and labels the proof mechanics only', async () => {
    const networkCalls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      networkCalls.push(String(input));
      throw new Error('mechanics-only proof must not use the network');
    }) as typeof fetch;
    try {
      const first = await compositeSyntheticRectangle();
      const second = await compositeSyntheticRectangle();
      expect(first.label).toBe(MECHANICS_ONLY);
      expect(first.width).toBe(WIDTH);
      expect(first.height).toBe(HEIGHT);
      expect(first.png.equals(second.png)).toBe(true);
      expect(first.sha256).toBe(second.sha256);
      expect(networkCalls).toEqual([]);
      expect(first.sha256).toBe('bb31c5bdde189848ad477f153660b37734666ab75289d4420cd2c9968efd476c');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('does not import sharp from the artifact package entry', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source.includes('sharp')).toBe(false);
    expect(source.includes('synthetic-composite')).toBe(false);
  });
});
