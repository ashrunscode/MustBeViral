// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ComposedReview,
  ReviewFlow,
} from '../../../app/(en)/studio/[workspace]/(workflow)/review/review-flow';
import type {
  ArtifactGroupReview,
  ReviewConcept,
  ReviewPortResult,
  ReviewReadPort,
  ReviewReadResult,
  ReviewSummary,
} from './review-port';

vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => '/studio/ws-1/review',
  useSearchParams: () => new URLSearchParams('run=run-1'),
}));

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
  it('keeps the review heading when its session expires', async () => {
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() => Promise.resolve({ type: 'session_expired' }))}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    await screen.findByRole('region', { name: 'Session expired' });
    expect(screen.getByRole('heading', { level: 1, name: 'Review outputs' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Export approved' })).toBeNull();
  });

  it.each<ReviewReadResult>([
    { type: 'forbidden' },
    { type: 'not_found', artifact_id: 'missing' },
    { type: 'conflict', actual_revision_id: 'new-revision' },
    { type: 'error', message: 'Read unavailable.', retryable: true },
    { type: 'ok', groups: [], summary: summary() },
    { type: 'ok', groups: [group], summary: summary() },
  ])('offers no approved export without verified approvals: $type', async (readResult) => {
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() => Promise.resolve(readResult))}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    await waitFor(() => expect(screen.queryByText('Reading outputs and approvals…')).toBeNull());
    expect(screen.queryByRole('link', { name: 'Export approved' })).toBeNull();
    expect(screen.queryByText('0 / 0 approved')).toBeNull();
    if (readResult.type !== 'ok') {
      expect(screen.queryByText(/0 of 0 approved/u)).toBeNull();
      expect(screen.queryByRole('textbox', { name: 'Add a draft comment' })).toBeNull();
    }
  });

  it('offers export after a nonempty verified receipt records every approval', async () => {
    const approved: ArtifactGroupReview = {
      ...group,
      decision: 'approved',
      variants: group.variants.map((variant) => ({ ...variant, decision: 'approved' })),
    };
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() =>
          Promise.resolve({ type: 'ok', groups: [approved], summary: summary() }),
        )}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    expect(
      (await screen.findAllByRole('link', { name: 'Export approved' })).length,
    ).toBeGreaterThan(0);
  });

  it('keeps an overflowing denied review keyboard reachable without active child controls', async () => {
    const resizes: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizes.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      render(
        <ReviewFlow
          dataMode="worker"
          readPort={port(() => Promise.resolve({ type: 'forbidden' }))}
          runId="run-1"
          workspace="ws-1"
        />,
      );
      await screen.findByText('Your session is not permitted to review this run.');
      const stage = screen.getByRole('region', { name: 'Review outputs' });
      expect(stage.hasAttribute('tabindex')).toBe(false);
      for (const [key, value] of Object.entries({
        scrollHeight: 900,
        clientHeight: 400,
        scrollWidth: 375,
        clientWidth: 375,
      })) {
        Object.defineProperty(stage, key, { configurable: true, value });
      }
      act(() => resizes.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(stage.getAttribute('tabindex')).toBe('0');
      act(() => stage.focus());
      expect(document.activeElement).toBe(stage);
      Object.defineProperty(stage, 'scrollHeight', { configurable: true, value: 400 });
      act(() => resizes.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(stage.getAttribute('tabindex')).toBe('0');
      expect(document.activeElement).toBe(stage);
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('makes closed QA findings inert and returns focus to their named trigger', async () => {
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() => Promise.resolve({ type: 'ok', groups: [group], summary: summary() }))}
        runId="run-1"
        workspace="ws-1"
      />,
    );
    const close = await screen.findByRole('button', { name: 'Close QA findings' });
    const drawer = close.closest('.mbv-drawer');
    if (drawer === null) throw new Error('The QA findings drawer is missing.');
    const trigger = screen.getByRole('button', { name: 'QA findings' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Escape' });
    expect(drawer.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(drawer.id);
    fireEvent.click(trigger);
    expect(drawer.hasAttribute('inert')).toBe(false);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('waits for the pinned receipt before showing review controls and comments', async () => {
    let finishRead: (result: ReviewReadResult) => void = () => undefined;
    const heldRead = new Promise<ReviewReadResult>((resolve) => {
      finishRead = resolve;
    });
    render(
      <ReviewFlow
        dataMode="worker"
        readPort={port(() => heldRead)}
        runId="run-1"
        workspace="ws-1"
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Review outputs' })).toBeTruthy();
    expect(screen.getByText('Reading outputs and approvals…')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Add a draft comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Close QA findings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Approve Visual system' })).toBeNull();
    expect(document.querySelector('.receipt-summary')).toBeNull();

    await act(async () => {
      finishRead({ type: 'ok', groups: [group], summary: summary() });
      await heldRead;
    });
    expect(await screen.findByRole('button', { name: 'Approve Visual system' })).toBeTruthy();
    expect(screen.getByRole('textbox', { name: 'Add a draft comment' })).toBeTruthy();
    expect(screen.queryByText('Reading outputs and approvals…')).toBeNull();
  });

  it('makes overflowing QA findings keyboard reachable and keeps focus when they fit again', async () => {
    const resizes: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resizes.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    try {
      render(
        <ReviewFlow
          dataMode="worker"
          readPort={port(() =>
            Promise.resolve({ type: 'ok', groups: [group], summary: summary() }),
          )}
          runId="run-1"
          workspace="ws-1"
        />,
      );
      await screen.findByRole('button', { name: 'Approve Visual system' });
      const panel = screen
        .getAllByRole('complementary', { name: 'QA findings' })
        .find((element) =>
          element.contains(
            screen.getByText('Receipt-backed artifacts remain isolated from local review drafts.'),
          ),
        );
      if (panel === undefined) throw new Error('The named QA findings panel is missing.');
      expect(panel.hasAttribute('tabindex')).toBe(false);
      for (const [key, value] of Object.entries({
        scrollHeight: 900,
        clientHeight: 400,
        scrollWidth: 320,
        clientWidth: 320,
      })) {
        Object.defineProperty(panel, key, { configurable: true, value });
      }
      act(() => resizes.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(panel.getAttribute('tabindex')).toBe('0');
      act(() => panel.focus());
      expect(document.activeElement).toBe(panel);
      Object.defineProperty(panel, 'scrollHeight', { configurable: true, value: 400 });
      act(() => resizes.forEach((callback) => callback([], {} as ResizeObserver)));
      expect(panel.getAttribute('tabindex')).toBe('0');
      expect(document.activeElement).toBe(panel);
    } finally {
      cleanup();
      vi.unstubAllGlobals();
    }
  });

  it('announces placement switches as pressed buttons and keeps the safe-zone checkbox independent', () => {
    const concept: ReviewConcept = {
      id: 'concept-fixture',
      index: 1,
      title: 'Synthetic placement fixture',
      angle: 'Local preview mechanics',
      copy: null,
      copyVariant: null,
      master: group.variants[0] ?? null,
      placements: { '4:5': null, '1:1': null, '9:16': null },
      motion: null,
      decision: 'pending',
      members: group.variants,
    };
    const approve = vi.fn();
    render(
      <ComposedReview
        campaignName="Synthetic placement fixture"
        concepts={[concept]}
        onApprove={approve}
        onDescribe={() => undefined}
        onInspect={() => undefined}
      />,
    );

    const controls = within(screen.getByRole('group', { name: 'Placement' }));
    expect(controls.getAllByRole('button')).toHaveLength(4);
    const feed = controls.getByRole('button', { name: 'Feed 4:5', pressed: true });
    const square = controls.getByRole('button', { name: 'Feed 1:1', pressed: false });
    const safeZone = controls.getByRole('checkbox', { name: 'Safe zone', checked: true });
    fireEvent.click(square);
    expect(square.getAttribute('aria-pressed')).toBe('true');
    expect(feed.getAttribute('aria-pressed')).toBe('false');
    expect(controls.getByRole('checkbox', { name: 'Safe zone', checked: true })).toBe(safeZone);
    fireEvent.click(safeZone);
    expect(controls.getByRole('checkbox', { name: 'Safe zone', checked: false })).toBe(safeZone);
    expect(square.getAttribute('aria-pressed')).toBe('true');
    expect(approve).not.toHaveBeenCalled();
  });

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
