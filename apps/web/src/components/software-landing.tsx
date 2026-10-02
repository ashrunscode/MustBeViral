import Link from 'next/link';

import { PublicFooter } from './public-footer';
import { PublicHeader } from './public-header';
import { requestAccessHref, softwareCopy } from './public-copy';
import { SoftwareFilm } from './software-film';
import { softwareStructuredData, StructuredData } from './structured-data';

/**
 * The software page is the path: the tagline, the film with its four beats beside it, then the one
 * action. Enrollment is closed, so the only other link is mail, and it says so. The studio is named
 * only in the footer, so the two pitches never share a headline or an action.
 */
export function SoftwareLanding({ origin }: Readonly<{ origin?: string | undefined }>) {
  return (
    <div className="pub-page pub-page--product pub-page--film" lang="en">
      <a className="skip-link" href="#software-heading">
        {softwareCopy.skip}
      </a>
      <div className="pub-shell pub-shell--film">
        <PublicHeader
          currentHref="/software"
          homeHref="/software"
          links={[{ href: '/software/pricing', label: 'Plans' }]}
        />
        <main id="software-main">
          <div className="pub-copy">
            <h1 id="software-heading">{softwareCopy.tagline}</h1>
            <p>{softwareCopy.filmFact}</p>
          </div>
          <SoftwareFilm />
          <div className="pub-copy">
            <p>{softwareCopy.enrollment}</p>
            <div className="pub-actions">
              <Link className="pub-cta" href="/login">
                {softwareCopy.cta}
              </Link>
              <a className="pub-phone" href={requestAccessHref}>
                {softwareCopy.requestAccess}
              </a>
            </div>
          </div>
        </main>
      </div>
      <StructuredData data={softwareStructuredData(origin)} />
      <PublicFooter surface="software" />
    </div>
  );
}
