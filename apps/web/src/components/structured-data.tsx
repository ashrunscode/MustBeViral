import { phoneHref, softwareCopy, studioEmail, type StudioCopy } from './public-copy';

type JsonLd = Readonly<Record<string, unknown>>;

const houston = {
  '@type': 'City',
  name: 'Houston',
  containedInPlace: { '@type': 'State', name: 'Texas' },
} as const;

function sentence(lines: readonly string[]): string {
  const joined = lines.join('. ');
  return joined.endsWith('.') ? joined : `${joined}.`;
}

/**
 * The studio as a service-area business: the locked lines, the two offers at their exact prices,
 * the phone and the mail address. No street address is on file, so none is stated.
 */
export function studioStructuredData(copy: StudioCopy, origin: string | undefined): JsonLd {
  const [testShoot, fullPackage] = copy.offers;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    ...(origin === undefined
      ? {}
      : { '@id': `${origin}/#studio`, url: `${origin}${copy.homeHref}` }),
    name: 'Must Be Viral',
    description: copy.sub,
    inLanguage: copy.locale,
    telephone: phoneHref.replace('tel:', ''),
    email: studioEmail,
    areaServed: houston,
    knowsLanguage: ['en', 'es'],
    makesOffer: [
      {
        '@type': 'Offer',
        name: testShoot.name,
        price: '700',
        priceCurrency: 'USD',
        ...(testShoot.includes.length === 0 ? {} : { description: sentence(testShoot.includes) }),
        itemOffered: { '@type': 'Service', name: testShoot.name, areaServed: houston },
      },
      {
        '@type': 'Offer',
        name: fullPackage.name,
        priceCurrency: 'USD',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: '3500',
          priceCurrency: 'USD',
          unitCode: 'MON',
          unitText: 'month',
        },
        ...(fullPackage.includes.length === 0
          ? {}
          : { description: sentence(fullPackage.includes) }),
        itemOffered: { '@type': 'Service', name: fullPackage.name, areaServed: houston },
      },
    ],
  };
}

/**
 * The software as a web application. No offer is declared: the catalog is provisional and charging
 * is not on, so no price is advertised as available.
 */
export function softwareStructuredData(origin: string | undefined): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    ...(origin === undefined
      ? {}
      : { '@id': `${origin}/software#software`, url: `${origin}/software` }),
    name: 'Must Be Viral',
    description: softwareCopy.tagline,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web browser',
    inLanguage: 'en',
  };
}

export function StructuredData({ data }: Readonly<{ data: JsonLd }>) {
  // A closing tag inside a string would end the script element early; escape the one character
  // that can do that.
  const json = JSON.stringify(data).replace(/</gu, '\\u003c');
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
