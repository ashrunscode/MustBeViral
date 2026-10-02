import type { MetadataRoute } from 'next';

import { publicOrigin } from '../src/lib/public-origin';

/** The public pages, with the English and Spanish studio pages declared as each other's peer. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicOrigin();
  if (origin === undefined) return [];
  const studio = { en: `${origin}/`, es: `${origin}/es`, 'x-default': `${origin}/` };
  return [
    { url: `${origin}/`, alternates: { languages: studio } },
    { url: `${origin}/es`, alternates: { languages: studio } },
    { url: `${origin}/pricing` },
    { url: `${origin}/software` },
    { url: `${origin}/software/pricing` },
    { url: `${origin}/privacy` },
    { url: `${origin}/terms` },
    { url: `${origin}/advertising` },
  ];
}
