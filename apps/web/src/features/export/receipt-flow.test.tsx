import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ExportResultNotice,
  ReceiptFlow,
} from '../../../app/studio/[workspace]/(workflow)/receipt/receipt-flow';

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
    [
      { type: 'review_incomplete', pending_group_ids: ['visuals'] } as const,
      'data-result="review_incomplete"',
    ],
    [{ type: 'conflict', actual_revision_id: '81c2' } as const, 'data-result="conflict"'],
  ])('renders export result branch', (result, marker) => {
    expect(
      renderToStaticMarkup(<ExportResultNotice result={result} workspace="lumen-skin" />),
    ).toContain(marker);
  });
});
