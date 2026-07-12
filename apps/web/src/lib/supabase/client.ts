import { createBrowserClient } from '@supabase/ssr';

import { readWebPublicEnvironment } from '../../config/public-environment';

export function createBrowserSupabaseClient(source?: Readonly<Record<string, string | undefined>>) {
  const environment = readWebPublicEnvironment(source);
  return createBrowserClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
