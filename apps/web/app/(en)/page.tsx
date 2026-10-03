import type { Metadata } from 'next';

import { studioEn } from '../../src/components/public-copy';
import { StudioLanding } from '../../src/components/studio-landing';
import { publicOrigin } from '../../src/lib/public-origin';

// Session redirects belong in the proxy. A request API in this page must fail the build.
export const dynamic = 'error';

const title = 'Must Be Viral, a Houston content studio';
const description = studioEn.sub;
const image = {
  url: '/og/studio-en.png',
  width: 1200,
  height: 630,
  alt: 'We film Houston. Test Shoot $700, one time. Full Package $3,500 a month. Book a test shoot.',
};

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/', languages: { en: '/', es: '/es', 'x-default': '/' } },
  openGraph: {
    type: 'website',
    siteName: 'Must Be Viral',
    locale: 'en_US',
    alternateLocale: 'es_US',
    url: '/',
    title,
    description,
    images: [image],
  },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

export default function HomePage() {
  return <StudioLanding locale="en" origin={publicOrigin()} />;
}
