import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ExportResultNotice,
  ReceiptFlow,
} from '../../../app/(en)/studio/[workspace]/(workflow)/receipt/receipt-flow';
import { InMemoryExportPort, type ExportPort } from './export-port';

describe('ReceiptFlow', () => {
  it('renders immutable receipt markers, export row states, and provider/model/cost lineage', () => {
    const html = renderToStaticMarkup(<ReceiptFlow workspace="lumen-skin" />);
    expect(html).toContain('receipt-seal');
    expect(html).toContain('receipt-card');
    expect(html).toContain('receipt-number');
    expect(html).toContain('MBV-0042-7F3A');
    expect(html).toContain('Moonshot');
    expect(html).toContain('flux-2-klein');
    expect(html).toContain('$4.08');
    expect(html.match(/data-export-state=/gu)?.length).toBe(4);
  });

  it.each([
    {
      label: 'missing quote',
      quoteMicros: null,
      actualMicros: 4_080_000n,
      quoteText: 'Unavailable',
      actualText: '$4.08',
      comparisonText: 'Unavailable',
      summary: 'Quote unavailable, charged $4.08. Quote comparison unavailable.',
    },
    {
      label: 'missing settlement',
      quoteMicros: 4_200_000n,
      actualMicros: null,
      quoteText: '$4.20',
      actualText: 'Unavailable',
      comparisonText: 'Unavailable',
      summary: 'Quoted $4.20, settled amount unavailable. Quote comparison unavailable.',
    },
    {
      label: 'missing reservation totals',
      quoteMicros: null,
      actualMicros: null,
      quoteText: 'Unavailable',
      actualText: 'Unavailable',
      comparisonText: 'Unavailable',
      summary: 'Quote unavailable, settled amount unavailable. Quote comparison unavailable.',
    },
    {
      label: 'known zero totals',
      quoteMicros: 0n,
      actualMicros: 0n,
      quoteText: '$0.00',
      actualText: '$0.00',
      comparisonText: '$0.00',
      summary: 'Quoted $0.00, charged $0.00, $0.00 under quote',
    },
  ])('renders $label honestly in the ledger, evidence and summary', (testCase) => {
    const base = new InMemoryExportPort().create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    if (base.type !== 'ok') throw new Error('Expected the complete preview receipt');
    const port: ExportPort = {
      create: () => ({
        ...base,
        receipt: {
          ...base.receipt,
          quoteMicros: testCase.quoteMicros,
          actualMicros: testCase.actualMicros,
        },
      }),
    };
    const html = renderToStaticMarkup(<ReceiptFlow port={port} workspace="lumen-skin" />);

    expect(html).toContain(`<span>Named quote</span><strong>${testCase.quoteText}</strong>`);
    expect(html).toContain(`<span>Actual settled</span><strong>${testCase.actualText}</strong>`);
    expect(html).toContain(`<span>Under quote</span><strong>${testCase.comparisonText}</strong>`);
    expect(html.replaceAll(/<!--.*?-->/gu, '')).toContain(testCase.summary);
    if (testCase.actualMicros === null) {
      expect(html).toContain('<td>Total actual</td><td>Unavailable</td>');
      expect(html).toContain('Settlement unavailable');
    }
    if (testCase.comparisonText === 'Unavailable') expect(html).not.toContain('$0.00 under quote');
  });

  it('renders the incomplete checklist and blocks export creation', () => {
    const html = renderToStaticMarkup(
      <ReceiptFlow workspace="lumen-skin" scenario="review_incomplete" />,
    );
    expect(html).toContain('data-result="review_incomplete"');
    expect(html).toContain('This campaign’s content is not fully approved');
    expect(html).toContain('Back to content review');
    expect(html).not.toContain('Create immutable export');
  });

  it('renders the incomplete notice from a receipt-bearing result', () => {
    const result = new InMemoryExportPort('review_incomplete').create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['copy'],
    });
    expect(
      renderToStaticMarkup(<ExportResultNotice result={result} workspace="lumen-skin" />),
    ).toContain('data-result="review_incomplete"');
  });

  it('keeps the receipt and named checklist visible after export creation fails', () => {
    const base = new InMemoryExportPort().create({
      expectedRevisionId: '7f3a',
      approvedGroupIds: ['visuals'],
    });
    if (base.type !== 'ok') throw new Error('Expected the complete preview receipt');
    const port: ExportPort = {
      create: () => ({
        type: 'export_failed',
        message: 'Whether this export was created is not proven.',
        rows: base.rows.map((row) => ({ ...row, state: 'failed' as const })),
        receipt: base.receipt,
      }),
    };
    const html = renderToStaticMarkup(<ReceiptFlow port={port} workspace="lumen-skin" />);

    expect(html).toContain('data-result="export_failed"');
    expect(html).toContain('Export creation was not verified');
    expect(html).toContain('MBV-0042-7F3A');
    expect(html).toContain('data-export-state="failed"');
    expect(html).toContain('Check export status');
    expect(html).not.toContain('Create immutable export');
  });

  it.each([
    [
      {
        type: 'conflict',
        expected_revision_id: '7f3a',
        actual_revision_id: '81c2',
      } as const,
      'data-result="conflict"',
    ],
    [{ type: 'forbidden' } as const, 'data-result="forbidden"'],
    [{ type: 'not_found', run_id: 'missing' } as const, 'data-result="not_found"'],
    [
      { type: 'error', message: 'Core unavailable', retryable: true } as const,
      'data-result="error"',
    ],
  ])('renders export result branch', (result, marker) => {
    expect(
      renderToStaticMarkup(<ExportResultNotice result={result} workspace="lumen-skin" />),
    ).toContain(marker);
  });
});
