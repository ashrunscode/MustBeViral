// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ReviewFlow } from '../../../app/(en)/studio/[workspace]/(workflow)/review/review-flow';
import type {
  ArtifactGroupReview,
  ReviewPortResult,
  ReviewReadPort,
  ReviewReadResult,
  ReviewSummary,
} from './review-port';

afterEach(cleanup);

const group: ArtifactGroupReview = {
  id: 'visuals',
  name: 'Visual system',
  reviewer: 'Maya Chen',
  decision: 'pending',
  revision: 'rev-1',
  variants: [
    {
      id: 'v1',
      groupId: 'visuals',
      label: 'Hero',
      format: '1:1',
      model: 'flux',
      decision: 'pending',
      accessibilityDescription: 'A compost caddy on a sand counter.',
      hasPrior: false,
      previewUrl: null,
    },
  ],
};

function summary(over: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    canvasId: 'canvas-1',
    authorizedMicros: 0n,
    quotedMicros: 0n,
    capturedMicros: 0n,
    releasedMicros: 0n,
    refundedMicros: 0n,
    pendingMicros: 0n,
    netMicros: 0n,
    settlementStatus: 'active',
    budgetUsedMicros: 0n,
    budgetCapMicros: 0n,
    exportReady: false,
    qaNoteCount: 0,
    qaFindings: [],
    route: 'kimi + flux',
    campaignName: null,
    recovery: null,
    ...over,
  };
}

function port(
  read: () => Promise<ReviewReadResult>,
  decision: ReviewPortResult = { type: 'ok', groups: [group] },
): ReviewReadPort {
  return {
    read,
    describeVariant: () => undefined,
    decideVariant: () => Promise.resolve(decision),
    approveGroup: () => Promise.resolve(decision),
    approveMembers: () => Promise.resolve(decision),
  };
}

describe('ReviewFlow against a worker read port', () => {
  it('shows no receipt figure and claims nothing about charges after a failed read', async () => {
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() =>
          Promise.resolve({
            type: 'error',
            message: 'The review could not be loaded. Nothing changed.',
            retryable: true,
          }),
        )}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    await screen.findByText('The review could not be loaded. Nothing changed.');
    expect(screen.getByRole('button', { name: 'Try loading review again' })).toBeTruthy();
    expect(document.querySelector('.receipt-summary')).toBeNull();
    expect(screen.queryByText(/No reservation is recorded/u)).toBeNull();
    expect(screen.queryByText('Run total')).toBeNull();
  });

  it('says nothing was charged only when the receipt records no reservation', async () => {
    const { unmount } = render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() =>
          Promise.resolve({
            type: 'ok',
            groups: [group],
            summary: summary({ reservationRecorded: false }),
          }),
        )}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    await screen.findByText('No reservation is recorded for this run. Nothing was charged.');
    expect(screen.queryByText('Run total')).toBeNull();
    unmount();

    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() =>
          Promise.resolve({
            type: 'ok',
            groups: [group],
            summary: summary({
              reservationRecorded: true,
              quotedMicros: 4_200_000n,
              capturedMicros: 4_200_000n,
              budgetCapMicros: 4_200_000n,
              budgetUsedMicros: 4_200_000n,
              settlementStatus: 'captured',
            }),
          }),
        )}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    await screen.findByText('Run total');
    expect(screen.queryByText(/No reservation is recorded/u)).toBeNull();
    expect(screen.getAllByText('$4.20').length).toBeGreaterThan(0);
  });

  it('offers a reload when an approval conflicts after the review has loaded', async () => {
    const read = vi.fn(() =>
      Promise.resolve<ReviewReadResult>({
        type: 'ok',
        groups: [group],
        summary: summary({ reservationRecorded: true }),
      }),
    );
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(read, { type: 'conflict', actual_revision_id: '81c2' })}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    const approve = await screen.findByRole('button', { name: 'Approve Visual system' });
    fireEvent.click(approve);
    const reload = await screen.findByRole('button', { name: 'Reload the review' });
    expect(screen.getByText(/Revision 81c2 is now current\. Nothing was approved\./u)).toBeTruthy();
    fireEvent.click(reload);
    await screen.findByRole('button', { name: 'Approve Visual system' });
    expect(read).toHaveBeenCalledTimes(2);
  });
});
