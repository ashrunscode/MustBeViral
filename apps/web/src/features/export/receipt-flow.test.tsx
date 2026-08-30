import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ExportResultNotice,
  ReceiptFlow,
} from '../../../app/studio/[workspace]/(workflow)/receipt/receipt-flow';
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

  it('renders the incomplete checklist and blocks export creation', () => {
    const html = renderToStaticMarkup(
      <ReceiptFlow workspace="lumen-skin" scenario="review_incomplete" />,
    );
    expect(html).toContain('data-result="review_incomplete"');
    expect(html).toContain('Launch pack is incomplete');
    expect(html).toContain('Return to named review');
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
        message: 'Core did not prove whether this export was created.',
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
