// @vitest-environment jsdom

import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS,
  COLLABORATION_WEBSOCKET_PROTOCOL,
  CollaborationClient,
  CollaborationTicketDeniedError,
  InMemoryCollaborationSession,
} from '@mustbeviral/collaboration';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestCollaborationTicket } from './collaboration-ticket';
import {
  previewCollaborationActor,
  useCollaborationSession,
  type CollaborationSessionState,
} from './use-collaboration-session';

vi.mock('./collaboration-ticket', () => ({
  requestCollaborationTicket: vi.fn(),
}));

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

describe('useCollaborationSession preview transport', () => {
  it('keeps one preview session when the caller builds its actor inline on every render', async () => {
    const connect = vi.spyOn(InMemoryCollaborationSession.prototype, 'connect');
    const consoleError = vi.spyOn(console, 'error');
    let latest: CollaborationSessionState | undefined;

    // Mirrors ReviewFlow and CanvasFlow: the actor object is rebuilt on every render.
    function ReviewSurface({ reviewer }: Readonly<{ reviewer: string }>) {
      latest = useCollaborationSession({
        canvasId: 'preview-canvas',
        previewActor: previewCollaborationActor(reviewer),
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
    expect(latest?.actor).toEqual(previewCollaborationActor('Maya Chen'));
    expect(requestCollaborationTicket).not.toHaveBeenCalled();

    // A parent re-render with an equal actor value must not restart the session either.
    root.render(<ReviewSurface reviewer="Maya Chen" />);
    await observeFor(50);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(maximumUpdateDepthErrors(consoleError)).toBe(0);
  });

  it('reconnects when the actor value itself changes', async () => {
    const connect = vi.spyOn(InMemoryCollaborationSession.prototype, 'connect');
    let latest: CollaborationSessionState | undefined;

    function CanvasSurface({ actorId }: Readonly<{ actorId: string }>) {
      latest = useCollaborationSession({
        canvasId: 'preview-canvas',
        previewActor: { actor_id: actorId, display_name: actorId },
        surface: 'canvas',
        transport: 'preview',
      });
      return null;
    }

    const root = createRoot(document.createElement('div'));
    mounted.push(root);
    root.render(<CanvasSurface actorId="alex-kim" />);
    await waitUntil(() => latest?.status === 'open');
    root.render(<CanvasSurface actorId="priya-rao" />);
    await waitUntil(() =>
      Boolean(latest?.snapshot?.presence.some((entry) => entry.actor.actor_id === 'priya-rao')),
    );

    expect(connect).toHaveBeenCalledTimes(2);
    expect(latest?.snapshot?.presence.map((entry) => entry.actor.actor_id)).not.toContain(
      'alex-kim',
    );
  });
});

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];
  readonly sent: string[] = [];
  readonly listeners = new Map<string, Set<(event: { data?: string }) => void>>();
  readyState = 0;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
      this.readyState = MockWebSocket.OPEN;
      this.emit('open', {});
      this.emit('message', {
        data: JSON.stringify({
          type: 'snapshot',
          payload: {
            canvas_id: 'canvas-live',
            presence: [],
            comments: [],
            text_drafts: [],
            leases: [],
          },
        }),
      });
    });
  }

  addEventListener(type: string, listener: (event: { data?: string }) => void): void {
    const bucket = this.listeners.get(type) ?? new Set();
    bucket.add(listener);
    this.listeners.set(type, bucket);
  }

  send(payload: string): void {
    this.sent.push(payload);
  }

  close(): void {
    this.readyState = 3;
    this.emit('close', { code: 1000 });
  }

  /** The server closing the socket with a close code. */
  drop(code: number): void {
    this.readyState = 3;
    this.emit('close', { code });
  }

  emit(type: string, event: { data?: string; code?: number }): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

describe('useCollaborationSession websocket transport', () => {
  const boundActor = {
    actor_id: '9f2c1d7e-5b8a-4c3f-9e21-7a6b5c4d3e2f',
    display_name: 'Collaborator 1A2B',
    color: '#7b4fc9',
  };

  beforeEach(() => {
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.stubEnv('NEXT_PUBLIC_APP_ORIGIN', 'http://127.0.0.1:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'local-publishable-key-value');
    vi.stubEnv('NEXT_PUBLIC_CORE_API_URL', 'http://127.0.0.1:8787');
    vi.stubEnv('NEXT_PUBLIC_COLLABORATION_API_URL', 'http://127.0.0.1:8788');
    let issued = 0;
    vi.mocked(requestCollaborationTicket).mockImplementation(async () => {
      issued += 1;
      return { ticket: `ticket-${String(issued)}.signature`, actor: boundActor };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.mocked(requestCollaborationTicket).mockReset();
  });

  function LiveCanvas({
    onState,
  }: Readonly<{ onState: (state: CollaborationSessionState) => void }>) {
    onState(
      useCollaborationSession({
        canvasId: 'canvas-live',
        // The same preview label the page passes; live transport must ignore it.
        previewActor: previewCollaborationActor('You'),
        surface: 'canvas',
        transport: 'websocket',
      }),
    );
    return null;
  }

  it('acts as the actor Core bound into the ticket, not a caller-chosen label', async () => {
    const consoleError = vi.spyOn(console, 'error');
    let latest: CollaborationSessionState | undefined;
    const root = createRoot(document.createElement('div'));
    mounted.push(root);
    root.render(
      <LiveCanvas
        onState={(state) => {
          latest = state;
        }}
      />,
    );
    await waitUntil(() => latest?.status === 'open' && latest.actor !== null);
    await observeFor(100);

    expect(latest?.actor).toEqual(boundActor);
    expect(latest?.actor?.display_name).not.toBe('You');
    expect(requestCollaborationTicket).toHaveBeenCalledTimes(1);
    expect(requestCollaborationTicket).toHaveBeenCalledWith('canvas-live');
    expect(MockWebSocket.instances).toHaveLength(1);
    const socket = MockWebSocket.instances[0]!;
    expect(socket.url).toBe('ws://127.0.0.1:8788/canvases/canvas-live/ws');
    expect(socket.protocols).toEqual([COLLABORATION_WEBSOCKET_PROTOCOL, 'ticket-1.signature']);
    expect(socket.sent.join('\n')).not.toMatch(/local-preview|"You"|"actor"/u);
    expect(maximumUpdateDepthErrors(consoleError)).toBe(0);

    latest?.acquireLease('node-7');
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'lease.acquire',
      payload: { node_id: 'node-7', ttl_seconds: 120 },
    });
    latest?.createComment({ body: 'Warmer key light', anchor_node_id: 'node-7' });
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'comment.create',
      payload: { body: 'Warmer key light', anchor_node_id: 'node-7' },
    });
    latest?.deleteComment('3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f');
    expect(JSON.parse(socket.sent.at(-1)!)).toEqual({
      type: 'comment.delete',
      payload: { comment_id: '3c1d2e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f' },
    });
  });

  it('fetches a fresh ticket when the socket reconnects', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      let latest: CollaborationSessionState | undefined;
      const root = createRoot(document.createElement('div'));
      mounted.push(root);
      root.render(
        <LiveCanvas
          onState={(state) => {
            latest = state;
          }}
        />,
      );
      for (let index = 0; index < 20 && MockWebSocket.instances.length === 0; index += 1) {
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(MockWebSocket.instances).toHaveLength(1);

      MockWebSocket.instances[0]!.close();
      await vi.advanceTimersByTimeAsync(1_100);

      expect(requestCollaborationTicket).toHaveBeenCalledTimes(2);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(MockWebSocket.instances[1]!.protocols).toEqual([
        COLLABORATION_WEBSOCKET_PROTOCOL,
        'ticket-2.signature',
      ]);
      expect(latest?.actor).toEqual(boundActor);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reconnects transparently with a fresh ticket when the Worker ends the session', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    const connect = vi.spyOn(CollaborationClient.prototype, 'connect');
    const consoleError = vi.spyOn(console, 'error');
    try {
      const states: CollaborationSessionState[] = [];
      const root = createRoot(document.createElement('div'));
      mounted.push(root);
      root.render(
        <LiveCanvas
          onState={(state) => {
            states.push(state);
          }}
        />,
      );
      for (let index = 0; index < 20 && states.at(-1)?.status !== 'open'; index += 1) {
        await vi.advanceTimersByTimeAsync(10);
      }
      expect(states.at(-1)?.status).toBe('open');
      const openedAt = states.length;

      vi.setSystemTime(Date.now() + COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000);
      MockWebSocket.instances[0]!.drop(COLLABORATION_CLOSE_CODES.SESSION_EXPIRED);
      // Far less than the first reconnect backoff: a lifetime close reconnects at once.
      for (let index = 0; index < 10; index += 1) await vi.advanceTimersByTimeAsync(10);

      expect(requestCollaborationTicket).toHaveBeenCalledTimes(2);
      expect(MockWebSocket.instances).toHaveLength(2);
      expect(MockWebSocket.instances[1]!.protocols).toEqual([
        COLLABORATION_WEBSOCKET_PROTOCOL,
        'ticket-2.signature',
      ]);
      expect(states.at(-1)?.status).toBe('open');
      expect(states.at(-1)?.actor).toEqual(boundActor);
      // The session effect never restarted, and the last snapshot stayed on screen throughout.
      expect(connect).toHaveBeenCalledTimes(1);
      expect(states.slice(openedAt).every((state) => state.snapshot !== null)).toBe(true);
      expect(maximumUpdateDepthErrors(consoleError)).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops when Core refuses the reconnect ticket, as for a removed member', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    let issued = 0;
    vi.mocked(requestCollaborationTicket).mockImplementation(async () => {
      issued += 1;
      if (issued > 1) throw new CollaborationTicketDeniedError('FORBIDDEN');
      return { ticket: 'ticket-1.signature', actor: boundActor };
    });
    try {
      let latest: CollaborationSessionState | undefined;
      const root = createRoot(document.createElement('div'));
      mounted.push(root);
      root.render(
        <LiveCanvas
          onState={(state) => {
            latest = state;
          }}
        />,
      );
      for (let index = 0; index < 20 && latest?.status !== 'open'; index += 1) {
        await vi.advanceTimersByTimeAsync(10);
      }
      vi.setSystemTime(Date.now() + COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000);
      MockWebSocket.instances[0]!.drop(COLLABORATION_CLOSE_CODES.SESSION_EXPIRED);
      await vi.advanceTimersByTimeAsync(60_000);

      expect(requestCollaborationTicket).toHaveBeenCalledTimes(2);
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(latest?.status).toBe('error');
    } finally {
      vi.useRealTimers();
    }
  });
});
