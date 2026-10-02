import { PublicHeader } from './public-header';
import {
  phoneHref,
  studioCopy,
  studioHeroMedia,
  type StudioHeroMedia as StudioHeroMediaRecord,
  type StudioLocale,
} from './public-copy';
import { StudioHeroMedia } from './studio-hero-media';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
}

/**
 * The studio page is a frame at screen width, designed at 375 first. Order: the work, the price,
 * what is included, the cadence, how to book. One primary action, the phone as the only secondary.
 */
export function StudioLanding({
  locale,
  media = studioHeroMedia,
}: Readonly<{ locale: StudioLocale; media?: StudioHeroMediaRecord | null }>) {
  const copy = studioCopy[locale];

  return (
    <div className="pub-page pub-page--studio" lang={locale}>
      <a className="skip-link" href="#studio-heading">
        {copy.skip}
      </a>
      <div className="pub-shell pub-shell--studio">
        <PublicHeader homeHref={copy.homeHref} links={copy.nav} />
        <main id="studio-main">
          <section className="studio-hero" aria-labelledby="studio-heading">
            <div className="studio-hero__frame" data-media={media === null ? 'none' : 'poster'}>
              {media === null ? (
                <div className="studio-hero__field" aria-hidden="true" />
              ) : (
                <StudioHeroMedia alt={media.alt[locale]} media={media} playLabel={copy.playFilm} />
              )}
              <div className="studio-hero__panel">
                <h1 id="studio-heading">{copy.h1}</h1>
                <p className="studio-hero__sub">{copy.sub}</p>
                <div className="pub-actions">
                  <a className="pub-cta" href={phoneHref}>
                    {copy.cta}
                  </a>
                  <a className="pub-phone" href={phoneHref}>
                    {copy.phone}
                  </a>
                </div>
              </div>
            </div>
          </section>

          <div className="studio-body">
            <div className="studio-offers">
              {copy.offers.map((offer) => {
                const id = `offer-${slug(offer.name)}`;
                return (
                  <section aria-labelledby={id} className="studio-offer" key={offer.name}>
                    <h2 id={id} translate="no">
                      {offer.name}
                    </h2>
                    <p className="studio-offer__price">
                      <span className="pub-price">{offer.price}</span>
                      <span className="pub-price-unit">{offer.unit}</span>
                    </p>
                    {offer.includes.length > 1 ? (
                      <ul className="studio-offer__includes">
                        {offer.includes.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ) : (
                      offer.includes.map((line) => <p key={line}>{line}</p>)
                    )}
                  </section>
                );
              })}
            </div>

            <p className="studio-cadence">{copy.cadence}</p>

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
    </div>
  );
}
