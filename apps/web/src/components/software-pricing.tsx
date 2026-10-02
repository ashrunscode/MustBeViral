import Link from 'next/link';

import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import { pricingCopy, softwarePlans } from './public-copy';

/** The provisional catalog, charging named as off, and sign in as the one action. No buy button. */
export function SoftwarePricing() {
  return (
    <div className="pub-page pub-page--product" lang="en">
      <a className="skip-link" href="#pricing-heading">
        {pricingCopy.skip}
      </a>
      <div className="pub-shell">
        <PublicHeader
          currentHref="/software/pricing"
          homeHref="/software"
          links={[{ href: '/software', label: 'Software' }]}
        />
        <main id="pricing-main">
          <header className="pub-hero">
            <h1 id="pricing-heading">{pricingCopy.h1}</h1>
            <p>
              {pricingCopy.provisional} {pricingCopy.charging}
            </p>
            <p>{pricingCopy.signIn}</p>
          </header>
          <dl className="pub-offers">
            {softwarePlans.map((plan) => (
              <div className="pub-offer" key={plan.name}>
                <dt>
                  {plan.name}
                  <span className="pub-plan-detail">
                    {plan.detail.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </span>
                </dt>
                <dd>
                  <span className="pub-price">{plan.price}</span>
                  <span className="pub-price-unit">{pricingCopy.period}</span>
                </dd>
              </div>
            ))}
          </dl>
          <div className="pub-story">
            <p>{pricingCopy.reviewers}</p>
            <p>{pricingCopy.storage}</p>
            <p>{pricingCopy.allowance}</p>
          </div>
          <div className="pub-actions">
            <Link className="pub-cta" href="/login">
              {pricingCopy.cta}
            </Link>
          </div>
        </main>
      </div>
      <PublicFooter surface="software" />
    </div>
  );
}
