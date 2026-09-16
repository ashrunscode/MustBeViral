import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  CollaborationClient,
  CollaborationTicketDeniedError,
  collaborationWebSocketUrl,
  type CollaborationTicketGrant,
} from './client';
import { CollaborationSnapshotSchema } from './protocol';
import { COLLABORATION_WEBSOCKET_PROTOCOL } from './ticket';

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
    this.emit('close', {});
  }

  /** Simulates the server or network dropping the connection. */
  drop(): void {
    this.readyState = 3;
    this.emit('close', {});
  }

  emit(type: string, event: { data?: string }): void {
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

    client.upsertComment({
      comment_id: 'comment-1',
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
      'comment.upsert',
      'text.draft.upsert',
      'lease.acquire',
      'lease.release',
      'text.draft.clear',
      'presence.leave',
    ]);
    expect(messages.find((message) => message.type === 'lease.acquire')?.payload).toMatchObject({
      lease_id: 'lease-node-1-user-123',
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
