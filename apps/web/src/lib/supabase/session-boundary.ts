import { redirect } from 'next/navigation';

import { createServerSupabaseClient } from './server';

export interface StudioSession {
  readonly subject: string;
  readonly mode: 'authenticated' | 'local-preview';
}

function hasSupabasePublicEnvironment() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export async function requireStudioSession(): Promise<StudioSession> {
  if (process.env.NODE_ENV !== 'production' && process.env.MBV_LOCAL_GOLDEN_PREVIEW === '1') {
    return { subject: 'local-golden-preview', mode: 'local-preview' };
  }

  if (!hasSupabasePublicEnvironment()) {
    if (process.env.NODE_ENV === 'production') redirect('/');
    return { subject: 'local-golden-preview', mode: 'local-preview' };
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.getClaims();
  const subject = data?.claims?.sub;
  if (error || typeof subject !== 'string' || subject.length === 0) redirect('/');
  return { subject, mode: 'authenticated' };
}
