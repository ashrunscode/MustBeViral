import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import { phoneHref, studioAddOns, studioEn, studioPricingCopy } from './public-copy';
import { StructuredData, studioStructuredData } from './structured-data';
import { StudioOffers } from './studio-offers';

/**
 * The studio pricing page: the two offers in full, the add-on ranges with their rule, and the same
 * one action as the home page. English only; the Spanish page links here and says it is English.
 */
export function StudioPricing({ origin }: Readonly<{ origin?: string | undefined }>) {
  const copy = studioEn;
  return (
    <div className="pub-page pub-page--studio" lang="en">
      <a className="skip-link" href="#pricing-heading">
        {studioPricingCopy.skip}
      </a>
      <div className="pub-shell pub-shell--studio">
        <PublicHeader currentHref="/pricing" homeHref={copy.homeHref} links={copy.nav} />
        <main className="studio-pricing" id="pricing-main">
          <header className="pub-hero">
            <h1 id="pricing-heading">{studioPricingCopy.h1}</h1>
            <p>{studioPricingCopy.sub}</p>
          </header>
          <StudioOffers offers={copy.offers} />
          <section aria-labelledby="pricing-addons" className="studio-addons">
            <h2 id="pricing-addons">{studioPricingCopy.addOnsHeading}</h2>
            <dl>
              {studioAddOns.map((addOn) => (
                <div className="studio-addon" key={addOn.name}>
                  <dt>{addOn.name}</dt>
                  <dd>
                    <span className="studio-addon__price">{addOn.price}</span>
                    {'note' in addOn ? <span>{addOn.note}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
            <p>{studioPricingCopy.addOnsRule}</p>
            <p>{studioPricingCopy.turnaround}</p>
          </section>
          <section aria-labelledby="pricing-book" className="studio-book">
            <h2 id="pricing-book">{copy.close}</h2>
            <div className="pub-actions">
              <a className="pub-cta" href={phoneHref}>
                {copy.cta}
              </a>
              <a className="pub-phone" href={phoneHref}>
                {copy.phone}
              </a>
            </div>
          </section>
        </main>
      </div>
      <StructuredData data={studioStructuredData(copy, origin)} />
      <PublicFooter surface="studio" />
    </div>
  );
}
