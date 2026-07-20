import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { readWebPublicEnvironment } from '../../config/public-environment';

export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'production' && process.env.MBV_LOCAL_GOLDEN_PREVIEW === '1') {
    return NextResponse.next({ request });
  }

  const environment = readWebPublicEnvironment();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  await supabase.auth.getClaims();
  return response;
}
