import { afterEach, describe, expect, it, vi } from 'vitest';

import robots from '../../app/robots';
import sitemap from '../../app/sitemap';
import { GET as publicLlms } from '../../app/llms.txt/route';
import { studioEn, studioEs } from '../components/public-copy';
import { softwareStructuredData, studioStructuredData } from '../components/structured-data';
import { buildLlmsText } from './llms-text';
import { publicOrigin } from './public-origin';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('publicOrigin', () => {
  it.each([
    undefined,
    '',
    'not a url',
    'http://127.0.0.1:3113',
    'https://staging.mustbeviral.example',
    'https://mustbeviral-web-production-ashrunscode-projects.vercel.app',
    'https://example.test/path?redirect=1',
  ])('keeps the canonical site origin when the deployment origin is %s', (origin) => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', origin);
    expect(publicOrigin()).toBe('https://mustbeviral.com');
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
    expect(rules.sitemap).toBe('https://mustbeviral.com/sitemap.xml');
  });

  it('lists the indexable public pages with the studio pages as peers', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'https://example.test');
    const entries = sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      'https://mustbeviral.com/',
      'https://mustbeviral.com/es',
      'https://mustbeviral.com/pricing',
      'https://mustbeviral.com/software',
      'https://mustbeviral.com/software/pricing',
      'https://mustbeviral.com/privacy',
      'https://mustbeviral.com/terms',
      'https://mustbeviral.com/advertising',
    ]);
    expect(entries[1]?.alternates?.languages).toEqual({
      en: 'https://mustbeviral.com/',
      es: 'https://mustbeviral.com/es',
      'x-default': 'https://mustbeviral.com/',
    });
  });

  it('keeps a reachable sitemap when the deployment origin is unknown', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', '');
    expect(sitemap()).toHaveLength(8);
    expect(robots().sitemap).toBe('https://mustbeviral.com/sitemap.xml');
  });

  it('records a truthful modification date for every public document', () => {
    expect(sitemap().map((entry) => entry.lastModified)).toEqual(Array(8).fill('2026-10-03'));
  });

  it('does not invent new page modification dates on a later build', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-10-03T12:00:00Z'));
    expect(sitemap().map((entry) => entry.lastModified)).toEqual(Array(8).fill('2026-10-03'));
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
  it('serves canonical links even when the configured deployment is protected', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_APP_ORIGIN',
      'https://mustbeviral-web-production-ashrunscode-projects.vercel.app',
    );
    const response = publicLlms();
    const text = await response.text();
    expect(response.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(text).toContain('- English page: https://mustbeviral.com/\n');
    expect(text).toContain('- Pricing page: https://mustbeviral.com/pricing');
    expect(text).not.toContain('vercel.app');
  });
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
