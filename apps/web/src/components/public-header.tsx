import Link from 'next/link';

/** The wordmark and, where a page has peers, the links to them. A page with no peer shows the wordmark alone. */
export function PublicHeader({
  currentHref,
  homeHref,
  links,
}: Readonly<{
  currentHref?: string;
  homeHref: string;
  links: readonly { readonly href: string; readonly label: string }[];
}>) {
  return (
    <header className="pub-header">
      <Link className="pub-wordmark" href={homeHref} translate="no">
        {'Must\u00a0Be\u00a0Viral'}
      </Link>
      {links.length === 0 ? null : (
        <nav aria-label="Site">
          <ul className="pub-nav">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  aria-current={link.href === currentHref ? 'page' : undefined}
                  href={link.href}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
