import Link from 'next/link';

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
      <nav aria-label="Site">
        <ul className="pub-nav">
          {links.map((link) => (
            <li key={link.href}>
              <Link aria-current={link.href === currentHref ? 'page' : undefined} href={link.href}>
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
