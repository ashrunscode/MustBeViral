import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { StudioLanding } from '../src/components/studio-landing';
import { createServerSupabaseClient } from '../src/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Must Be Viral',
  description:
    'Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep.',
};

function canReadSession() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export default async function HomePage() {
  if (canReadSession()) {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    if (typeof data?.claims?.sub === 'string') redirect('/studio');
  }

  return <StudioLanding locale="en" />;
}
