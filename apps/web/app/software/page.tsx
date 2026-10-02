import type { Metadata } from 'next';

import { SoftwareLanding } from '../../src/components/software-landing';

export const metadata: Metadata = {
  title: { absolute: 'Must Be Viral software' },
  description: 'You brief. Agents produce. You approve every dollar.',
  alternates: { canonical: '/software' },
};

export default function SoftwarePage() {
  return <SoftwareLanding />;
}
