import type { StudioOffer } from './public-copy';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, '-');
}

/** The two offers in full: the name, the price in the evidence face, and every included line. */
export function StudioOffers({ offers }: Readonly<{ offers: readonly StudioOffer[] }>) {
  return (
    <div className="studio-offers">
      {offers.map((offer) => {
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
  );
}
