import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio/campaign/brief',
}));

import SignUpPage, { metadata as signupMetadata } from '../../app/signup/page';
import { metadata as loginMetadata } from '../../app/login/page';
import { metadata as spanishMetadata } from '../../app/es/page';
import { metadata as softwareMetadata } from '../../app/software/page';
import { metadata as pricingMetadata } from '../../app/software/pricing/page';
import { studioEn, studioEs, studioHeroMedia, type StudioHeroMedia } from './public-copy';
import { SoftwareLanding } from './software-landing';
import { SoftwarePricing } from './software-pricing';
import { StatusScreen } from './status-screen';
import { StudioLanding } from './studio-landing';

/** The owner's kill list plus internal names that never belong on a public surface. */
const killList = [
  'viral guaranteed',
  'blow up',
  'explode',
  'crush it',
  'game-changer',
  'revolutionary',
  'AI-powered',
  'discount',
  'limited time',
  'magic',
  'supercharge',
  'unleash',
  'elevate',
  'seamless',
  'one-stop',
  'solutions',
  'leverage',
  'cutting-edge',
  'state-of-the-art',
  '!',
  'Meta Campaign Launch Pack',
  'MustBeViral',
  '$500',
  'P0',
  'P1a',
  'Lumen Skin',
  'ViralGraph',
  'Specified path',
  '→',
];

function expectCleanVoice(html: string) {
  const text = html.replace(/<[^>]+>/gu, ' ');
  for (const phrase of killList) expect(text).not.toContain(phrase);
}

const productLine = 'You brief. Agents produce. You approve every dollar.';

describe('StudioLanding', () => {
  it('opens with the frame, then prices, what is included, the cadence and how to book', () => {
    const html = renderToStaticMarkup(<StudioLanding locale="en" />);
    expect(html).toContain('We film Houston.');
    expect(html).toContain(
      'Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep.',
    );
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('<main'));
    expect(html).toContain('class="studio-hero__frame" data-media="none"');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<video');
    expect(html.indexOf('studio-hero__frame')).toBeLessThan(html.indexOf('>$700<'));
    expect(html.indexOf('>$700<')).toBeLessThan(html.indexOf('One shoot, up to 2 hours'));
    expect(html.indexOf('One shoot, up to 2 hours')).toBeLessThan(
      html.indexOf('four to eight times a month'),
    );
    expect(html.indexOf('four to eight times a month')).toBeLessThan(
      html.indexOf('Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700.'),
    );
    expect(html).toContain('>$700<');
    expect(html).toContain('one time');
    expect(html).toContain('>$3,500<');
    expect(html).toContain('a month');
    expect(html).toContain('4–8 shoots per month, 2–3 hours each');
    expect(html).toContain('Already posting?');
    expect(html).toContain(
      'You do. The gap is the weeks you don’t. We keep the cadence so it doesn’t depend on somebody remembering.',
    );
    expect(html).toContain('href="tel:+17138999346"');
    expect(html).toContain('Book a test shoot.');
    expect(html).toContain('Call 713-899-9346.');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(2);
    expect(html).not.toContain('$149');
    expect(html).not.toContain('$200');
    expect(html).not.toContain(productLine);
    expectCleanVoice(html);
  });

  it('keeps the Spanish page a layout peer that uses only the locked and approved lines', () => {
    const html = renderToStaticMarkup(<StudioLanding locale="es" />);
    expect(html).toContain('lang="es"');
    expect(html).toContain('Filmamos Houston.');
    expect(html).toContain(
      'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
    );
    expect(html).toContain('Agende un test shoot.');
    expect(html).toContain('Llame al 713-899-9346.');
    expect(html).toContain('>$700<');
    expect(html).toContain('una sola vez');
    expect(html).toContain('>$3,500<');
    expect(html).toContain('al mes');
    expect(html).toContain('de cuatro a ocho veces al mes');
    expect(html).toContain('El alcance depende de su cuenta y de su mercado.');
    expect(html).toContain('class="studio-hero__frame" data-media="none"');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(2);
    expect(html.match(/class="studio-offer"/g)).toHaveLength(2);
    expect(html).not.toContain('Buenos días');
    expect(html).not.toContain('We film Houston.');
    expect(html).not.toContain('Already posting?');
    expect(html).not.toContain('turnaround');
    expect(html).not.toContain('$149');
    expectCleanVoice(html);
  });

  it('uses no Spanish sentence outside the locked lines and the approved pairs', () => {
    const approved = new Set([
      'Filmamos Houston.',
      'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
      'Agende un test shoot.',
      'Llame al 713-899-9346.',
      'El Test Shoot cuesta $700, una sola vez: una sesión de hasta dos horas, 2 Reels editados y de 15 a 25 fotos.',
      'Con el Full Package vamos a su negocio de cuatro a ocho veces al mes, grabamos, editamos y le entregamos las publicaciones con su calendario.',
      'Le entregamos el material listo para publicar. El alcance depende de su cuenta y de su mercado.',
      'Agende un test shoot. Dos horas, dos Reels y de 15 a 25 fotos, $700.',
      // Owner-accepted on 2026-09-30 with the first Spanish page.
      'Saltar al contenido',
      'una sola vez',
      'al mes',
      'Reproducir el video',
    ]);
    const sentences = [
      studioEs.h1,
      studioEs.sub,
      studioEs.cta,
      studioEs.phone,
      ...studioEs.offers.flatMap((offer) => [offer.unit, ...offer.includes]),
      studioEs.cadence,
      studioEs.answer,
      studioEs.close,
      studioEs.skip,
      studioEs.playFilm,
    ];
    for (const sentence of sentences) expect(approved.has(sentence)).toBe(true);
    expect(studioEs.question).toBeUndefined();
  });

  it('renders the poster as the priority image when rights-cleared media is configured', () => {
    const media: StudioHeroMedia = {
      poster: { src: '/studio/hero-poster.jpg', width: 1080, height: 1350 },
      video: { src: '/studio/hero.mp4', captions: '/studio/hero.vtt' },
      alt: { en: 'A Houston crew films a storefront.', es: 'Un equipo filma un local en Houston.' },
    };
    const html = renderToStaticMarkup(<StudioLanding locale="en" media={media} />);
    expect(html).toContain('data-media="poster"');
    // next/image preloads the one priority image on the route.
    expect(html).toContain('<link rel="preload" as="image"');
    expect(html).toContain('hero-poster.jpg');
    expect(html).toContain('alt="A Houston crew films a storefront."');
    expect(html.match(/<img /g)).toHaveLength(1);
    // The clip mounts after the poster on the client; the server never ships it as the LCP element.
    expect(html).not.toContain('<video');
    expect(html).toContain('Play the film');
  });

  it('ships without studio footage until permission is on file', () => {
    expect(studioHeroMedia).toBeNull();
    expect(studioEn.offers.map((offer) => offer.name)).toEqual(['Test Shoot', 'Full Package']);
  });
});

describe('SoftwareLanding', () => {
  it('shows the film and the path without selling the Houston studio', () => {
    const html = renderToStaticMarkup(<SoftwareLanding />);
    expect(html).toContain(productLine);
    expect(html).toContain('The film follows one photo from a Drive folder to a receipt.');
    expect(html).toContain('photo.jpg arrives from a selected Google Drive folder.');
    expect(html).toContain('Enrollment is closed.');
    expect(html).toContain('href="/login"');
    expect(html).toContain('Sign in to Studio');
    expect(html).toContain('href="mailto:studio@mustbeviral.com?subject=Request%20access"');
    expect(html).toContain('software-hero-poster.jpg');
    expect(html).toContain('<link rel="preload" as="image"');
    expect(html).not.toContain('p0-software');
    expect(html).toContain('class="pub-play pub-play--reduced-motion"');
    expect(html.indexOf('</header>')).toBeLessThan(html.indexOf('<main'));
    expect(html).not.toContain('We film Houston.');
    expect(html).not.toContain('$700');
    expect(html).not.toContain('$3,500');
    expectCleanVoice(html);
  });
});

describe('SoftwarePricing', () => {
  it('lists the provisional catalog without a buy button', () => {
    const html = renderToStaticMarkup(<SoftwarePricing />);
    expect(html).toContain('These prices are the provisional catalog.');
    expect(html).toContain('Signing in does not start a subscription.');
    expect(html).toContain('$49');
    expect(html).toContain('$149');
    expect(html).toContain('$399');
    expect(html).toContain('1 brand, 2 seats');
    expect(html).toContain('9 accounts, 10\u00a0GB');
    expect(html).toContain('1,000,000,000 bytes');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Buy');
    expect(html).not.toContain('$700');
    expect(html).not.toContain('$3,500');
    expect(html).not.toContain('We film Houston.');
    expectCleanVoice(html);
  });
});

describe('SignUpPage', () => {
  it('offers the mail path and collects nothing', () => {
    const html = renderToStaticMarkup(<SignUpPage />);
    expect(html).toContain('Request access');
    expect(html).toContain('href="mailto:studio@mustbeviral.com?subject=Request%20access"');
    expect(html).toContain('This screen collects nothing. No account is created here.');
    expect(html).toContain('Sign in to Studio');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('Create account');
    expectCleanVoice(html);
  });
});

describe('route metadata', () => {
  it('gives every public route its own title', () => {
    const titles = [
      spanishMetadata.title,
      softwareMetadata.title,
      pricingMetadata.title,
      loginMetadata.title,
      signupMetadata.title,
    ].map((title) => (typeof title === 'string' ? title : JSON.stringify(title)));
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('StatusScreen', () => {
  it('renders closed enrollment without a signup form', () => {
    const html = renderToStaticMarkup(
      <StatusScreen title="Enrollment is closed" actions={[{ href: '/login', label: 'Sign in' }]}>
        <p>Self-service signup is not enabled.</p>
      </StatusScreen>,
    );
    expect(html).toContain('Enrollment is closed');
    expect(html).toContain('Self-service signup is not enabled.');
    expect(html).not.toContain('type="email"');
    expect(html).not.toContain('Create account');
  });
});
