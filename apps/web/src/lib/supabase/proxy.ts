import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { readWebPublicEnvironment } from '../../config/public-environment';
import { DOCUMENT_LANG_HEADER, documentLangForPath, isPublicMarketingPath } from '../document-lang';

/** Forward the request with the document language the root layout renders on `<html>`. */
function nextWithDocumentLang(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(DOCUMENT_LANG_HEADER, documentLangForPath(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}

export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'production' && process.env.MBV_LOCAL_GOLDEN_PREVIEW === '1') {
    return nextWithDocumentLang(request);
  }
  // Sales pages carry no session work: they render even when the public configuration is absent.
  if (isPublicMarketingPath(request.nextUrl.pathname)) {
    return nextWithDocumentLang(request);
  }

  const environment = readWebPublicEnvironment();
  let response = nextWithDocumentLang(request);
  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = nextWithDocumentLang(request);
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const isAuthenticated = error === null && typeof data?.claims?.sub === 'string';
  if (request.nextUrl.pathname.startsWith('/studio') && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll()) redirectResponse.cookies.set(cookie);
    return redirectResponse;
  }
  return response;
}
