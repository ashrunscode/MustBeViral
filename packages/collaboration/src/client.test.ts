import { afterEach, describe, expect, it } from 'vitest';

import { CollaborationClient, collaborationWebSocketUrl } from './client';
import { CollaborationSnapshotSchema } from './protocol';

class MockWebSocket {
  static readonly OPEN = 1;
  static instances: MockWebSocket[] = [];
  readonly sent: string[] = [];
  readonly listeners = new Map<string, Set<(event: { data?: string }) => void>>();
  readyState = MockWebSocket.OPEN;

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
    queueMicrotask(() => {
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

  emit(type: string, event: { data?: string }): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }
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

  it('joins presence on connect and forwards snapshot updates', async () => {
    const snapshots: string[] = [];
    const client = new CollaborationClient({
      baseUrl: 'http://127.0.0.1:8788',
      canvasId: 'canvas-1',
      actor: { actor_id: 'actor-1', display_name: 'A' },
      surface: 'canvas',
      WebSocketImpl: MockWebSocket as unknown as typeof WebSocket,
      onSnapshot: (snapshot) => {
        snapshots.push(snapshot.canvas_id);
      },
    });
    client.connect();
    await Promise.resolve();
    expect(MockWebSocket.instances[0]?.url).toContain('/canvases/canvas-1/ws');
    expect(MockWebSocket.instances[0]?.sent[0]).toContain('"type":"presence.join"');
    expect(snapshots).toEqual(['canvas-1']);
    client.upsertComment({
      comment_id: 'comment-1',
      body: 'Needs a tighter crop.',
      anchor_node_id: 'node-1',
    });
    expect(MockWebSocket.instances[0]?.sent.at(-1)).toContain('"type":"comment.upsert"');
    client.upsertTextDraft({
      draft_id: 'node-1::parameters.prompt',
      node_id: 'node-1',
      field_path: 'parameters.prompt',
      body: 'Sharper macro texture',
    });
    expect(MockWebSocket.instances[0]?.sent.at(-1)).toContain('"type":"text.draft.upsert"');
    client.acquireLease('node-1', 'lease-node-1');
    expect(MockWebSocket.instances[0]?.sent.at(-1)).toContain('"type":"lease.acquire"');
    client.releaseLease('lease-node-1');
    expect(MockWebSocket.instances[0]?.sent.at(-1)).toContain('"type":"lease.release"');
    client.disconnect();
    expect(MockWebSocket.instances[0]?.sent.at(-1)).toContain('"type":"presence.leave"');
  });
});
