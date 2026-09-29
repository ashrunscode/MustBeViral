import { createMustBeViralRestClient } from '@mustbeviral/contracts';

import { readWebPublicEnvironment } from '../../config/public-environment';
import { createServerSupabaseClient } from '../supabase/server';

export function createServerCoreClient() {
  const environment = readWebPublicEnvironment();
  return createMustBeViralRestClient({
    baseUrl: environment.NEXT_PUBLIC_CORE_API_URL,
    getAccessToken: async () => {
      const supabase = await createServerSupabaseClient();
      const { data: claims, error: claimsError } = await supabase.auth.getClaims();
      if (claimsError !== null || typeof claims?.claims?.sub !== 'string') return null;
      const { data, error } = await supabase.auth.getSession();
      return error === null ? (data.session?.access_token ?? null) : null;
    },
  });
}
