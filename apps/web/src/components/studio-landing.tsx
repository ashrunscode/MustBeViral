import Link from 'next/link';

import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import {
  phoneHref,
  studioCopy,
  studioHeroMedia,
  type StudioHeroMedia as StudioHeroMediaRecord,
  type StudioLocale,
} from './public-copy';
import { StructuredData, studioStructuredData } from './structured-data';
import { StudioHeroMedia } from './studio-hero-media';
import { StudioOffers } from './studio-offers';

/**
 * The studio page is a frame at screen width, designed at 375 first. The first screen is the
 * decision: the locked line, the two prices as titles, one action with the phone as the only
 * secondary. When a rights-cleared poster and clip exist they take their own block above the lead
 * with the geometry reserved. Below the frame, type and space carry the rank: the two offers in
 * full, the cadence, six composed rows in the owner's words, the objection with its answer, the
 * close, and the one footer.
 */
export function StudioLanding({
  locale,
  media = studioHeroMedia,
  origin,
}: Readonly<{
  locale: StudioLocale;
  media?: StudioHeroMediaRecord | null;
  origin?: string | undefined;
}>) {
  const copy = studioCopy[locale];

  return (
    <div className="pub-page pub-page--studio" lang={locale}>
      <a className="skip-link" href="#studio-heading">
        {copy.skip}
      </a>
      <div className="pub-shell pub-shell--studio">
        <PublicHeader homeHref={copy.homeHref} links={copy.nav} />
        <main id="studio-main">
          <section
            className="studio-frame"
            aria-labelledby="studio-heading"
            data-media={media === null ? 'none' : 'poster'}
          >
            {media === null ? null : (
              <div className="studio-frame__media">
                <StudioHeroMedia alt={media.alt[locale]} media={media} playLabel={copy.playFilm} />
              </div>
            )}
            <div className="studio-frame__lead">
              <h1 id="studio-heading">{copy.h1}</h1>
              <p className="studio-frame__sub">{copy.sub}</p>
              <div className="pub-actions">
                <a className="pub-cta" href={phoneHref}>
                  {copy.cta}
                </a>
                <a className="pub-phone" href={phoneHref}>
                  {copy.phone}
                </a>
              </div>
            </div>
            <dl className="studio-frame__prices">
              {copy.offers.map((offer) => (
                <div className="studio-price" key={offer.name}>
                  <dt translate="no">{offer.name}</dt>
                  <dd>
                    <span className="pub-price">{offer.price}</span>
                    <span className="pub-price-unit">{offer.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="studio-body">
            <StudioOffers offers={copy.offers} />

            {copy.pricing === undefined ? null : (
              <p className="studio-pricing-link">
                <Link href={copy.pricing.href}>{copy.pricing.label}</Link>
              </p>
            )}

            {copy.cadence === undefined ? null : <p className="studio-cadence">{copy.cadence}</p>}

            {copy.kinds === undefined ? null : (
              <section aria-labelledby="studio-kinds" className="studio-kinds">
                <h2 id="studio-kinds">{copy.kinds.heading}</h2>
                <dl className="studio-rows">
                  {copy.kinds.items.map((kind) => (
                    <div className="studio-row" key={kind.name}>
                      <dt>{kind.name}</dt>
                      <dd>
                        <p className="studio-row__situation">{kind.situation}</p>
                        <p className="studio-row__line">{kind.line}</p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {copy.question === undefined ? (
              <p className="studio-answer">{copy.answer}</p>
            ) : (
              <section aria-labelledby="studio-question" className="studio-objection">
                <h2 id="studio-question">{copy.question}</h2>
                <p className="studio-answer">{copy.answer}</p>
              </section>
            )}

            <section aria-labelledby="studio-book" className="studio-book">
              <h2 id="studio-book">{copy.close}</h2>
              <div className="pub-actions">
                <a className="pub-cta" href={phoneHref}>
                  {copy.cta}
                </a>
                <a className="pub-phone" href={phoneHref}>
                  {copy.phone}
                </a>
              </div>
            </section>
          </div>
        </main>
      </div>
      <StructuredData data={studioStructuredData(copy, origin)} />
      <PublicFooter locale={locale} surface="studio" />
    </div>
  );
}
