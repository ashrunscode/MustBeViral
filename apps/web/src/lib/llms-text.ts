import {
  phoneDisplay,
  pricingCopy,
  softwareCopy,
  softwarePlans,
  studioEmail,
  studioEn,
  studioEs,
} from '../components/public-copy';

/**
 * The plain-text summary served at /llms.txt for agents and answer engines. Every line is built from
 * the copy the pages render, so nothing here can drift from what a visitor reads: the locked studio
 * lines, the section 7 offers, the product tagline and the provisional catalog.
 */
export function buildLlmsText(origin: string | undefined): string {
  const at = (path: string) => (origin === undefined ? path : `${origin}${path}`);
  const offers = studioEn.offers.map(
    (offer) => `- ${offer.name}: ${offer.price}, ${offer.unit}. ${offer.includes.join('. ')}.`,
  );
  const plans = softwarePlans.map(
    (plan) => `- ${plan.name}: ${plan.price} ${pricingCopy.period}. ${plan.detail.join('. ')}.`,
  );
  return [
    '# Must Be Viral',
    '',
    '> Two offers under one name, on separate pages. The Houston studio films businesses on a schedule and hands back posts with a calendar. The software lets a team brief, lets agents produce, and asks the team to approve every dollar before it is spent.',
    '',
    '## Houston studio',
    '',
    `- ${studioEn.h1}`,
    `- ${studioEn.sub}`,
    '- Service area: Houston metro. We come to the business.',
    ...offers,
    '- No tier below the Full Package is sold. No discounts.',
    `- ${studioEn.cadence}`,
    `- ${studioEn.close}`,
    `- Phone: ${phoneDisplay}. Email: ${studioEmail}.`,
    '- We make no claim about reach, views, followers or results.',
    `- English page: ${at('/')}`,
    `- Spanish page: ${at('/es')} (${studioEs.h1} ${studioEs.sub})`,
    '',
    '## Software',
    '',
    `- ${softwareCopy.tagline}`,
    `- ${softwareCopy.filmFact}`,
    '- No run starts without explicit confirmation of an unexpired quote.',
    `- ${softwareCopy.enrollment} Sign in is for invited operators. ${softwareCopy.requestAccess}: ${studioEmail}.`,
    `- ${pricingCopy.provisional} ${pricingCopy.charging}`,
    ...plans,
    `- ${pricingCopy.allowance}`,
    `- ${pricingCopy.reviewers}`,
    '- The plan named Studio is a software plan, not the Houston filming service.',
    `- Software page: ${at('/software')}`,
    `- Plans page: ${at('/software/pricing')}`,
    '',
    '## Contact',
    '',
    `- Phone: ${phoneDisplay}`,
    `- Email: ${studioEmail}`,
    '- Houston, Texas. Timezone America/Chicago.',
    '',
  ].join('\n');
}
