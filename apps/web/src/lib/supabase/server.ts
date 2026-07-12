import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { readWebPublicEnvironment } from '../../config/public-environment';

export async function createServerSupabaseClient() {
  const environment = readWebPublicEnvironment();
  const cookieStore = await cookies();

  return createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot write cookies; proxy.ts owns session refresh.
            return;
          }
        },
      },
    },
  );
}
