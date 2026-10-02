import type { Metadata } from 'next';

import { softwareCopy } from '../../src/components/public-copy';
import { SoftwareLanding } from '../../src/components/software-landing';
import { publicOrigin } from '../../src/lib/public-origin';

const title = 'Must Be Viral software';
const description = softwareCopy.tagline;
const image = { url: '/og/software.png', width: 1200, height: 630, alt: softwareCopy.tagline };

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/software' },
  openGraph: {
    type: 'website',
    siteName: 'Must Be Viral',
    locale: 'en_US',
    url: '/software',
    title,
    description,
    images: [image],
  },
  twitter: { card: 'summary_large_image', title, description, images: [image.url] },
};

export default function SoftwarePage() {
  return <SoftwareLanding origin={publicOrigin()} />;
}
