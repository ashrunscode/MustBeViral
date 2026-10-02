import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { advertisingCopy, legalPages, privacyCopy, termsCopy } from './legal-copy';
import { LegalPage } from './legal-page';
import { PublicFooter } from './public-footer';
import { studioEn } from './public-copy';
import { StudioPricing } from './studio-pricing';

/** Words that would turn a facts-only page into a claim the repository does not support. */
const inventions = [
  'Suite',
  'Blvd',
  'Monday',
  'cookie banner',
  'tracking pixel',
  'Google Analytics',
  'sell your',
  'sold to',
  'train',
  'governing law',
  'arbitration',
  'warranty',
  'guarantee',
];

function text(html: string) {
  return html.replace(/<[^>]+>/gu, ' ');
}

describe('PublicFooter', () => {
  it('names the entity, the phone, the mail, Houston and the three legal pages on every surface', () => {
    for (const surface of ['studio', 'software', 'legal'] as const) {
      const html = renderToStaticMarkup(<PublicFooter surface={surface} />);
      expect(html).toContain('ERLV INC, DBA Must Be Viral');
      expect(html).toContain('href="tel:+17138999346"');
      expect(html).toContain('href="mailto:studio@mustbeviral.com"');
      expect(html).toContain('Houston, Texas');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/advertising"');
      expect(html).not.toContain('These pages are in English.');
    }
    const studio = renderToStaticMarkup(<PublicFooter surface="studio" />);
    expect(studio).toContain('href="/pricing"');
    expect(studio).toContain('Must Be Viral also makes software.');
    expect(studio).not.toContain('Houston content studio');
    const software = renderToStaticMarkup(<PublicFooter surface="software" />);
    expect(software).not.toContain('href="/pricing"');
    expect(software).toContain('Must Be Viral is also a Houston content studio.');
  });

  it('links the English pages from the Spanish page and says they are in English', () => {
    const html = renderToStaticMarkup(<PublicFooter locale="es" surface="studio" />);
    expect(html).toContain('<nav aria-label="Legal" lang="en">');
    expect(html).toContain('These pages are in English.');
  });
});

describe('StudioPricing', () => {
  it('repeats the two offers in full, the add-on ranges and the same one action', () => {
    const html = renderToStaticMarkup(<StudioPricing />);
    expect(html).toContain('>$700<');
    expect(html).toContain('>$3,500<');
    for (const offer of studioEn.offers) {
      for (const line of offer.includes) expect(html).toContain(line);
    }
    expect(html).toContain('+$200–$400 per shoot');
    expect(html).toContain('+$300–$600 per shoot');
    expect(html).toContain('Included in the Full Package where applicable.');
    expect(html).toContain('The exact figure inside each range is confirmed at booking.');
    expect(html).toContain('The price is the price, and no tier below the Full Package is sold.');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(1);
    expect(html).toContain('href="tel:+17138999346"');
    expect(html).toContain('Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700.');
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).not.toContain('$49');
    expect(html).not.toContain('You brief.');
    expect(html).not.toContain('<form');
    const header = html.slice(0, html.indexOf('</header>'));
    expect(header).toContain('Español');
    expect(header).not.toContain('/software');
  });
});

describe('legal pages', () => {
  it('state the entity, the contact, Houston and the unpublished street address, and invent nothing', () => {
    for (const copy of legalPages) {
      const html = renderToStaticMarkup(<LegalPage copy={copy} />);
      const body = text(html);
      expect(html).toContain('lang="en"');
      expect(html).toContain(`<h1 id="legal-heading">${copy.title}</h1>`);
      expect(body).toContain('ERLV INC, DBA Must Be Viral, in Houston, Texas.');
      expect(body).toContain('The street address is not yet published.');
      expect(body).toContain('studio@mustbeviral.com');
      expect(body).toContain('713-899-9346');
      expect(body).toContain('Last changed 2026-10-02.');
      expect(html).not.toContain('<form');
      expect(html).not.toContain('<input');
      expect(html.slice(html.indexOf('<footer'))).toContain('href="/privacy"');
      for (const word of inventions) expect(body.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('says only what the public pages and the sign-in do', () => {
    const body = text(renderToStaticMarkup(<LegalPage copy={privacyCopy} />));
    expect(body).toContain('set no cookie, run no analytics and load no advertising tag');
    expect(body).toContain('The request-access page collects nothing and creates no account.');
    expect(body).toContain('Supabase Auth');
    expect(body).toContain(
      'or asking for a recovery or verification email sets cookies that Supabase Auth uses',
    );
    expect(body).not.toContain('A visitor who does neither receives none.');
    expect(body).toContain('In production nothing sends them anywhere.');
    expect(body).toContain('An invitation can be accepted for seven days');
    expect(body).toContain('Nothing on this site deletes a record held in the database today.');
    expect(body).toContain('Google Drive is not connected to anything on this site today.');
  });

  it('keeps the terms to the exact offers and the claims rules', () => {
    const body = text(renderToStaticMarkup(<LegalPage copy={termsCopy} />));
    expect(body).toContain('Test Shoot: $700, one time. Full Package: $3,500 a month.');
    expect(body).toContain('+$200–$400 per shoot');
    expect(body).toContain('+$300–$600 per shoot');
    expect(body).toContain('Identifiable minors are never used.');
    expect(body).toContain(
      'We make no claim about reach, views, followers, engagement, leads, bookings, sales or results',
    );
    expect(body).toContain('Charging is not on.');
    expect(body).toContain('No run starts without explicit confirmation of an unexpired quote.');
  });

  it('discloses the AI practice as the brand registry states it', () => {
    const body = text(renderToStaticMarkup(<LegalPage copy={advertisingCopy} />));
    expect(body).toContain('A person directs every shoot and approves every delivered asset.');
    expect(body).toContain(
      'it will name the advertiser of record and carry the platform’s required ad label',
    );
    expect(body).toContain('No paid placement runs today.');
    expect(body).toContain('It shows no person, place or product.');
    expect(body).toContain('model route, provider and cost are inspectable in its receipt');
    expect(body).toContain('On mustbeviral.com today, no generation run can start.');
  });
});
