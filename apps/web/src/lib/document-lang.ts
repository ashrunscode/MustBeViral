export const DOCUMENT_LANG_HEADER = 'x-mbv-document-lang';

export type DocumentLang = 'en' | 'es';

/** The Spanish studio page is the only non-English document; every other route is English. */
export function documentLangForPath(pathname: string): DocumentLang {
  return pathname === '/es' || pathname.startsWith('/es/') ? 'es' : 'en';
}

export function parseDocumentLang(value: string | null | undefined): DocumentLang {
  return value === 'es' ? 'es' : 'en';
}

const PUBLIC_MARKETING_PATHS = new Set([
  '/',
  '/es',
  '/pricing',
  '/software',
  '/software/pricing',
  '/privacy',
  '/terms',
  '/advertising',
  '/robots.txt',
  '/sitemap.xml',
  '/llms.txt',
]);

/** Static sales pages need no session refresh and must render without a Supabase configuration. */
export function isPublicMarketingPath(pathname: string): boolean {
  const trimmed = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return PUBLIC_MARKETING_PATHS.has(trimmed === '' ? '/' : trimmed);
}
