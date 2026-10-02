import type { Metadata } from 'next';

import { StudioPricing } from '../../src/components/studio-pricing';
import { publicOrigin } from '../../src/lib/public-origin';

const title = 'Pricing';
const description =
  'Test Shoot $700, one time. Full Package $3,500 a month. Add-ons: 24-hour turnaround +$200–$400 per shoot, drone +$300–$600 per shoot. Book a test shoot by phone.';
const image = {
  url: '/og/studio-en.png',
  width: 1200,
  height: 630,
  alt: 'We film Houston. Test Shoot $700, one time. Full Package $3,500 a month. Book a test shoot.',
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    siteName: 'Must Be Viral',
    locale: 'en_US',
    url: '/pricing',
    title: `${title} | Must Be Viral`,
    description,
    images: [image],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${title} | Must Be Viral`,
    description,
    images: [image.url],
  },
};

export default function StudioPricingPage() {
  return <StudioPricing origin={publicOrigin()} />;
}
