import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  QuoteFlow,
  QuoteResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/quote/quote-flow';
import { InMemoryQuotePort, type QuoteConfirmResult } from './quote-port';

describe('QuoteResultNotice result-union rendering', () => {
  it.each([
    [
      { type: 'ok', runId: 'run-1', acceptedMaximumMicros: 4_200_000n },
      'data-result="ok"',
      'Run confirmed',
    ],
    [
      { type: 'expired_quote', expiredAtMs: 1_000 },
      'data-result="expired_quote"',
      'Re-quote this run',
    ],
    [
      {
        type: 'cap_exceeded',
        capMicros: 8_000_000n,
        attemptedMicros: 9_000_000n,
        explanation: 'No provider work was submitted.',
      },
      'data-result="cap_exceeded"',
      'Spend cap blocked confirmation',
    ],
    [
      { type: 'conflict', expected_revision_id: '7f3a', actual_revision_id: '81c2' },
      'data-result="conflict"',
      'Open canvas recovery',
    ],
    [
      {
        type: 'reconciliation_required',
        quoteId: 'quote-uncertain',
        message: 'Do not submit this paid operation again until reconciled.',
      },
      'data-result="reconciliation_required"',
      'Confirmation requires reconciliation',
    ],
    [{ type: 'forbidden' }, 'data-result="forbidden"', 'Confirmation stopped'],
    [
      { type: 'not_found', quote_id: 'quote-missing' },
      'data-result="not_found"',
      'Quote quote-missing was not found',
    ],
    [
      { type: 'error', message: 'Core unavailable', retryable: true },
      'data-result="error"',
      'Core unavailable',
    ],
  ] satisfies ReadonlyArray<readonly [QuoteConfirmResult, string, string]>)(
    'renders the $result.type branch',
    (result, marker, text) => {
      const html = renderToStaticMarkup(
        <QuoteResultNotice result={result} workspace="lumen-skin" />,
      );
      expect(html).toContain(marker);
      expect(html).toContain(text);
    },
  );
});

describe('QuoteFlow expiry and acknowledgment gating', () => {
  it('renders the named total and keeps confirmation disabled before acknowledgment', () => {
    const html = renderToStaticMarkup(
      <QuoteFlow
        workspace="lumen-skin"
        initialNowMs={1_000}
        port={new InMemoryQuotePort({ nowMs: 1_000 })}
      />,
    );
    expect(html).toContain('$4.20');
    expect(html).toMatch(/disabled=""[^>]*><span>Confirm \$4\.20 run<\/span>/u);
  });

  it('swaps confirmation for re-quote after the 15-minute boundary', () => {
    const port = new InMemoryQuotePort({ nowMs: 1_000 });
    const html = renderToStaticMarkup(
      <QuoteFlow workspace="lumen-skin" initialNowMs={901_000} port={port} />,
    );
    expect(html).toContain('Quote expired');
    expect(html).toContain('Re-quote this run');
    expect(html).not.toContain('Confirm $4.20 run');
  });
});
