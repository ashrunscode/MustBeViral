import { afterEach, describe, expect, it, vi } from 'vitest';

import robots from '../../app/robots';
import sitemap from '../../app/sitemap';
import { studioEn, studioEs } from '../components/public-copy';
import { softwareStructuredData, studioStructuredData } from '../components/structured-data';
import { buildLlmsText } from './llms-text';
import { publicOrigin } from './public-origin';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('publicOrigin', () => {
  it('reads the one public origin and refuses anything that is not an origin', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://example.test');
    expect(publicOrigin()).toBe('https://example.test');
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'not a url');
    expect(publicOrigin()).toBeUndefined();
  });
});

describe('robots and sitemap', () => {
  it('opens the public pages and keeps the app, the auth screens and the API out', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://example.test');
    const rules = robots();
    const [rule] = Array.isArray(rules.rules) ? rules.rules : [rules.rules];
    expect(rule?.allow).toBe('/');
    expect(rule?.disallow).toEqual(
      expect.arrayContaining(['/studio', '/api/', '/login', '/signup', '/auth/']),
    );
    expect(rules.sitemap).toBe('https://example.test/sitemap.xml');
  });

  it('lists the four public pages with the studio pages as peers', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://example.test');
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://example.test/',
      'https://example.test/es',
      'https://example.test/pricing',
      'https://example.test/software',
      'https://example.test/software/pricing',
      'https://example.test/privacy',
      'https://example.test/terms',
      'https://example.test/advertising',
    ]);
    expect(entries[1]?.alternates?.languages).toEqual({
      en: 'https://example.test/',
      es: 'https://example.test/es',
      'x-default': 'https://example.test/',
    });
  });

  it('names no host when the origin is unknown', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', '');
    expect(sitemap()).toEqual([]);
    expect(robots().sitemap).toBeUndefined();
  });
});

describe('structured data', () => {
  it('states the studio with its exact prices, the phone and no invented address', () => {
    const data = studioStructuredData(studioEn, 'https://example.test');
    expect(data['@type']).toBe('LocalBusiness');
    expect(data.url).toBe('https://example.test/');
    expect(data.telephone).toBe('+17138999346');
    expect(data).not.toHaveProperty('address');
    expect(data).not.toHaveProperty('priceRange');
    const offers = data.makesOffer as readonly Record<string, unknown>[];
    expect(offers.map((offer) => offer.name)).toEqual(['Test Shoot', 'Full Package']);
    expect(offers[0]?.price).toBe('700');
    expect(offers[1]?.priceSpecification).toMatchObject({ price: '3500', unitCode: 'MON' });
    expect(JSON.stringify(data)).not.toContain('$149');
  });

  it('keeps the Spanish studio to its locked lines and the approved price sentence', () => {
    const data = studioStructuredData(studioEs, undefined);
    expect(data.description).toBe(studioEs.sub);
    expect(data).not.toHaveProperty('url');
    const offers = data.makesOffer as readonly Record<string, unknown>[];
    // The only Spanish in the offer descriptions is the two approved sentences.
    expect(offers[0]?.description).toBe(studioEs.offers[0].includes[0]);
    expect(offers[1]?.description).toBe(studioEs.offers[1].includes[0]);
  });

  it('declares no software offer while the catalog is provisional', () => {
    const data = softwareStructuredData('https://example.test');
    expect(data['@type']).toBe('SoftwareApplication');
    expect(data).not.toHaveProperty('offers');
    expect(data.description).toBe('You brief. Agents produce. You approve every dollar.');
  });
});

describe('llms.txt', () => {
  it('carries the locked lines, the exact prices and the closed enrollment, from the page copy', () => {
    const text = buildLlmsText('https://example.test');
    expect(text.startsWith('# Must Be Viral\n')).toBe(true);
    expect(text).toContain('- We film Houston.');
    expect(text).toContain('- Test Shoot: $700, one time. One shoot, up to 2 hours.');
    expect(text).toContain(
      '- Full Package: $3,500, a month. 4–8 shoots per month, 2–3 hours each.',
    );
    expect(text).toContain('- Spanish page: https://example.test/es (Filmamos Houston.');
    expect(text).toContain('- You brief. Agents produce. You approve every dollar.');
    expect(text).toContain('These prices are the provisional catalog. Charging is not on.');
    expect(text).toContain('- Solo: $49 a month. 1 active brand, 2 operator seats.');
    expect(text).toContain('Enrollment is closed.');
    expect(text).toContain('- Pricing page: https://example.test/pricing');
    expect(text).toContain('- Add-on, 24-hour turnaround: +$200–$400 per shoot.');
    expect(text).toContain('- Privacy: https://example.test/privacy');
    expect(text).toContain('- ERLV INC, DBA Must Be Viral');
    expect(text).toContain('The street address is not yet published.');
    expect(text).not.toContain('viral guaranteed');
    expect(text).not.toContain('!');
    expect(text).not.toContain('→');
  });

  it('uses paths alone when the origin is unknown', () => {
    expect(buildLlmsText(undefined)).toContain('- English page: /\n');
  });
});
