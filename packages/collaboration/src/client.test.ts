import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CollaborationClient,
  CollaborationTicketDeniedError,
  collaborationWebSocketUrl,
  type CollaborationTicketGrant,
} from './client';
import {
  COLLABORATION_CLOSE_CODES,
  COLLABORATION_COMMENT_BODY_MAX_LENGTH,
  COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS,
} from './limits';
import { CollaborationSnapshotSchema } from './protocol';
import { COLLABORATION_WEBSOCKET_PROTOCOL } from './ticket';

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];
  readonly sent: string[] = [];
  readonly listeners = new Map<string, Set<(event: { data?: string; code?: number }) => void>>();
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
          payload: CollaborationSnapshotSchema.parse({
            canvas_id: 'canvas-1',
            presence: [],
            comments: [],
            text_drafts: [],
            leases: [],
          }),
        }),
      });
    });
  }

  addEventListener(
    type: string,
    listener: (event: { data?: string; code?: number }) => void,
  ): void {
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

  /** Simulates the server or network dropping the connection. */
  drop(code = 1006): void {
    this.readyState = 3;
    this.emit('close', { code });
  }

  emit(type: string, event: { data?: string; code?: number }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
}

const boundActor = { actor_id: 'user-123', display_name: 'Collaborator 1A2B', color: '#3182d4' };

function grants(): { provider: () => Promise<CollaborationTicketGrant>; issued: string[] } {
  const issued: string[] = [];
  return {
    issued,
    provider: async () => {
      const ticket = `ticket-${String(issued.length + 1)}.signature`;
      issued.push(ticket);
      return { ticket, actor: boundActor };
    },
  };
}

async function flush(): Promise<void> {
  for (let index = 0; index < 5; index += 1) await Promise.resolve();
  await new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function sentMessages(socket: MockWebSocket | undefined): Record<string, unknown>[] {
  return (socket?.sent ?? []).map((raw) => JSON.parse(raw) as Record<string, unknown>);
}

describe('collaboration client', () => {
  afterEach(() => {
    MockWebSocket.instances = [];
  });

  it('builds websocket urls for http and https collaboration bases', () => {
    expect(collaborationWebSocketUrl('http://127.0.0.1:8788', 'canvas-a')).toBe(
      'ws://127.0.0.1:8788/canvases/canvas-a/ws',
    );
    expect(collaborationWebSocketUrl('https://collab.example.test/', 'canvas-b')).toBe(
      'wss://collab.example.test/canvases/canvas-b/ws',
    );
  });

  it('connects with the ticket as a subprotocol, never in the url, and sends no identity', async () => {
    const snapshots: string[] = [];
    const actors: string[] = [];
    const { provider, issued } = grants();
    const client = new CollaborationClient({
      baseUrl: 'http://127.0.0.1:8788',
      canvasId: 'canvas-1',
      surface: 'canvas',
      ticketProvider: provider,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot.canvas_id);
      },
      onActor: (actor) => {
        actors.push(actor.actor_id);
      },
    });
    client.connect();
    await flush();

    const socket = MockWebSocket.instances[0];
    expect(socket?.url).toBe('ws://127.0.0.1:8788/canvases/canvas-1/ws');
    expect(socket?.url).not.toContain('ticket');
    expect(socket?.protocols).toEqual([COLLABORATION_WEBSOCKET_PROTOCOL, issued[0]]);
    expect(actors).toEqual(['user-123']);
    expect(client.actor).toEqual(boundActor);
    expect(snapshots).toEqual(['canvas-1']);
    expect(sentMessages(socket)[0]).toEqual({
      type: 'presence.join',
      payload: { surface: 'canvas' },
    });

    client.createComment({
      body: 'Tighter crop.',
      anchor_node_id: 'node-1',
    });
    client.upsertTextDraft({
      draft_id: 'node-1::parameters.prompt',
      node_id: 'node-1',
      field_path: 'parameters.prompt',
      body: 'Sharper macro texture',
    });
    client.acquireLease('node-1');
    client.releaseLease('node-1');
    client.clearCheckpointedDrafts(['node-1::parameters.prompt'], 'revision-2');
    client.disconnect();

    const messages = sentMessages(socket);
    expect(messages.map((message) => message.type)).toEqual([
      'presence.join',
      'comment.create',
      'text.draft.upsert',
      'lease.acquire',
      'lease.release',
      'text.draft.clear',
      'presence.leave',
    ]);
    // Leases are named by node only; the Worker derives the lease id from the bound actor.
    expect(messages.find((message) => message.type === 'lease.acquire')?.payload).toEqual({
      node_id: 'node-1',
      ttl_seconds: 120,
    });
    expect(messages.find((message) => message.type === 'lease.release')?.payload).toEqual({
      node_id: 'node-1',
    });
    for (const message of messages) {
      expect(JSON.stringify(message)).not.toMatch(/"(actor|author|holder|actor_id)"/u);
    }
  });

  it('fetches a fresh ticket for every reconnect', async () => {
    const { provider, issued } = grants();
    const client = new CollaborationClient({
      baseUrl: 'https://collab.example.test',
      canvasId: 'canvas-1',
      surface: 'review',
      ticketProvider: provider,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      reconnectDelaysMs: [0],
    });
    client.connect();
    await flush();
    expect(issued).toHaveLength(1);

    MockWebSocket.instances[0]?.drop();
    await flush();
    await flush();
    expect(issued).toHaveLength(2);
    expect(MockWebSocket.instances[1]?.protocols).toEqual([
      COLLABORATION_WEBSOCKET_PROTOCOL,
      issued[1],
    ]);
    expect(issued[1]).not.toBe(issued[0]);

    MockWebSocket.instances[1]?.drop();
    await flush();
    await flush();
    expect(issued).toHaveLength(3);
    client.disconnect();
    expect(client.status).toBe('closed');
  });

  it('stops without opening a socket when Core denies the ticket', async () => {
    const statuses: string[] = [];
    const provider = vi.fn(async () => {
      throw new CollaborationTicketDeniedError('forbidden');
    });
    const client = new CollaborationClient({
      baseUrl: 'https://collab.example.test',
      canvasId: 'canvas-1',
      surface: 'canvas',
      ticketProvider: provider,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      reconnectDelaysMs: [0],
      onStatus: (status) => {
        statuses.push(status);
      },
    });
    client.connect();
    await flush();
    await flush();
    expect(provider).toHaveBeenCalledOnce();
    expect(MockWebSocket.instances).toHaveLength(0);
    expect(statuses.at(-1)).toBe('error');
  });

  it('bounds retries when the ticket endpoint keeps failing', async () => {
    const provider = vi.fn(async () => {
      throw new Error('network');
    });
    const client = new CollaborationClient({
      baseUrl: 'https://collab.example.test',
      canvasId: 'canvas-1',
      surface: 'canvas',
      ticketProvider: provider,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      reconnectDelaysMs: [0],
      maxReconnectAttempts: 2,
    });
    client.connect();
    for (let index = 0; index < 6; index += 1) await flush();
    expect(provider).toHaveBeenCalledTimes(3);
    expect(client.status).toBe('error');
    expect(MockWebSocket.instances).toHaveLength(0);
  });
});

describe('collaboration client session lifetime', () => {
  afterEach(() => {
    MockWebSocket.instances = [];
  });

  function lifetimeClient(
    provider: () => Promise<CollaborationTicketGrant>,
    extra: Partial<ConstructorParameters<typeof CollaborationClient>[0]> = {},
  ) {
    let now = 1_000_000;
    const statuses: string[] = [];
    const client = new CollaborationClient({
      baseUrl: 'https://collab.example.test',
      canvasId: 'canvas-1',
      surface: 'canvas',
      ticketProvider: provider,
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      // A long backoff proves that a lifetime close reconnects without waiting for it.
      reconnectDelaysMs: [60_000],
      now: () => now,
      onStatus: (status) => {
        statuses.push(status);
      },
      ...extra,
    });
    return {
      client,
      statuses,
      advance(ms: number) {
        now += ms;
      },
    };
  }

  it('reconnects at once with a fresh ticket when the Worker ends the session', async () => {
    const { provider, issued } = grants();
    const snapshots: string[] = [];
    const { client, advance } = lifetimeClient(provider, {
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot.canvas_id);
      },
    });
    client.connect();
    await flush();
    const first = MockWebSocket.instances[0]!;

    advance(COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000);
    first.drop(COLLABORATION_CLOSE_CODES.SESSION_EXPIRED);
    // Sent while re-authenticating: queued, not dropped.
    expect(client.createComment({ body: 'Written during the reconnect' })).toBe(true);
    expect(client.snapshot?.canvas_id).toBe('canvas-1');
    await flush();
    await flush();

    expect(issued).toHaveLength(2);
    const second = MockWebSocket.instances[1]!;
    expect(second.protocols).toEqual([COLLABORATION_WEBSOCKET_PROTOCOL, issued[1]]);
    expect(client.status).toBe('open');
    expect(sentMessages(second).map((message) => message.type)).toEqual([
      'presence.join',
      'comment.create',
    ]);
    expect(snapshots).toEqual(['canvas-1', 'canvas-1']);
    client.disconnect();
  });

  it('stops when Core refuses the new ticket, as for a removed member', async () => {
    let calls = 0;
    const provider = vi.fn(async (): Promise<CollaborationTicketGrant> => {
      calls += 1;
      if (calls === 1) return { ticket: 'ticket-1.signature', actor: boundActor };
      throw new CollaborationTicketDeniedError('FORBIDDEN');
    });
    const { client, advance, statuses } = lifetimeClient(provider);
    client.connect();
    await flush();
    advance(COLLABORATION_SOCKET_MAX_LIFETIME_SECONDS * 1_000);
    MockWebSocket.instances[0]!.drop(COLLABORATION_CLOSE_CODES.SESSION_EXPIRED);
    expect(client.createComment({ body: 'Never delivered' })).toBe(true);
    await flush();
    await flush();

    expect(provider).toHaveBeenCalledTimes(2);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(client.status).toBe('error');
    expect(statuses.at(-1)).toBe('error');
    // The queued message is discarded, not sent later.
    expect(client.createComment({ body: 'After refusal' })).toBe(false);
  });

  it('does not reconnect after a policy-violation close', async () => {
    const { provider, issued } = grants();
    const { client } = lifetimeClient(provider, { reconnectDelaysMs: [0] });
    client.connect();
    await flush();
    MockWebSocket.instances[0]!.drop(COLLABORATION_CLOSE_CODES.POLICY_VIOLATION);
    await flush();
    await flush();
    expect(issued).toHaveLength(1);
    expect(client.status).toBe('error');
  });

  it('backs off instead of looping when the session ends right after opening', async () => {
    const { provider, issued } = grants();
    const { client, statuses } = lifetimeClient(provider);
    client.connect();
    await flush();
    MockWebSocket.instances[0]!.drop(COLLABORATION_CLOSE_CODES.SESSION_EXPIRED);
    expect(client.createComment({ body: 'Not queued' })).toBe(false);
    await flush();
    await flush();
    expect(issued).toHaveLength(1);
    expect(statuses.at(-1)).toBe('connecting');
    client.disconnect();
  });

  it('reports over-limit input with the typed error and sends nothing', async () => {
    const { provider } = grants();
    const errors: unknown[] = [];
    const { client } = lifetimeClient(provider, {
      onError: (error) => {
        errors.push(error);
      },
    });
    client.connect();
    await flush();
    const socket = MockWebSocket.instances[0]!;
    const sentBefore = socket.sent.length;

    expect(
      client.createComment({ body: 'x'.repeat(COLLABORATION_COMMENT_BODY_MAX_LENGTH + 1) }),
    ).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    expect(errors).toEqual([
      {
        code: 'FIELD_TOO_LARGE',
        message: `payload.body exceeds its limit of ${String(COLLABORATION_COMMENT_BODY_MAX_LENGTH)} characters.`,
        request_type: 'comment.create',
        details: {
          field: 'payload.body',
          limit: COLLABORATION_COMMENT_BODY_MAX_LENGTH,
          unit: 'characters',
        },
      },
    ]);
    client.disconnect();
  });

  it('routes comment results and typed errors, and ignores frames it does not understand', async () => {
    const { provider } = grants();
    const results: unknown[] = [];
    const errors: unknown[] = [];
    const { client, statuses } = lifetimeClient(provider, {
      onCommentResult: (result) => {
        results.push(result);
      },
      onError: (error) => {
        errors.push(error);
      },
    });
    client.connect();
    await flush();
    const socket = MockWebSocket.instances[0]!;
    socket.emit('message', { data: JSON.stringify({ type: 'future.message', payload: {} }) });
    socket.emit('message', {
      data: JSON.stringify({
        type: 'comment.result',
        payload: { operation: 'create', comment_id: 'server-id', client_request_id: 'r-1' },
      }),
    });
    socket.emit('message', {
      data: JSON.stringify({
        type: 'error',
        payload: {
          code: 'RATE_LIMITED',
          message: 'Slow down',
          details: { scope: 'socket', retry_after_ms: 100 },
        },
      }),
    });
    expect(client.status).toBe('open');
    expect(statuses).not.toContain('error');
    expect(results).toEqual([
      { operation: 'create', comment_id: 'server-id', client_request_id: 'r-1' },
    ]);
    expect(errors).toEqual([
      {
        code: 'RATE_LIMITED',
        message: 'Slow down',
        details: { scope: 'socket', retry_after_ms: 100 },
      },
    ]);
    client.disconnect();
  });
});
