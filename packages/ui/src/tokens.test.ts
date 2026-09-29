import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { lightfieldCssVariables, lightfieldTokens } from './tokens';

type Rgb = readonly [number, number, number];

function parseColor(value: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})([0-9a-f]{2})?$/iu.exec(value);
  if (hex) {
    const digits = hex[1] ?? '';
    const rgb = [0, 2, 4].map((offset) => parseInt(digits.slice(offset, offset + 2), 16));
    return { rgb: rgb as unknown as Rgb, alpha: hex[2] ? parseInt(hex[2], 16) / 255 : 1 };
  }
  const rgba = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/u.exec(value);
  if (rgba) {
    return { rgb: [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])], alpha: Number(rgba[4]) };
  }
  throw new Error(`Unsupported colour ${value}`);
}

/** Source-over composite of a colour (with its alpha scaled by `coverage`) onto an opaque colour. */
function over(value: string, backdrop: Rgb, coverage = 1): Rgb {
  const { rgb, alpha } = parseColor(value);
  const a = alpha * coverage;
  return rgb.map(
    (channel, index) => channel * a + (backdrop[index] ?? 0) * (1 - a),
  ) as unknown as Rgb;
}

function luminance(rgb: Rgb): number {
  const linear = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (linear[0] ?? 0) + 0.7152 * (linear[1] ?? 0) + 0.0722 * (linear[2] ?? 0);
}

function contrast(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

const { color } = lightfieldTokens;
const white: Rgb = [255, 255, 255];
const card = over(color.card, white);
const paper = over(color.paper, white);
const paper2 = over(color.paper2, white);

describe('Lightfield tokens and styles.css', () => {
  it('declares every token variable in styles.css with the same value', () => {
    const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
    const root = /:root\s*\{([^}]*)\}/u.exec(css)?.[1] ?? '';
    const normalise = (value: string) =>
      value
        .toLowerCase()
        .replace(/\s+/gu, '')
        .replace(/\d*\.\d+/gu, (number) => String(Number(number)));
    for (const [name, value] of Object.entries(lightfieldCssVariables)) {
      const declared = new RegExp(`${name}:\\s*([^;]+);`, 'u').exec(root)?.[1];
      expect(declared === undefined ? undefined : normalise(declared), name).toBe(normalise(value));
    }
  });
});

describe('WCAG AA text contrast of the Lightfield colour roles', () => {
  it('keeps white text on the brand blue below AA, which is why fills use the deeper blues', () => {
    expect(contrast(white, over(color.signal, white))).toBeLessThan(4.5);
  });

  it.each([
    ['signalFill', color.signalFill, 4.76],
    ['signalFillHover', color.signalFillHover, 5.49],
    ['signalFillPressed', color.signalFillPressed, 6.58],
  ])('gives white text on %s at least 4.5:1', (_name, fill, measured) => {
    const ratio = contrast(white, over(fill, white));
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeCloseTo(measured, 2);
  });

  // Each status ink against the neutral surfaces plus the tinted wells it is used on in apps/web.
  const washOnPaper2 = over(color.washFaint, paper2);
  it.each([
    ['okInk', color.okInk, [washOnPaper2, over(color.ok, white, 0.06)]],
    ['attentionInk', color.attentionInk, [over(color.attention, paper, 0.14)]],
    [
      'failInk',
      color.failInk,
      [over(color.fail, paper, 0.12), over(color.fail, white, 0.08), over('#f55434', paper2, 0.06)],
    ],
    ['signalInk', color.signalInk, [over(color.signal, white, 0.12)]],
  ] as const)('keeps %s text at 4.5:1 on every surface it sits on', (_name, ink, tints) => {
    const text = over(ink, white);
    for (const background of [card, paper, paper2, ...tints]) {
      expect(contrast(text, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps body ink at 4.5:1 on paper-2 and muted ink below it', () => {
    expect(contrast(over(color.ink, paper2), paper2)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(over(color.inkMuted, paper), paper)).toBeLessThan(4.5);
  });
});
