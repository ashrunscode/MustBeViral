import Link from 'next/link';

import { phoneDisplay, phoneHref, siteFooter, studioEmail } from './public-copy';

export type FooterSurface = 'studio' | 'software' | 'legal';

/**
 * The one footer on every public page: the entity, the phone, the mail, Houston, the three legal
 * pages. The studio footer adds its pricing page; a quiet last line names the other surface. On the
 * Spanish page the English pages are linked in English and said to be in English, because no
 * fluent reviewer has signed any Spanish beyond the locked lines.
 */
export function PublicFooter({
  compact = false,
  locale = 'en',
  surface,
}: Readonly<{ compact?: boolean; locale?: 'en' | 'es'; surface: FooterSurface }>) {
  const links = [...(surface === 'studio' ? [siteFooter.pricing] : []), ...siteFooter.legal];
  const english = locale === 'es';
  return (
    <footer className={`pub-footer${compact ? ' pub-footer--compact' : ''}`}>
      <div className="pub-footer__inner">
        <p className="pub-footer__entity" translate="no">
          {siteFooter.entity}
        </p>
        <p className="pub-footer__contact">
          <a href={phoneHref}>{phoneDisplay}</a>
          <a href={`mailto:${studioEmail}`}>{studioEmail}</a>
          <span>{siteFooter.place}</span>
          <span lang={english ? 'en' : undefined}>{siteFooter.address}</span>
        </p>
        <nav aria-label="Legal" lang={english ? 'en' : undefined}>
          <ul className="pub-footer__links">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          {english ? <p className="pub-footer__note">{siteFooter.englishNote}</p> : null}
        </nav>
        {surface === 'studio' ? (
          <p className="pub-footer__other" lang={english ? 'en' : undefined}>
            {siteFooter.otherSurface.studio}{' '}
            <Link href={siteFooter.software.href}>{siteFooter.software.label}</Link>
          </p>
        ) : null}
        {surface === 'software' ? (
          <p className="pub-footer__other">
            {siteFooter.otherSurface.software}{' '}
            <Link href={siteFooter.studio.href}>{siteFooter.studio.label}</Link>
          </p>
        ) : null}
        {surface === 'legal' ? (
          <p className="pub-footer__other">
            <Link href={siteFooter.studio.href}>{siteFooter.studio.label}</Link>
            <Link href={siteFooter.software.href}>{siteFooter.software.label}</Link>
          </p>
        ) : null}
      </div>
    </footer>
  );
}
