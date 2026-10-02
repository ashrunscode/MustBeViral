import type { Metadata } from 'next';

import { privacyCopy } from '../../src/components/legal-copy';
import { LegalPage } from '../../src/components/legal-page';

export const metadata: Metadata = {
  title: privacyCopy.title,
  description: privacyCopy.description,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return <LegalPage copy={privacyCopy} />;
}
