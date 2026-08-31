import { DurableObject } from 'cloudflare:workers';

import {
  type AcquireLeaseInput,
  type CollaborationSnapshot,
  type CommentDraft,
  ClientMessageSchema,
  type JoinPresenceInput,
  ServerMessageSchema,
  type UpsertCommentInput,
} from '@mustbeviral/collaboration';

const PRESENCE_STALE_MS = 60_000;

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function encodeServerMessage(message: ReturnType<typeof ServerMessageSchema.parse>): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}

export class CanvasCoordination extends DurableObject<CollaborationBindings> {
  private canvasId: string | null = null;

  constructor(ctx: DurableObjectState, env: CollaborationBindings) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS presence (
          actor_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS comments (
          comment_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS text_drafts (
          draft_id TEXT PRIMARY KEY,
          payload TEXT NOT NULL
        )
      `);
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS leases (
          lease_id TEXT PRIMARY KEY,
          node_id TEXT NOT NULL,
          payload TEXT NOT NULL,
          expires_at TEXT NOT NULL
        )
      `);
    });
  }

  private ensureCanvasId(canvasId: string): void {
    if (this.canvasId === null) {
      this.canvasId = canvasId;
      this.ctx.storage.sql.exec(
        'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
        'canvas_id',
        canvasId,
      );
      return;
    }
    if (this.canvasId !== canvasId) {
      throw new Error('Canvas coordination object is bound to a different canvas');
    }
  }

  private readCanvasId(): string {
    if (this.canvasId !== null) return this.canvasId;
    const row = this.ctx.storage.sql
      .exec<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', 'canvas_id')
      .toArray()[0];
    if (!row) throw new Error('Canvas coordination object is not initialized');
    this.canvasId = row.value;
    return row.value;
  }

  private pruneExpiredLeases(now = nowIso()): void {
    this.ctx.storage.sql.exec('DELETE FROM leases WHERE expires_at <= ?', now);
  }

  private pruneStalePresence(nowMs = Date.now()): void {
    const rows = this.ctx.storage.sql
      .exec<{ actor_id: string; payload: string }>('SELECT actor_id, payload FROM presence')
      .toArray();
    for (const row of rows) {
      const entry = parseJson<{ last_seen_at: string }>(row.payload);
      const lastSeenMs = Date.parse(entry.last_seen_at);
      if (Number.isNaN(lastSeenMs) || nowMs - lastSeenMs > PRESENCE_STALE_MS) {
        this.ctx.storage.sql.exec('DELETE FROM presence WHERE actor_id = ?', row.actor_id);
      }
    }
  }

  async getSnapshot(canvasId: string): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    this.pruneExpiredLeases();
    this.pruneStalePresence();
    const presence = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM presence')
      .toArray()
      .map((row) => parseJson<CollaborationSnapshot['presence'][number]>(row.payload));
    const comments = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM comments')
      .toArray()
      .map((row) => parseJson<CommentDraft>(row.payload));
    const textDrafts = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM text_drafts')
      .toArray()
      .map((row) => parseJson<CollaborationSnapshot['text_drafts'][number]>(row.payload));
    const leases = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM leases')
      .toArray()
      .map((row) => parseJson<CollaborationSnapshot['leases'][number]>(row.payload));
    return {
      canvas_id: this.readCanvasId(),
      presence,
      comments,
      text_drafts: textDrafts,
      leases,
    };
  }

  async joinPresence(canvasId: string, input: JoinPresenceInput): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const timestamp = nowIso();
    const payload = {
      actor: input.actor,
      joined_at: timestamp,
      last_seen_at: timestamp,
      surface: input.surface,
    };
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO presence (actor_id, payload) VALUES (?, ?)',
      input.actor.actor_id,
      JSON.stringify(payload),
    );
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  async leavePresence(canvasId: string, actorId: string): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    this.ctx.storage.sql.exec('DELETE FROM presence WHERE actor_id = ?', actorId);
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  async upsertComment(canvasId: string, input: UpsertCommentInput): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const existing = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM comments WHERE comment_id = ? LIMIT 1', input.comment_id)
      .toArray()[0];
    const timestamp = nowIso();
    const draft: CommentDraft = {
      comment_id: input.comment_id,
      author: input.author,
      body: input.body,
      created_at: existing ? parseJson<CommentDraft>(existing.payload).created_at : timestamp,
      updated_at: timestamp,
      ...(input.anchor_node_id ? { anchor_node_id: input.anchor_node_id } : {}),
    };
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO comments (comment_id, payload) VALUES (?, ?)',
      input.comment_id,
      JSON.stringify(draft),
    );
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  async acquireLease(
    canvasId: string,
    input: AcquireLeaseInput,
  ): Promise<{ accepted: boolean; snapshot: CollaborationSnapshot }> {
    this.ensureCanvasId(canvasId);
    this.pruneExpiredLeases();
    const conflict = this.ctx.storage.sql
      .exec<{ lease_id: string; payload: string }>(
        'SELECT lease_id, payload FROM leases WHERE node_id = ? LIMIT 1',
        input.node_id,
      )
      .toArray()[0];
    if (conflict) {
      const holder = parseJson<CollaborationSnapshot['leases'][number]>(conflict.payload);
      if (holder.holder.actor_id !== input.holder.actor_id) {
        return { accepted: false, snapshot: await this.getSnapshot(canvasId) };
      }
      this.ctx.storage.sql.exec('DELETE FROM leases WHERE lease_id = ?', conflict.lease_id);
    }
    const acquiredAt = nowIso();
    const expiresAt = new Date(Date.now() + input.ttl_seconds * 1_000).toISOString();
    const lease = {
      lease_id: input.lease_id,
      node_id: input.node_id,
      holder: input.holder,
      acquired_at: acquiredAt,
      expires_at: expiresAt,
    };
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO leases (lease_id, node_id, payload, expires_at) VALUES (?, ?, ?, ?)',
      input.lease_id,
      input.node_id,
      JSON.stringify(lease),
      expiresAt,
    );
    await this.broadcastSnapshot();
    return { accepted: true, snapshot: await this.getSnapshot(canvasId) };
  }

  async releaseLease(canvasId: string, leaseId: string, actorId: string): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const row = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM leases WHERE lease_id = ? LIMIT 1', leaseId)
      .toArray()[0];
    if (row) {
      const lease = parseJson<CollaborationSnapshot['leases'][number]>(row.payload);
      if (lease.holder.actor_id === actorId) {
        this.ctx.storage.sql.exec('DELETE FROM leases WHERE lease_id = ?', leaseId);
      }
    }
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  private async broadcastSnapshot(): Promise<void> {
    const snapshot = await this.getSnapshot(this.readCanvasId());
    const payload = encodeServerMessage({ type: 'snapshot', payload: snapshot });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        socket.close(1011, 'broadcast failed');
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const canvasId = url.searchParams.get('canvas_id');
    if (!canvasId) {
      return Response.json({ error: { code: 'VALIDATION_FAILED', message: 'canvas_id is required' } }, { status: 400 });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const client = pair[0];
      const server = pair[1];
      this.ctx.acceptWebSocket(server);
      const snapshot = await this.getSnapshot(canvasId);
      server.send(encodeServerMessage({ type: 'snapshot', payload: snapshot }));
      server.addEventListener('message', (event) => {
        void this.handleSocketMessage(canvasId, server, event);
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    if (request.method === 'GET' && url.pathname.endsWith('/snapshot')) {
      return Response.json({ data: await this.getSnapshot(canvasId) });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleSocketMessage(
    canvasId: string,
    socket: WebSocket,
    event: MessageEvent,
  ): Promise<void> {
    try {
      const parsed = ClientMessageSchema.parse(JSON.parse(String(event.data)));
      if (parsed.type === 'presence.join') {
        await this.joinPresence(canvasId, parsed.payload);
        return;
      }
      if (parsed.type === 'presence.leave') {
        await this.leavePresence(canvasId, parsed.payload.actor_id);
        return;
      }
      if (parsed.type === 'comment.upsert') {
        await this.upsertComment(canvasId, parsed.payload);
        return;
      }
      if (parsed.type === 'snapshot.request') {
        const snapshot = await this.getSnapshot(canvasId);
        socket.send(encodeServerMessage({ type: 'snapshot', payload: snapshot }));
      }
    } catch (error) {
      socket.send(
        encodeServerMessage({
          type: 'error',
          payload: {
            code: 'VALIDATION_FAILED',
            message: error instanceof Error ? error.message : 'Invalid collaboration message',
          },
        }),
      );
    }
  }
}

export { CanvasCoordination as default };
