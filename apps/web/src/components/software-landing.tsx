import Link from 'next/link';

import { PublicHeader } from './public-header';
import { softwareCopy } from './public-copy';
import { SoftwareFilm } from './software-film';

export function SoftwareLanding() {
  return (
    <main className="pub-page pub-page--product" lang="en">
      <a className="skip-link" href="#software-heading">
        {softwareCopy.skip}
      </a>
      <div className="pub-shell pub-shell--film">
        <PublicHeader
          currentHref="/software"
          homeHref="/software"
          links={[
            { href: '/', label: 'Houston studio' },
            { href: '/software/pricing', label: 'Plans' },
          ]}
        />
        <div className="pub-copy">
          <h1 id="software-heading">{softwareCopy.tagline}</h1>
          <p>{softwareCopy.filmFact}</p>
        </div>
        <SoftwareFilm />
        <div className="pub-copy">
          <ol className="pub-path">
            {softwareCopy.path.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          <p>{softwareCopy.enrollment}</p>
          <div className="pub-actions">
            <Link className="pub-cta" href="/login">
              {softwareCopy.cta}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
