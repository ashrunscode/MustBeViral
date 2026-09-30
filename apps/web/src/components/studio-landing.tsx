import { DocumentLang } from './document-lang';
import { PublicHeader } from './public-header';
import { phoneHref, studioEn, studioEs } from './public-copy';

export function StudioLanding({ locale }: Readonly<{ locale: 'en' | 'es' }>) {
  const copy = locale === 'es' ? studioEs : studioEn;
  const homeHref = locale === 'es' ? '/es' : '/';
  const links =
    locale === 'es'
      ? [
          { href: '/', label: 'English' },
          { href: '/software', label: 'Software' },
        ]
      : [
          { href: '/es', label: 'Español' },
          { href: '/software', label: 'Software' },
        ];

  return (
    <main className="pub-page pub-page--studio" lang={locale}>
      {locale === 'es' ? <DocumentLang lang="es" /> : null}
      <a className="skip-link" href="#studio-heading">
        {copy.skip}
      </a>
      <div className="pub-shell">
        <PublicHeader homeHref={homeHref} links={links} />
        <header className="pub-hero">
          <h1 id="studio-heading">{copy.h1}</h1>
          <p>{copy.sub}</p>
          {'gap' in copy ? <p>{copy.gap}</p> : null}
        </header>
        <dl className="pub-offers">
          <div className="pub-offer">
            <dt>{copy.testName}</dt>
            <dd>
              <span className="pub-price">{copy.testPrice}</span>
              <span className="pub-price-unit">{copy.testUnit}</span>
            </dd>
          </div>
          <div className="pub-offer">
            <dt>{copy.fullName}</dt>
            <dd>
              <span className="pub-price">{copy.fullPrice}</span>
              <span className="pub-price-unit">{copy.fullUnit}</span>
            </dd>
          </div>
        </dl>
        {locale === 'es' ? <p>{studioEs.price}</p> : null}
        <div className="pub-actions">
          <a className="pub-cta" href={phoneHref}>
            {copy.cta}
          </a>
          <a className="pub-phone" href={phoneHref}>
            {copy.phone}
          </a>
        </div>
        <div className="pub-story">
          {'greeting' in copy ? <p>{copy.greeting}</p> : null}
          <p>{copy.service}</p>
          <p>{copy.close}</p>
          {'turnaround' in copy ? (
            <>
              <p>{copy.turnaround}</p>
              <p>{copy.turnaroundRange}</p>
              <p>{copy.drone}</p>
            </>
          ) : null}
        </div>
        <div className="pub-actions">
          <a className="pub-cta" href={phoneHref}>
            {copy.cta}
          </a>
        </div>
      </div>
    </main>
  );
}
