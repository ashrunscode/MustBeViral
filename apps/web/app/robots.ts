import type { MetadataRoute } from 'next';

import { publicOrigin } from '../src/lib/public-origin';

/**
 * The public pages and the plain-text summary are open to every crawler. The signed-in app, the
 * auth screens and the API are not pages to index. The sitemap is named only when the public origin
 * is known.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = publicOrigin();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/forgot-password',
          '/login',
          '/maintenance',
          '/reset-password',
          '/signup',
          '/studio',
          '/unauthorized',
          '/verify-email',
        ],
      },
    ],
    ...(origin === undefined ? {} : { sitemap: `${origin}/sitemap.xml` }),
  };
}
