import type { Metadata } from 'next';

import NotFoundPage, { metadata as notFoundMetadata } from './(en)/not-found';
import RootDocument, { metadata as rootMetadata } from '../src/components/root-document';

export { viewport } from '../src/components/root-document';

export const metadata: Metadata = {
  ...rootMetadata,
  ...notFoundMetadata,
  title: 'Page not found | Must Be Viral',
};

export default function GlobalNotFound() {
  return (
    <RootDocument lang="en">
      <NotFoundPage />
    </RootDocument>
  );
}
