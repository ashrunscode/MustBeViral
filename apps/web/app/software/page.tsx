import type { Metadata } from 'next';

import { SoftwareLanding } from '../../src/components/software-landing';

export const metadata: Metadata = {
  title: 'Must Be Viral',
  description: 'You brief. Agents produce. You approve every dollar.',
};

export default function SoftwarePage() {
  return <SoftwareLanding />;
}
