import { describe, expect, it } from 'vitest';

import {
  isTerminalSourceJobStatus,
  sniffDocumentMediaType,
  SourceJobTransitionError,
  transitionSourceJob,
  websiteContentTypeAllowed,
} from './source-capture';

describe('source job transitions', () => {
  it('leases, persists, and rejects only from capturing', () => {
    expect(transitionSourceJob('queued', 'lease')).toBe('capturing');
    expect(transitionSourceJob('capturing', 'persist')).toBe('captured');
    expect(transitionSourceJob('capturing', 'requeue')).toBe('queued');
    expect(isTerminalSourceJobStatus('captured')).toBe(true);
    expect(isTerminalSourceJobStatus('queued')).toBe(false);
  });
  it('does not leave capturing as a stuck terminal state', () => {
    expect(() => transitionSourceJob('captured', 'lease')).toThrow(SourceJobTransitionError);
    expect(transitionSourceJob('failed', 'lease')).toBe('capturing');
  });
});

describe('document sniffing', () => {
  it('accepts bounded text types and rejects PDF/ZIP/OLE', () => {
    expect(sniffDocumentMediaType(new TextEncoder().encode('Hello'), 'text/plain')).toBe(
      'text/plain',
    );
    expect(sniffDocumentMediaType(new TextEncoder().encode('<html>ok</html>'), 'text/html')).toBe(
      'text/html',
    );
    expect(sniffDocumentMediaType(new TextEncoder().encode('%PDF-1.7'), 'text/plain')).toBe(
      'unsupported',
    );
    expect(sniffDocumentMediaType(new TextEncoder().encode('PK\u0003\u0004'), 'text/html')).toBe(
      'unsupported',
    );
    expect(sniffDocumentMediaType(new Uint8Array([0, 1, 2]), 'text/plain')).toBe('malformed');
    const embeddedNul = new Uint8Array(16);
    embeddedNul.set(new TextEncoder().encode('<html>ok'));
    embeddedNul[12] = 0;
    expect(sniffDocumentMediaType(embeddedNul, 'text/html')).toBe('malformed');
    expect(sniffDocumentMediaType(new TextEncoder().encode('not actually html'), 'text/html')).toBe(
      'malformed',
    );
    expect(
      sniffDocumentMediaType(new TextEncoder().encode('Hours\t24/7\nopen'), 'text/plain'),
    ).toBe('text/plain');
    expect(sniffDocumentMediaType(new TextEncoder().encode('Hours\u0007bell'), 'text/plain')).toBe(
      'malformed',
    );
    expect(
      sniffDocumentMediaType(new TextEncoder().encode('Hours\u001Bescape'), 'text/plain'),
    ).toBe('malformed');
  });
  it('allows HTML website content types only', () => {
    expect(websiteContentTypeAllowed('text/html; charset=utf-8')).toBe(true);
    expect(websiteContentTypeAllowed('application/pdf')).toBe(false);
  });
});
