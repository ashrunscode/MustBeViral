import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ReviewFlow,
  ReviewResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/review/review-flow';

describe('ReviewFlow', () => {
  it('renders comparison pairs, named reviewer, and approval controls', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" mode="compare" />);
    expect(html.match(/compare-pair/gu)?.length).toBe(4);
    expect(html).toContain('Reviewer · Maya Chen');
    expect(html).toContain('Approve group as Maya Chen');
  });

  it('renders mobile receipt and export semantic sections from the same review DOM', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" />);
    expect(html).toContain('receipt-summary');
    expect(html).toContain('export-status');
    expect(html).toContain('export-row');
  });

  it.each([
    [{ type: 'reason_required', variant_id: 'story-a' } as const, 'data-result="reason_required"'],
    [{ type: 'conflict', actual_revision_id: '81c2' } as const, 'data-result="conflict"'],
    [{ type: 'not_found', artifact_id: 'missing' } as const, 'data-result="not_found"'],
  ])('renders review result branch', (result, marker) => {
    expect(renderToStaticMarkup(<ReviewResultNotice result={result} />)).toContain(marker);
  });
});
