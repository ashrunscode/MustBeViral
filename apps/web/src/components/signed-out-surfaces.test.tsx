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
import { metadata as studioPricingMetadata } from '../../app/pricing/page';
import { metadata as privacyMetadata } from '../../app/privacy/page';
import { metadata as termsMetadata } from '../../app/terms/page';
import { metadata as advertisingMetadata } from '../../app/advertising/page';
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
    expect(html).toContain('data-media="poster"');
    expect(html).toContain('studio-frame__media');
    expect(html.match(/<img /g)).toHaveLength(1);
    expect(html).not.toContain('<video');
    // The frame holds the decision: the locked lines, the action, then both offers inside it.
    const frameStart = html.indexOf('class="studio-frame"');
    const frameEnd = html.indexOf('class="studio-body"');
    expect(frameStart).toBeGreaterThan(-1);
    expect(html.indexOf('We film Houston.')).toBeGreaterThan(frameStart);
    expect(html.indexOf('>$700<')).toBeGreaterThan(frameStart);
    expect(html.indexOf('>$3,500<')).toBeLessThan(frameEnd);
    expect(html.indexOf('class="pub-cta"')).toBeLessThan(html.indexOf('>$700<'));
    expect(html.indexOf('>$700<')).toBeLessThan(html.indexOf('One shoot, up to 2 hours'));
    expect(html.indexOf('One shoot, up to 2 hours')).toBeLessThan(
      html.indexOf('four to eight times a month'),
    );
    // The six kinds of work follow the cadence; the objection and its answer sit under all six.
    expect(html.indexOf('four to eight times a month')).toBeLessThan(
      html.indexOf('Your kind of work.'),
    );
    expect(html.indexOf('Your kind of work.')).toBeLessThan(html.indexOf('Already posting?'));
    expect(html.indexOf('Already posting?')).toBeLessThan(
      html.indexOf('Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700.'),
    );
    // Six composed rows, not a stack of cards.
    expect(html.match(/class="studio-row"/g)).toHaveLength(6);
    expect(html).not.toContain('studio-kind"');
    expect(html).toContain('<dt>Med spa</dt>');
    // The whole section 7 Full Package list is on the page.
    for (const line of [
      'Lifestyle, branding, product and team photography',
      'Cinematic brand content',
      'Full creative direction',
      'Hook and caption assistance',
      'Trend research',
      'Instagram and TikTok optimisation',
      'Behind-the-scenes and story content',
      'Monthly strategy meeting',
      'Priority editing',
    ]) {
      expect(html).toContain(line);
    }
    // Both prices sit in the frame, before any included line.
    expect(html.indexOf('>$3,500<')).toBeLessThan(html.indexOf('One shoot, up to 2 hours'));
    // The studio header keeps Español only; the software is named once, in the footer.
    const header = html.slice(0, html.indexOf('</header>'));
    expect(header).toContain('Español');
    expect(header).not.toContain('/software');
    expect(header).not.toContain('/pricing');
    const footer = html.slice(html.indexOf('<footer'));
    expect(footer).toContain('ERLV INC, DBA Must Be Viral');
    expect(footer).toContain('href="tel:+17138999346"');
    expect(footer).toContain('href="mailto:studio@mustbeviral.com"');
    expect(footer).toContain('Houston, Texas');
    expect(footer).toContain('href="/pricing"');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('href="/terms"');
    expect(footer).toContain('href="/advertising"');
    expect(footer).toContain('Must Be Viral also makes software.');
    expect(footer).toContain('href="/software"');
    expect(html).toContain('href="/pricing">Pricing, with the add-ons</a>');
    expect(html).toContain('The treatment menu changed and the page still shows last season.');
    expect(html).toContain('We walk the car and cut the Reels.');
    expect(html).toContain('We film the team, on a week that is not a listing.');
    // The studio is machine-readable with its exact prices and no invented address.
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"LocalBusiness"');
    expect(html).toContain('"price":"700"');
    expect(html).toContain('"price":"3500"');
    expect(html).not.toContain('"address"');
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
    // The Full Package carries the one approved Spanish sentence that states its deliverables.
    const fullPackage = html.slice(
      html.indexOf('id="offer-full-package"'),
      html.indexOf('class="studio-cadence"') < 0
        ? undefined
        : html.indexOf('class="studio-cadence"'),
    );
    expect(fullPackage).toContain('de cuatro a ocho veces al mes');
    expect(html).not.toContain('class="studio-cadence"');
    expect(html).toContain('El alcance depende de su cuenta y de su mercado.');
    // The legal pages are linked in English and said to be in English; the studio header keeps English only.
    const esHeader = html.slice(0, html.indexOf('</header>'));
    expect(esHeader).toContain('English');
    expect(esHeader).not.toContain('/software');
    const esFooter = html.slice(html.indexOf('<footer'));
    expect(esFooter).toContain('lang="en"');
    expect(esFooter).toContain('These pages are in English.');
    expect(esFooter).toContain('href="/privacy"');
    expect(esFooter).toContain('ERLV INC, DBA Must Be Viral');
    expect(html).toContain('data-media="poster"');
    expect(html).toContain('alt=""');
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<track');
    expect(html).not.toContain('Reproducir el video');
    expect(html).not.toContain('studio-hero__controls');
    expect(html).toContain('<div class="studio-frame__notes" lang="en">');
    expect(html).toContain('This film was made with AI: stills from Seedream v5 pro');
    expect(html.match(/class="pub-cta"/g)).toHaveLength(2);
    expect(html.match(/class="studio-offer"/g)).toHaveLength(2);
    expect(html).not.toContain('Buenos días');
    expect(html).not.toContain('We film Houston.');
    expect(html).not.toContain('Already posting?');
    expect(html).not.toContain('Your kind of work');
    expect(html).not.toContain('Med spa');
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
      ...(studioEs.cadence === undefined ? [] : [studioEs.cadence]),
      studioEs.answer,
      studioEs.close,
      studioEs.skip,
      studioEs.playFilm,
    ];
    for (const sentence of sentences) expect(approved.has(sentence)).toBe(true);
    expect(studioEs.question).toBeUndefined();
  });

  it('renders the approved generated poster as the one priority image with a truthful alt', () => {
    const media: StudioHeroMedia = {
      poster: { src: '/films/fixture-poster.jpg', width: 1920, height: 1080 },
      video: { src: '/films/fixture.mp4' },
      alt: { en: 'Two hands adjust a camera on a gimbal in a generated room.', es: '' },
    };
    const html = renderToStaticMarkup(<StudioLanding locale="en" media={media} />);
    expect(html).toContain('data-media="poster"');
    // next/image preloads the one priority image on the route.
    expect(html).toContain('<link rel="preload" as="image"');
    expect(html).toContain('fixture-poster.jpg');
    expect(html).toContain('alt="Two hands adjust a camera on a gimbal in a generated room."');
    expect(html.match(/<img /g)).toHaveLength(1);
    // The clip mounts after the poster on the client; the server never ships it as the LCP element.
    expect(html).not.toContain('<video');
    expect(html).toContain('Play the film');
  });

  it('keeps all type, controls, the description and disclosure outside the picture', () => {
    const media: StudioHeroMedia = {
      poster: { src: '/films/fixture-poster.jpg', width: 1920, height: 1080 },
      video: { src: '/films/fixture.mp4' },
      alt: { en: 'Two hands adjust a camera on a gimbal in a generated room.', es: '' },
    };
    const html = renderToStaticMarkup(<StudioLanding locale="en" media={media} />);
    const mediaStart = html.indexOf('class="studio-frame__media"');
    const mediaEnd = html.indexOf('</div>', mediaStart);
    expect(mediaStart).toBeGreaterThan(-1);
    expect(mediaEnd).toBeGreaterThan(mediaStart);
    // Only the poster and clip mount point are in the picture.
    const mediaBlock = html.slice(mediaStart, mediaEnd);
    expect(mediaBlock).not.toContain('<h1');
    expect(mediaBlock).not.toContain('pub-cta');
    expect(mediaBlock).not.toContain('$700');
    expect(mediaBlock).not.toContain('<button');
    expect(mediaBlock).not.toContain('This film was made with AI');
    expect(mediaBlock).not.toContain('<p');
    expect(html).toContain(
      'In a generated room, two hands adjust a camera on a gimbal. A calendar and an editing desk follow.',
    );
    expect(html).toContain(
      'This film was made with AI: stills from Seedream v5 pro and motion from Seedance 2.0, through Higgsfield, on October 2, 2026. The room is generated. It is not a real Houston location, our studio or our crew.',
    );
    expect(html).not.toContain('studio-hero__panel');
    // The heading and the offers follow the media block instead of overlaying it.
    expect(html.indexOf('<h1')).toBeGreaterThan(mediaEnd);
    expect(html.indexOf('>$700<')).toBeGreaterThan(mediaEnd);
  });

  it('ships only the owner-approved English wordless plate with no client-footage claim', () => {
    expect(studioHeroMedia).toMatchObject({
      poster: { src: '/films/s0-studio-hero-poster-41da8acddb3f.jpg', width: 1920, height: 1080 },
      video: { src: '/films/s0-studio-hero-d55af8ec3d69.mp4' },
      alt: { en: 'Two hands adjust a camera on a gimbal in a generated room.', es: '' },
    });
    expect(studioHeroMedia?.video).not.toHaveProperty('captions');
    expect(renderToStaticMarkup(<StudioLanding locale="en" />)).not.toContain('A Houston crew');
    expect(studioEn.offers.map((offer) => offer.name)).toEqual(['Test Shoot', 'Full Package']);
  });
});

describe('SoftwareLanding', () => {
  it('shows the film and the path without selling the Houston studio', () => {
    const html = renderToStaticMarkup(<SoftwareLanding />);
    expect(html).toContain(productLine);
    expect(html).toContain('The film follows one photo from a Drive folder to a receipt.');
    expect(html).toContain('photo.jpg arrives from the Google Drive folder you selected.');
    // The four steps stay one ordered path, not a feature grid.
    const pathStart = html.indexOf('<ol class="pub-path"');
    const path = html.slice(pathStart, html.indexOf('</ol>', pathStart));
    expect(pathStart).toBeGreaterThan(-1);
    expect(path.match(/<li /g)).toHaveLength(4);
    // Nothing runs on the server: every beat waits, and each one is a control that seeks the film.
    expect(path.match(/data-beat="waiting"/g)).toHaveLength(4);
    expect(path).not.toContain('aria-current');
    expect(path.match(/<button class="pub-beat" type="button">/g)).toHaveLength(4);
    expect(path).toContain('>0:13<');
    expect(html).toContain('aria-label="The path, in four beats"');
    expect(html).toContain('Request access by email');
    expect(html).toContain('application/ld+json');
    expect(html).toContain('"@type":"SoftwareApplication"');
    expect(html).not.toContain('"@type":"Offer"');
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
    // The software header has no studio link; the studio is named once, in the footer.
    const header = html.slice(0, html.indexOf('</header>'));
    expect(header).toContain('Plans');
    expect(header).not.toContain('Houston studio');
    const footer = html.slice(html.indexOf('<footer'));
    expect(footer).toContain('Must Be Viral is also a Houston content studio.');
    expect(footer).toContain('href="/privacy"');
    expect(footer).toContain('ERLV INC, DBA Must Be Viral');
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
    expect(html).toContain('Charging is not on.');
    expect(html).toContain('1 active brand, 2 operator seats');
    expect(html).toContain('9 connected accounts, 10\u00a0GB of storage');
    expect(html).toContain('A reviewer invited to one brand does not use an operator seat.');
    expect(html).toContain('1,000,000,000 bytes');
    expect(html).toContain('href="/login"');
    expect(html).not.toContain('Buy');
    expect(html).not.toContain('$700');
    expect(html).not.toContain('$3,500');
    expect(html).not.toContain('We film Houston.');
    const header = html.slice(0, html.indexOf('</header>'));
    expect(header).not.toContain('Houston studio');
    expect(html.slice(html.indexOf('<footer'))).toContain('href="/terms"');
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
    expect(html).toContain('href="/privacy"');
    expectCleanVoice(html);
  });
});

describe('route metadata', () => {
  it('gives every public route its own title', () => {
    const titles = [
      spanishMetadata.title,
      softwareMetadata.title,
      pricingMetadata.title,
      studioPricingMetadata.title,
      privacyMetadata.title,
      termsMetadata.title,
      advertisingMetadata.title,
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
