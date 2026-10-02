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

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
}

/**
 * The studio page is a frame at screen width, designed at 375 first. The frame holds the whole
 * decision with no footage: the locked lines, the two offers with their prices in the evidence
 * face, and one action with the phone as the only secondary. When a rights-cleared poster and clip
 * exist they take their own block above the lead, with the geometry reserved; nothing ever sits
 * over the native video controls. Below the frame: the cadence, the six kinds of work in the owner's
 * words, the objection with its answer under them, and how to book.
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
            <div className="studio-frame__offers">
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
          </section>

          <div className="studio-body">
            <p className="studio-cadence">{copy.cadence}</p>

            {copy.kinds === undefined ? null : (
              <section aria-labelledby="studio-kinds" className="studio-kinds">
                <h2 id="studio-kinds">{copy.kinds.heading}</h2>
                <dl className="studio-kinds__list">
                  {copy.kinds.items.map((kind) => (
                    <div className="studio-kind" key={kind.name}>
                      <dt>{kind.name}</dt>
                      <dd>
                        <p className="studio-kind__situation">{kind.situation}</p>
                        <p className="studio-kind__line">{kind.line}</p>
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
    </div>
  );
}
