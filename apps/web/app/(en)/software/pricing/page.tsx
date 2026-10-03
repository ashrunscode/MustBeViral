import type { Metadata } from 'next';

export const dynamic = 'error';

import { SoftwarePricing } from '../../../../src/components/software-pricing';

const title = 'Software plans';
const description =
  'Provisional software plans: Solo $49, Studio $149, and Portfolio $399 a month. Charging is not on.';
const image = {
  url: '/og/software-pricing.png',
  width: 1200,
  height: 630,
  alt: 'Software plans. Provisional catalog, charging is not on. Solo $49, Studio $149, Portfolio $399 a month.',
};

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/software/pricing' },
  openGraph: {
    type: 'website',
    siteName: 'Must Be Viral',
    locale: 'en_US',
    url: '/software/pricing',
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

export default function SoftwarePricingPage() {
  return <SoftwarePricing />;
}
