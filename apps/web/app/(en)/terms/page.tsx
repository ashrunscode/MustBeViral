import type { Metadata } from 'next';

export const dynamic = 'error';

import { termsCopy } from '../../../src/components/legal-copy';
import { LegalPage } from '../../../src/components/legal-page';

export const metadata: Metadata = {
  title: termsCopy.title,
  description: termsCopy.description,
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return <LegalPage copy={termsCopy} />;
}
