import type { ReactNode } from 'react';

import RootDocument from '../../src/components/root-document';

export { metadata, viewport } from '../../src/components/root-document';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RootDocument lang="en">{children}</RootDocument>;
}
