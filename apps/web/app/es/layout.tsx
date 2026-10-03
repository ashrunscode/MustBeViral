import type { ReactNode } from 'react';

import RootDocument from '../../src/components/root-document';

export { metadata, viewport } from '../../src/components/root-document';

export default function SpanishRootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <RootDocument lang="es">{children}</RootDocument>;
}
