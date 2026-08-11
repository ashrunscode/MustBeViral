'use client';

import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { readWebPublicEnvironment } from '../../config/public-environment';
import { createBrowserSupabaseClient } from '../supabase/client';

export function createBrowserCoreClient(source?: Readonly<Record<string, string | undefined>>) {
  const environment = readWebPublicEnvironment(source);
  const supabase = createBrowserSupabaseClient(source);
  return createMustBeViralRestClient({
    baseUrl: environment.NEXT_PUBLIC_CORE_API_URL,
    getAccessToken: async () => {
      const { data, error } = await supabase.auth.getSession();
      return error === null ? (data.session?.access_token ?? null) : null;
    },
  });
}
