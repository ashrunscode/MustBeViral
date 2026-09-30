/** Customer-facing lines. Studio sentences are the approved pairs in brand/context.md. */

export const phoneHref = 'tel:+17138999346';

export const studioEn = {
  skip: 'Skip to main content',
  h1: 'We film Houston.',
  sub: 'Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep.',
  gap: "You do. The gap is the weeks you don't. We keep the cadence so it doesn't depend on somebody remembering.",
  testName: 'Test Shoot',
  testPrice: '$700',
  testUnit: 'one time',
  fullName: 'Full Package',
  fullPrice: '$3,500',
  fullUnit: 'a month',
  cta: 'Book a test shoot.',
  phone: 'Call 713-899-9346.',
  service:
    'On the Full Package we come to your business four to eight times a month, shoot, edit, and hand you the posts with a calendar.',
  close: 'Book a test shoot. Two hours, two Reels, 15 to 25 photos, $700.',
  turnaround:
    'Standard edits come back on the schedule we agree at booking; 24-hour turnaround is an add-on.',
  turnaroundRange: '24-hour turnaround is $200–$400 per shoot.',
  drone:
    'Drone is $300–$600 per shoot. The Full Package includes drone when the location allows it.',
} as const;

/**
 * Owner accepted this page on 2026-09-30.
 * brand/context.md section 3c still has no named fluent reviewer, so the brand
 * registry keeps this Spanish at draft until that name is recorded.
 * "al mes" states the Full Package period. The approved Spanish pairs price the Test Shoot
 * and describe the monthly cadence; they do not yet contain the $3,500 sentence.
 */
export const studioEs = {
  skip: 'Saltar al contenido',
  h1: 'Filmamos Houston.',
  sub: 'Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple.',
  greeting:
    'Buenos días. Somos Must Be Viral, un estudio en Houston. Grabamos contenido semanal para negocios como el suyo.',
  testName: 'Test Shoot',
  testPrice: '$700',
  testUnit: 'una sola vez',
  fullName: 'Full Package',
  fullPrice: '$3,500',
  fullUnit: 'al mes',
  price:
    'El Test Shoot cuesta $700, una sola vez: una sesión de hasta dos horas, 2 Reels editados y de 15 a 25 fotos.',
  cta: 'Agende un test shoot.',
  phone: 'Llame al 713-899-9346.',
  service:
    'Con el Full Package vamos a su negocio de cuatro a ocho veces al mes, grabamos, editamos y le entregamos las publicaciones con su calendario.',
  close: 'Agende un test shoot. Dos horas, dos Reels y de 15 a 25 fotos, $700.',
} as const;

export const softwareCopy = {
  skip: 'Skip to main content',
  tagline: 'You brief. Agents produce. You approve every dollar.',
  filmFact: 'The film shows the specified path.',
  label: 'Specified path',
  alt: 'Specified path. Drive, Produce, Dispatch, and Receipt.',
  path: [
    'photo.jpg arrives from a selected Google Drive folder.',
    'The same photo is cropped and captioned from the approved offer.',
    'Eligible channels publish. TikTok waits for per-post privacy. Google Business Profile waits for access. YouTube stays private until the project is approved.',
    'The receipt shows the provider id and the actual cost. Pause remains available.',
  ],
  enrollment: 'Enrollment is closed.',
  cta: 'Sign in to Studio',
  play: 'Play the film',
} as const;

export const softwareFilm = {
  poster: '/software/p0-software-hero-poster.jpg',
  video: '/software/p0-software-hero.mp4',
  captions: '/software/p0-software-hero.vtt',
  width: 1920,
  height: 1080,
} as const;

export const softwarePlans = [
  {
    name: 'Solo',
    price: '$49',
    detail: ['1 brand, 2 seats', '9 accounts, 10 GB'],
  },
  {
    name: 'Studio',
    price: '$149',
    detail: ['5 brands, 5 seats', '45 accounts, 50 GB'],
  },
  {
    name: 'Portfolio',
    price: '$399',
    detail: ['20 brands, 15 seats', '180 accounts, 200 GB'],
  },
] as const;

export const pricingCopy = {
  skip: 'Skip to main content',
  h1: 'Software plans',
  provisional: 'These prices are the provisional catalog.',
  signIn: 'Signing in does not start a subscription.',
  planName: 'Studio on this page is a software plan.',
  storage: 'Storage is decimal gigabytes: 1,000,000,000 bytes.',
  allowance:
    'The subscription does not include a production allowance. Production spend is quoted before it runs.',
  period: 'a month',
  cta: 'Sign in to Studio',
} as const;
