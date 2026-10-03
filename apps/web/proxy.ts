import { type NextRequest, type ProxyConfig, NextResponse } from 'next/server';

import { refreshSupabaseSession } from './src/lib/supabase/proxy';

export function proxy(request: NextRequest) {
  // Next can normalize nextUrl to its server hostname. The exact incoming Host still identifies
  // www, including asset requests; neither forwarded headers nor a visitor-supplied destination
  // determine the fixed HTTPS apex.
  const host = request.headers.get('host') ?? '';
  if (
    request.nextUrl.hostname === 'www.mustbeviral.com' ||
    /^www\.mustbeviral\.com(?::[0-9]{1,5})?$/iu.test(host)
  ) {
    const canonical = request.nextUrl.clone();
    canonical.protocol = 'https:';
    canonical.hostname = 'mustbeviral.com';
    canonical.port = '';
    return NextResponse.redirect(canonical, 308);
  }
  return refreshSupabaseSession(request);
}

export const config: { matcher: Exclude<NonNullable<ProxyConfig['matcher']>, string> } = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|vtt)$).*)',
    // Assets on www still need the canonical redirect, before any session or rewrite work.
    { source: '/:path*', has: [{ type: 'host', value: 'www\\.mustbeviral\\.com' }] },
  ],
};
