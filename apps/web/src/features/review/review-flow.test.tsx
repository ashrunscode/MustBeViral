import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { runFailureRecoveryCopyForKind } from '@mustbeviral/contracts';

import {
  ComposedReview,
  offersLocalRejectAction,
  ReviewCopyPreview,
  ReviewFlow,
  ReviewRecoveryNotice,
  ReviewResultNotice,
} from '../../../app/studio/[workspace]/(workflow)/review/review-flow';
import type { ReviewConcept, ReviewSummary } from './review-port';

describe('ReviewFlow', () => {
  it('keeps Reject exclusive to the explicitly local preview fixture', () => {
    expect(offersLocalRejectAction('preview')).toBe(true);
    expect(offersLocalRejectAction('worker')).toBe(false);
  });

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

  it('keeps preview review money on the locked receipt summary', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" />);
    expect(html).toContain('$18.42 / $100.00');
    expect(html).toContain('Review outputs');
  });

  it('keeps preview review on artifact cards instead of composed ads', () => {
    const html = renderToStaticMarkup(<ReviewFlow workspace="lumen-skin" />);
    expect(html).toContain('Visual system');
    expect(html).toContain('Approve group as Maya Chen');
    expect(html).not.toContain('Composed review');
  });

  it('renders worker composed review as a phone ad with placements', () => {
    const variant = {
      id: 'a11',
      groupId: 'adaptations',
      label: 'Feed 4:5',
      format: '4:5 placement',
      model: 'flux-kontext',
      decision: 'pending' as const,
      accessibilityDescription: 'Stillroom compost caddy on a sand counter.',
      hasPrior: false,
      previewUrl: 'https://example.test/preview.jpg',
      nodeKey: 'adaptation-1-1',
    };
    const concept: ReviewConcept = {
      id: 'concept-1',
      index: 1,
      title: 'Packshot',
      angle: 'Problem-recognition',
      copy: {
        headline: 'Keep nights simple',
        primaryText: 'Countertop compost without the smell.',
        description: '',
      },
      copyVariant: null,
      master: null,
      placements: { '4:5': variant, '1:1': null, '9:16': null },
      motion: null,
      decision: 'pending',
      members: [variant],
    };
    const html = renderToStaticMarkup(
      <ComposedReview
        campaignName="Stillroom pack"
        concepts={[concept]}
        onApprove={() => undefined}
        onDescribe={() => undefined}
        onInspect={() => undefined}
      />,
    );
    expect(html).toContain('Composed review');
    expect(html).toContain('Stillroom pack · Sponsored');
    expect(html).toContain('Feed 4:5');
    expect(html).toContain('Keep nights simple');
    expect(html).toContain('Countertop compost without the smell.');
    expect(html).toContain('Approve this concept');
    expect(html).toContain('Accessibility description required before approval');
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

  it('keeps recovery and exact settlement above retained review artifacts', () => {
    const summary: ReviewSummary = {
      authorizedMicros: 4_550_000n,
      quotedMicros: 4_550_000n,
      capturedMicros: 150_000n,
      releasedMicros: 3_000_000n,
      refundedMicros: 125_000n,
      pendingMicros: 1_400_000n,
      netMicros: 25_000n,
      settlementStatus: 'partially_captured',
      budgetUsedMicros: 150_000n,
      budgetCapMicros: 4_550_000n,
      exportReady: false,
      qaNoteCount: 0,
      qaFindings: [],
      route: 'Receipt lineage',
      campaignName: 'Partial pack',
      recovery: {
        ...runFailureRecoveryCopyForKind('ambiguous'),
        state: 'reconciliation_required',
        affectedNodes: [
          {
            runNodeId: 'run-node-unknown',
            nodeKey: 'master-2',
            state: 'reconciliation_required',
            kind: 'ambiguous',
          },
        ],
        retainedRunNodeIds: ['run-node-kept'],
      },
    };
    const html = renderToStaticMarkup(
      <ReviewRecoveryNotice runId="run-partial" summary={summary} workspace="lumen-skin" />,
    );
    expect(html).toContain('data-review-recovery="ambiguous"');
    expect(html).toContain(
      'Run settlement: $4.55 authorized · $0.15 captured · $3.00 released · $0.13 refunded · $0.03 net · partially_captured · $1.40 pending',
    );
    expect(html).toContain('1 completed branch is available below');
    expect(html).toContain('Edit campaign brief');
    expect(html).toContain('Open receipt');
    expect(html).not.toMatch(/retry now|provider payload|signed url|token=/iu);
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
