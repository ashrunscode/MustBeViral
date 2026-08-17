import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  ReviewCopyPreview,
  ReviewFlow,
  ReviewResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/review/review-flow';

describe('ReviewFlow', () => {
  it('renders comparison pairs, named reviewer, and approval controls', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" mode="compare" />);
    expect(html.match(/compare-pair/gu)?.length).toBe(4);
    expect(html).toContain('Reviewer · Maya Chen');
    expect(html).toContain('Approve group as Maya Chen');
    expect(html).not.toContain('Accessibility description');
  });

  it('renders mobile receipt and export semantic sections from the same review DOM', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" />);
    expect(html).toContain('receipt-summary');
    expect(html).toContain('export-status');
    expect(html).toContain('export-row');
    expect(html).toContain('$18.42 / $100.00');
  });

  it('renders worker copy as headline, primary text, and description', () => {
    const html = renderToStaticMarkup(
      <ReviewCopyPreview
        copy={{
          headline: 'Keep nights simple',
          primaryText: '200 mg glycinate. Take one capsule.',
          description: 'Dietary supplement. FDA has not evaluated this statement.',
        }}
      />,
    );
    expect(html).toContain('Headline');
    expect(html).toContain('Keep nights simple');
    expect(html).toContain('Primary text');
    expect(html).toContain('200 mg glycinate. Take one capsule.');
    expect(html).toContain('Description');
    expect(html).toContain('Dietary supplement. FDA has not evaluated this statement.');
  });

  it.each([
    [{ type: 'reason_required', variant_id: 'story-a' } as const, 'data-result="reason_required"'],
    [{ type: 'conflict', actual_revision_id: '81c2' } as const, 'data-result="conflict"'],
    [{ type: 'not_found', artifact_id: 'missing' } as const, 'data-result="not_found"'],
    [
      { type: 'description_required', artifact_id: 'missing' } as const,
      'data-result="description_required"',
    ],
    [{ type: 'forbidden' } as const, 'data-result="forbidden"'],
    [
      { type: 'error', message: 'Core unavailable', retryable: true } as const,
      'data-result="error"',
    ],
  ])('renders review result branch', (result, marker) => {
    expect(renderToStaticMarkup(<ReviewResultNotice result={result} />)).toContain(marker);
  });
});
