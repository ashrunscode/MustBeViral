import type { Metadata } from 'next';

import { advertisingCopy } from '../../src/components/legal-copy';
import { LegalPage } from '../../src/components/legal-page';

export const metadata: Metadata = {
  title: advertisingCopy.title,
  description: advertisingCopy.description,
  alternates: { canonical: '/advertising' },
};

export default function AdvertisingPage() {
  return <LegalPage copy={advertisingCopy} />;
}
