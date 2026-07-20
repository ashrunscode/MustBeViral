import { describe, expect, it } from 'vitest';

import {
  InMemoryQuotePort,
  canConfirmQuote,
  createGoldenQuote,
  formatQuoteCountdown,
  quoteIsExpired,
  quoteSecondsRemaining,
} from './quote-port';

describe('quote expiry and confirmation gate', () => {
  const now = Date.UTC(2026, 6, 20, 12, 0, 0);
  const quote = createGoldenQuote(now);

  it('creates a complete 15-minute quote and formats the countdown', () => {
    expect(quote.expiresAtMs - quote.createdAtMs).toBe(15 * 60 * 1000);
    expect(quoteSecondsRemaining(quote.expiresAtMs, now)).toBe(900);
    expect(formatQuoteCountdown(900)).toBe('15:00');
    expect(formatQuoteCountdown(0)).toBe('00:00');
  });

  it('expires at the boundary and disables confirmation', () => {
    expect(quoteIsExpired(quote.expiresAtMs, quote.expiresAtMs - 1)).toBe(false);
    expect(quoteIsExpired(quote.expiresAtMs, quote.expiresAtMs)).toBe(true);
    expect(
      canConfirmQuote({
        acknowledged: true,
        expiresAtMs: quote.expiresAtMs,
        nowMs: quote.expiresAtMs,
        pending: false,
      }),
    ).toBe(false);
    expect(
      canConfirmQuote({
        acknowledged: false,
        expiresAtMs: quote.expiresAtMs,
        nowMs: now,
        pending: false,
      }),
    ).toBe(false);
  });
});

describe('InMemoryQuotePort result union', () => {
  it.each(['ok', 'expired_quote', 'cap_exceeded', 'conflict'] as const)(
    'returns the %s branch',
    async (scenario) => {
      const port = new InMemoryQuotePort({ nowMs: 1_000, scenario });
      const quote = port.read();
      const result = await port.confirm({ quote, acknowledged: true, nowMs: 2_000 });
      expect(result.type).toBe(scenario);
    },
  );
});
