import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { studioEn } from '../src/components/public-copy';
import { StudioLanding } from '../src/components/studio-landing';
import { canReadSession } from '../src/lib/auth/can-read-session';
import { publicOrigin } from '../src/lib/public-origin';
import { createServerSupabaseClient } from '../src/lib/supabase/server';

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

export default async function HomePage() {
  if (canReadSession()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    if (typeof data?.claims?.sub === 'string') redirect('/studio');
  }

  return <StudioLanding locale="en" origin={publicOrigin()} />;
}
