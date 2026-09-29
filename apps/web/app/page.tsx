import { redirect } from 'next/navigation';

import { LandingPage } from '../src/components/landing-page';
import { createServerSupabaseClient } from '../src/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (typeof data?.claims?.sub === 'string') redirect('/studio');

  return <LandingPage />;
}
