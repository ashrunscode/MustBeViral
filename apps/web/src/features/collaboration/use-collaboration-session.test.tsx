// @vitest-environment jsdom

import { InMemoryCollaborationSession } from '@mustbeviral/collaboration';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  collaborationActorForReviewer,
  useCollaborationSession,
  type CollaborationSessionState,
} from './use-collaboration-session';

// These tests deliberately run outside act(). act() drains React work synchronously, so a
// passive-effect update loop would never return; the real scheduler yields between renders like a
// browser does, which lets the test observe the loop and then unmount to stop it.

const mounted: Root[] = [];

afterEach(() => {
  for (const root of mounted.splice(0)) root.unmount();
});

function nextMacrotask(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

async function waitUntil(condition: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('condition not met before timeout');
    await nextMacrotask();
  }
}

async function observeFor(durationMs: number): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end) await nextMacrotask();
}

function maximumUpdateDepthErrors(spy: { mock: { calls: unknown[][] } }): number {
  return spy.mock.calls.filter((call) => String(call[0]).includes('Maximum update depth exceeded'))
    .length;
}

describe('useCollaborationSession', () => {
  it('keeps one preview session when the caller builds its actor inline on every render', async () => {
    const connect = vi.spyOn(InMemoryCollaborationSession.prototype, 'connect');
    const consoleError = vi.spyOn(console, 'error');
    let latest: CollaborationSessionState | undefined;

    // Mirrors ReviewFlow and CanvasFlow: the actor object is rebuilt on every render.
    function ReviewSurface({ reviewer }: Readonly<{ reviewer: string }>) {
      latest = useCollaborationSession({
        canvasId: 'preview-canvas',
        actor: collaborationActorForReviewer(reviewer, 'preview'),
        surface: 'review',
        transport: 'preview',
      });
      return null;
    }

    const root = createRoot(document.createElement('div'));
    mounted.push(root);
    root.render(<ReviewSurface reviewer="Maya Chen" />);
    await waitUntil(() => latest?.status === 'open');
    await observeFor(150);

    expect(maximumUpdateDepthErrors(consoleError)).toBe(0);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(latest?.snapshot?.presence.map((entry) => entry.actor.actor_id)).toContain(
      'local-preview',
    );

    // A parent re-render with an equal actor value must not restart the session either.
    root.render(<ReviewSurface reviewer="Maya Chen" />);
    await observeFor(50);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(maximumUpdateDepthErrors(consoleError)).toBe(0);
  });

  it('reconnects when the actor value itself changes', async () => {
    const connect = vi.spyOn(InMemoryCollaborationSession.prototype, 'connect');
    let latest: CollaborationSessionState | undefined;

    function CanvasSurface({ reviewer }: Readonly<{ reviewer: string }>) {
      latest = useCollaborationSession({
        canvasId: 'preview-canvas',
        actor: collaborationActorForReviewer(reviewer, 'websocket'),
        surface: 'canvas',
        transport: 'preview',
      });
      return null;
    }

    const root = createRoot(document.createElement('div'));
    mounted.push(root);
    root.render(<CanvasSurface reviewer="Alex Kim" />);
    await waitUntil(() => latest?.status === 'open');
    root.render(<CanvasSurface reviewer="Priya Rao" />);
    await waitUntil(() =>
      Boolean(latest?.snapshot?.presence.some((entry) => entry.actor.actor_id === 'priya-rao')),
    );

    expect(connect).toHaveBeenCalledTimes(2);
    expect(latest?.snapshot?.presence.map((entry) => entry.actor.actor_id)).not.toContain(
      'alex-kim',
    );
  });
});
