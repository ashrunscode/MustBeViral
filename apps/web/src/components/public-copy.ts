/**
 * Customer-facing lines for the signed-out surfaces.
 *
 * Studio sentences are the locked lines and the approved pairs in brand/context.md sections 1a, 3d,
 * 3e and 7. No other Spanish is written here: the brand registry names no fluent reviewer, so new
 * Spanish stays draft and does not ship. English and Spanish share one layout.
 */

export const phoneDisplay = '713-899-9346';
export const phoneHref = 'tel:+17138999346';
/** Approved public contact address, brand/context.md section 6. */
export const studioEmail = 'studio@mustbeviral.com';

export type StudioLocale = 'en' | 'es';

export interface StudioOffer {
  readonly name: string;
  readonly price: string;
  readonly unit: string;
  /** Section 7 deliverables (EN) or the one approved Spanish sentence that states them (ES). */
  readonly includes: readonly string[];
}

export interface StudioHeroMedia {
  readonly poster: { readonly src: string; readonly width: number; readonly height: number };
  readonly video?: { readonly src: string; readonly captions: string };
  readonly alt: Readonly<Record<StudioLocale, string>>;
}

/**
 * No rights-cleared studio footage is on file (brand/context.md section 4c), so the hero renders
 * the frame without media. When the owner records permission for a studio-produced poster and
 * clip, point this at them: the frame already reserves the geometry and the poster becomes the
 * priority LCP element.
 */
export const studioHeroMedia: StudioHeroMedia | null = null;

export interface StudioCopy {
  readonly locale: StudioLocale;
  readonly homeHref: string;
  readonly nav: readonly { readonly href: string; readonly label: string }[];
  readonly skip: string;
  readonly h1: string;
  readonly sub: string;
  readonly cta: string;
  readonly phone: string;
  readonly offers: readonly [StudioOffer, StudioOffer];
  readonly cadence: string;
  /** EN: the approved objection pair. ES: the approved results pair, which has no question. */
  readonly question?: string;
  readonly answer: string;
  readonly close: string;
  readonly playFilm: string;
}

export const studioEn: StudioCopy = {
  locale: 'en',
  homeHref: '/',
  nav: [
    { href: '/es', label: 'Español' },
    { href: '/software', label: 'Software' },
  ],
  skip: 'Skip to main content',
  h1: 'We film Houston.',
  sub: 'Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep.',
  cta: 'Book a test shoot.',
  phone: `Call ${phoneDisplay}.`,
  offers: [
    {
      name: 'Test Shoot',
      price: '$700',
      unit: 'one time',
      includes: [
        'One shoot, up to 2 hours',
        '2 edited Reels',
        '15–25 edited photos',
        'Creative direction on set',
        'Formatted for Instagram and TikTok, ready to post',
      ],
    },
    {
      name: 'Full Package',
      price: '$3,500',
      unit: 'a month',
      includes: [
        '4–8 shoots per month, 2–3 hours each',
        '12–16+ edited Reels',
        '120–200 edited photos',
        'Monthly content strategy and calendar',
        'Drone / aerial included where applicable',
      ],
    },
  ],
  cadence:
    'On the Full Package we come to your business four to eight times a month, shoot, edit, and hand you the posts with a calendar.',
  question: 'Already posting?',
  answer:
    'You do. The gap is the weeks you don’t. We keep the cadence so it doesn’t depend on somebody remembering.',
  close: 'Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700.',
  playFilm: 'Play the film',
};

export const studioEs: StudioCopy = {
  locale: 'es',
  homeHref: '/es',
  nav: [
    { href: '/', label: 'English' },
    { href: '/software', label: 'Software' },
  ],
  skip: 'Saltar al contenido',
  h1: 'Filmamos Houston.',
  sub: 'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
  cta: 'Agende un test shoot.',
  phone: `Llame al ${phoneDisplay}.`,
  offers: [
    {
      name: 'Test Shoot',
      price: '$700',
      unit: 'una sola vez',
      includes: [
        'El Test Shoot cuesta $700, una sola vez: una sesión de hasta dos horas, 2 Reels editados y de 15 a 25 fotos.',
      ],
    },
    {
      name: 'Full Package',
      price: '$3,500',
      unit: 'al mes',
      includes: [],
    },
  ],
  cadence:
    'Con el Full Package vamos a su negocio de cuatro a ocho veces al mes, grabamos, editamos y le entregamos las publicaciones con su calendario.',
  answer:
    'Le entregamos el material listo para publicar. El alcance depende de su cuenta y de su mercado.',
  close: 'Agende un test shoot. Dos horas, dos Reels y de 15 a 25 fotos, $700.',
  playFilm: 'Reproducir el video',
};

export const studioCopy: Readonly<Record<StudioLocale, StudioCopy>> = {
  en: studioEn,
  es: studioEs,
};

export const softwareCopy = {
  skip: 'Skip to main content',
  tagline: 'You brief. Agents produce. You approve every dollar.',
  filmFact: 'The film follows one photo from a Drive folder to a receipt.',
  label: 'One photo, from Drive to receipt',
  alt: 'Film frame. A photo arrives from a Google Drive folder, is cropped and captioned from the approved offer, publishes to the eligible channels, and ends in a receipt that shows the cost.',
  path: [
    'photo.jpg arrives from a selected Google Drive folder.',
    'The same photo is cropped and captioned from the approved offer.',
    'Eligible channels publish. TikTok waits for per-post privacy. Google Business Profile waits for access. YouTube stays private until the project is approved.',
    'The receipt shows the provider id and the actual cost. Pause remains available.',
  ],
  enrollment: 'Enrollment is closed.',
  requestAccess: 'Request access',
  cta: 'Sign in to Studio',
  play: 'Play the film',
} as const;

export const softwareFilm = {
  poster: '/software/software-hero-poster.jpg',
  video: '/software/software-hero.mp4',
  captions: '/software/software-hero.vtt',
  width: 1920,
  height: 1080,
} as const;

export const softwarePlans = [
  {
    name: 'Solo',
    price: '$49',
    detail: ['1 brand, 2 seats', '9 accounts, 10\u00a0GB'],
  },
  {
    name: 'Studio',
    price: '$149',
    detail: ['5 brands, 5 seats', '45 accounts, 50\u00a0GB'],
  },
  {
    name: 'Portfolio',
    price: '$399',
    detail: ['20 brands, 15 seats', '180 accounts, 200\u00a0GB'],
  },
] as const;

export const pricingCopy = {
  skip: 'Skip to main content',
  h1: 'Software plans',
  provisional: 'These prices are the provisional catalog.',
  signIn: 'Signing in does not start a subscription.',
  storage: 'Storage is decimal gigabytes: 1,000,000,000 bytes.',
  allowance:
    'The subscription does not include a production allowance. Studio quotes production spend before it runs.',
  period: 'a month',
  cta: 'Sign in to Studio',
} as const;

/** Mail link for invited-access requests. Nothing is collected on the site. */
export const requestAccessHref = `mailto:${studioEmail}?subject=${encodeURIComponent('Request access')}`;
