import type { MetadataRoute } from 'next';

import { publicOrigin } from '../src/lib/public-origin';

/** The public pages, with the English and Spanish studio pages declared as each other's peer. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  const studio = { en: `${origin}/`, es: `${origin}/es`, 'x-default': `${origin}/` };
  // D3 changed each page's shared document/footer on this date. A later build is not a new edit.
  const lastModified = '2026-10-03';
  return [
    { url: `${origin}/`, lastModified, alternates: { languages: studio } },
    { url: `${origin}/es`, lastModified, alternates: { languages: studio } },
    { url: `${origin}/pricing`, lastModified },
    { url: `${origin}/software`, lastModified },
    { url: `${origin}/software/pricing`, lastModified },
    { url: `${origin}/privacy`, lastModified },
    { url: `${origin}/terms`, lastModified },
    { url: `${origin}/advertising`, lastModified },
  ];
}
