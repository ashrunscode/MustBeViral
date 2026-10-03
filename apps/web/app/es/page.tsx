import type { Metadata } from 'next';

import { studioEs } from '../../src/components/public-copy';
import { StudioLanding } from '../../src/components/studio-landing';
import { publicOrigin } from '../../src/lib/public-origin';

export const dynamic = 'error';

const title = 'Must Be Viral, estudio de contenido en Houston';
const description = studioEs.sub;
const image = {
  url: '/og/studio-es.png',
  width: 1200,
  height: 630,
  alt: `${studioEs.h1} ${studioEs.sub}`,
};

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/es', languages: { en: '/', es: '/es', 'x-default': '/' } },
  openGraph: {
    type: 'website',
    siteName: 'Must Be Viral',
    locale: 'es_US',
    alternateLocale: 'en_US',
    url: '/es',
    title,
    description,
    images: [image],
  },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

export default function SpanishStudioPage() {
  return <StudioLanding locale="es" origin={publicOrigin()} />;
}
