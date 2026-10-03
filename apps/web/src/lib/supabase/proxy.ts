import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { readWebPublicEnvironment } from '../../config/public-environment';
import { DOCUMENT_LANG_HEADER, documentLangForPath, isPublicMarketingPath } from '../document-lang';

/** Forward a trusted route hint; the static root layouts set their own literal document language. */
function nextWithDocumentLang(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set(DOCUMENT_LANG_HEADER, documentLangForPath(request.nextUrl.pathname));
  return NextResponse.next({ request: { headers } });
}

export async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'production' && process.env.MBV_LOCAL_GOLDEN_PREVIEW === '1') {
    return nextWithDocumentLang(request);
  }
  let response = nextWithDocumentLang(request);
  const pathname = request.nextUrl.pathname.replace(/\/+$/u, '') || '/';
  const landing = pathname === '/' || pathname === '/es';
  const marketing = isPublicMarketingPath(pathname);
  const hasSessionCookie = request.cookies
    .getAll()
    .some(
      ({ name, value }) => /^sb-[a-z0-9_-]+-auth-token(?:\.\d+)?$/iu.test(name) && value.length > 0,
    );
  const privateResponse = (result: NextResponse) => {
    result.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0, must-revalidate');
    return result;
  };
  // Cookie-free marketing remains static and needs no client or public configuration. Only the
  // two landing pages preserve the verified signed-in redirect; other sales pages never refresh.
  if (marketing && (!landing || !hasSessionCookie)) {
    return hasSessionCookie ? privateResponse(response) : response;
  }

  let isAuthenticated = false;
  try {
    const environment = readWebPublicEnvironment();
    const supabase = createServerClient(
      environment.NEXT_PUBLIC_SUPABASE_URL,
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll: (cookiesToSet) => {
            for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
            const priorCookies = response.cookies.getAll();
            response = nextWithDocumentLang(request);
            for (const cookie of priorCookies) response.cookies.set(cookie);
            for (const { name, value, options } of cookiesToSet) {
              response.cookies.set(name, value, options);
            }
          },
        },
      },
    );
    const { data, error } = await supabase.auth.getClaims();
    const subject = data?.claims?.sub;
    isAuthenticated = error === null && typeof subject === 'string' && subject.trim().length > 0;
  } catch {
    // Missing configuration or a claims failure cannot establish identity. Keep a guest landing
    // available and let the protected-route check below fail closed; expose no provider details.
  }

  const redirectWithCookies = (url: URL) => {
    const redirected = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) redirected.cookies.set(cookie);
    return privateResponse(redirected);
  };
  if (landing && isAuthenticated) {
    // NextURL retains the incoming route's trailing-slash flag; the destination is exactly /studio.
    return redirectWithCookies(new URL('/studio', request.url));
  }
  if (request.nextUrl.pathname.startsWith('/studio') && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return redirectWithCookies(loginUrl);
  }
  return privateResponse(response);
}
