import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { StudioLanding } from '../src/components/studio-landing';
import { canReadSession } from '../src/lib/auth/can-read-session';
import { createServerSupabaseClient } from '../src/lib/supabase/server';

export const metadata: Metadata = {
  title: { absolute: 'Must Be Viral, a Houston content studio' },
  description:
    'Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep.',
  alternates: { canonical: '/', languages: { en: '/', es: '/es' } },
};

export default async function HomePage() {
  if (canReadSession()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    if (typeof data?.claims?.sub === 'string') redirect('/studio');
  }

  return <StudioLanding locale="en" />;
}
