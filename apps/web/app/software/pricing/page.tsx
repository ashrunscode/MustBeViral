import type { Metadata } from 'next';

import { SoftwarePricing } from '../../../src/components/software-pricing';

export const metadata: Metadata = {
  title: 'Software plans — Must Be Viral',
  description: 'Provisional software plans: Solo $49, Studio $149, and Portfolio $399 a month.',
};

export default function SoftwarePricingPage() {
  return <SoftwarePricing />;
}
