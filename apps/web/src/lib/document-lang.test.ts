import { describe, expect, it } from 'vitest';

import { documentLangForPath, isPublicMarketingPath, parseDocumentLang } from './document-lang';

describe('documentLangForPath', () => {
  it('declares Spanish only for the Spanish studio page', () => {
    expect(documentLangForPath('/es')).toBe('es');
    expect(documentLangForPath('/es/')).toBe('es');
    expect(documentLangForPath('/')).toBe('en');
    expect(documentLangForPath('/software')).toBe('en');
    expect(documentLangForPath('/estate')).toBe('en');
    expect(documentLangForPath('/studio')).toBe('en');
  });

  it('falls back to English for a missing or unknown header value', () => {
    expect(parseDocumentLang('es')).toBe('es');
    expect(parseDocumentLang('en')).toBe('en');
    expect(parseDocumentLang(null)).toBe('en');
    expect(parseDocumentLang(undefined)).toBe('en');
    expect(parseDocumentLang('fr')).toBe('en');
  });
});

describe('isPublicMarketingPath', () => {
  it('names the public pages and the text routes, and nothing under studio or auth', () => {
    for (const path of [
      '/',
      '/es',
      '/pricing',
      '/software',
      '/software/pricing',
      '/software/pricing/',
      '/privacy',
      '/terms',
      '/advertising',
      '/robots.txt',
      '/sitemap.xml',
      '/llms.txt',
    ]) {
      expect(isPublicMarketingPath(path)).toBe(true);
    }
    for (const path of ['/login', '/signup', '/studio', '/studio/abc', '/software/other']) {
      expect(isPublicMarketingPath(path)).toBe(false);
    }
  });
});
