/**
 * The canonical public site, shared by metadata, structured data and crawler files.
 * Deployment and auth origins can differ; a preview host or a bad public environment value must
 * never become the indexable site's identity.
 */
export function publicOrigin(): string {
  return 'https://mustbeviral.com';
}
