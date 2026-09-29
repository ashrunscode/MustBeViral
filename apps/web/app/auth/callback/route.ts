import { NextResponse } from 'next/server';

import { readWebPublicEnvironment } from '../../../src/config/public-environment';
import { resolveAuthCallback } from '../../../src/lib/auth/recovery';
import { createServerSupabaseClient } from '../../../src/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const supabase = await createServerSupabaseClient();
  const result = await resolveAuthCallback(
    {
      code: requestUrl.searchParams.get('code'),
      next: requestUrl.searchParams.get('next'),
      providerErrorCode:
        requestUrl.searchParams.get('error_code') ?? requestUrl.searchParams.get('error'),
      recovery: requestUrl.searchParams.get('recovery') === '1',
    },
    async (code) => supabase.auth.exchangeCodeForSession(code),
  );

  const response = NextResponse.redirect(
    new URL(result.destination, readWebPublicEnvironment().NEXT_PUBLIC_APP_ORIGIN),
  );
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}
