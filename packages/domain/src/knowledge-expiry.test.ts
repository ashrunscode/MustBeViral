import { describe, expect, it } from 'vitest';
import { extractRepresentativeAssertions } from './representative-extract';
import { approvalBlockReason } from './brand-version';

describe('source offer expiry precision', () => {
  it.each(['text/html', 'text/plain', 'text/markdown'] as const)(
    'retains explicit times, offsets and microseconds in %s',
    (mediaType) => {
      const end = '2098-01-01T18:00:00.123456-06:00';
      const text =
        mediaType === 'text/html'
          ? `<p data-offer="sale" data-offer-ends="${end}">Half price</p>`
          : `Offer: sale — Half price until ${end}`;
      const offer = extractRepresentativeAssertions({ mediaType, text }).find(
        (item) => item.kind === 'offer',
      );
      expect(offer?.ends_at).toBe(end);
      expect(offer?.status).toBe('observed');
    },
  );

  it.each(['infinity', '2026-02-30', '2098-01-01T18:00:00', '2098-01-01T25:00:00Z'])(
    'keeps supplied invalid expiry %s disputed',
    (end) => {
      const offer = extractRepresentativeAssertions({
        mediaType: 'text/html',
        text: `<p data-offer="sale" data-offer-ends="${end}">Half price</p>`,
      }).find((item) => item.kind === 'offer');
      expect(offer).toMatchObject({ status: 'disputed', value_text: 'Half price', ends_at: null });
      expect(offer?.excerpt).toMatch(/expiry/iu);
    },
  );

  it('keeps the conservative date-only boundary at the start of the supplied UTC date', () => {
    const offer = extractRepresentativeAssertions({
      mediaType: 'text/plain',
      text: 'Offer: sale — Half price until 2098-01-01',
    }).find((item) => item.kind === 'offer');
    expect(offer?.ends_at).toBe('2098-01-01T00:00:00.000Z');
  });

  it('compares instants rather than offset spellings and retains microsecond conflicts', () => {
    const offers = extractRepresentativeAssertions({
      mediaType: 'text/html',
      text: '<p data-offer="sale" data-offer-ends="2098-01-01T12:00:00.000001Z">Half price</p><p data-offer="sale" data-offer-ends="2098-01-01T06:00:00.000001-06:00">Half price</p>',
    }).filter((item) => item.kind === 'offer');
    expect(approvalBlockReason(offers, '2098-01-01T11:00:00.000000Z')).toBeNull();
    expect(
      approvalBlockReason(
        [{ ...offers[0]!, ends_at: '2098-01-01T12:00:00.000002Z' }, offers[1]!],
        '2098-01-01T11:00:00Z',
      ),
    ).toBe('CONTRADICTORY_KNOWLEDGE');
    expect(approvalBlockReason(offers, '2098-01-01T12:00:00.000002Z')).toBe('EXPIRED_OFFER');
  });
});
