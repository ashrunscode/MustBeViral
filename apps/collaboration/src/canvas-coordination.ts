import { DurableObject } from 'cloudflare:workers';

import {
  COLLABORATION_WEBSOCKET_PROTOCOL,
  ClientMessageSchema,
  evaluateTextDraftUpsert,
  leaseAcquireVerdict,
  leaseForNode,
  leaseIdForActor,
  textDraftKey,
  type AcquireLeaseInput,
  type ClearCheckpointedDraftsInput,
  type CollaborationActor,
  type CollaborationSnapshot,
  type CommentDraft,
  ServerMessageSchema,
  type TextDraft,
  type UpsertCommentInput,
  type UpsertTextDraftInput,
} from '@mustbeviral/collaboration';

import {
  INTERNAL_IDENTITY_HEADER,
  decodeVerifiedIdentity,
  parseVerifiedIdentity,
  type VerifiedIdentity,
} from './identity';

const PRESENCE_STALE_MS = 60_000;
const ATTACHMENT_VERSION = 1;

type Surface = 'canvas' | 'review';

/**
 * Serialized onto each accepted socket so the bound identity survives hibernation. Nothing a client
 * sends can change `canvas_id` or `actor`; only the verified request that opened the socket sets them.
 */
interface SocketAttachment {
  readonly v: typeof ATTACHMENT_VERSION;
  readonly socket_id: string;
  readonly canvas_id: string;
  readonly actor: CollaborationActor;
  readonly surface: Surface | null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function encodeServerMessage(message: ReturnType<typeof ServerMessageSchema.parse>): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}

function readAttachment(socket: WebSocket): SocketAttachment | null {
  const raw = socket.deserializeAttachment() as unknown;
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Readonly<Record<string, unknown>>;
  const identity = parseVerifiedIdentity({ canvas_id: record.canvas_id, actor: record.actor });
  if (
    identity === null ||
    record.v !== ATTACHMENT_VERSION ||
    typeof record.socket_id !== 'string' ||
    (record.surface !== null && record.surface !== 'canvas' && record.surface !== 'review')
  ) {
    return null;
  }
  return {
    v: ATTACHMENT_VERSION,
    socket_id: record.socket_id,
    canvas_id: identity.canvas_id,
    actor: identity.actor,
    surface: record.surface,
  };
}

function unauthenticated(): Response {
  return Response.json(
    {
      error: { code: 'UNAUTHENTICATED', message: 'A verified collaboration identity is required.' },
    },
    { status: 401 },
  );
}

class OwnershipError extends Error {
  override readonly name = 'OwnershipError';
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
      const stored = this.ctx.storage.sql
        .exec<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', 'canvas_id')
        .toArray()[0];
      if (stored === undefined) {
        this.ctx.storage.sql.exec(
          'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
          'canvas_id',
          canvasId,
        );
        this.canvasId = canvasId;
        return;
      }
      this.canvasId = stored.value;
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

  // Every mutating method takes the acting identity as a separate, server-bound argument. Callers
  // pass the actor from the socket attachment, never from a client message.

  async joinPresence(
    canvasId: string,
    actor: CollaborationActor,
    surface: Surface,
  ): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const timestamp = nowIso();
    const payload = {
      actor,
      joined_at: timestamp,
      last_seen_at: timestamp,
      surface,
    };
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO presence (actor_id, payload) VALUES (?, ?)',
      actor.actor_id,
      JSON.stringify(payload),
    );
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  async leavePresence(canvasId: string, actor: CollaborationActor): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    this.ctx.storage.sql.exec('DELETE FROM presence WHERE actor_id = ?', actor.actor_id);
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  async upsertComment(
    canvasId: string,
    author: CollaborationActor,
    input: UpsertCommentInput,
  ): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const existing = this.ctx.storage.sql
      .exec<{ payload: string }>(
        'SELECT payload FROM comments WHERE comment_id = ? LIMIT 1',
        input.comment_id,
      )
      .toArray()[0];
    const existingComment = existing ? parseJson<CommentDraft>(existing.payload) : undefined;
    if (existingComment !== undefined && existingComment.author.actor_id !== author.actor_id) {
      throw new OwnershipError('Only the author can edit this comment');
    }
    const timestamp = nowIso();
    const draft: CommentDraft = {
      comment_id: input.comment_id,
      author,
      body: input.body,
      created_at: existingComment?.created_at ?? timestamp,
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

  private findTextDraftByField(nodeId: string, fieldPath: string): TextDraft | undefined {
    const rows = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM text_drafts')
      .toArray();
    for (const row of rows) {
      const draft = parseJson<TextDraft>(row.payload);
      if (draft.node_id === nodeId && draft.field_path === fieldPath) return draft;
    }
    return undefined;
  }

  async upsertTextDraft(
    canvasId: string,
    author: CollaborationActor,
    input: UpsertTextDraftInput,
  ): Promise<{
    accepted: boolean;
    reason: 'ok' | 'lease_held' | 'stale';
    snapshot: CollaborationSnapshot;
  }> {
    this.ensureCanvasId(canvasId);
    // The draft id is derived from the field it drafts. A client-chosen id could otherwise replace
    // another field's draft row, including one on a node leased by someone else.
    if (input.draft_id !== textDraftKey(input.node_id, input.field_path)) {
      throw new OwnershipError('draft_id must identify the drafted node field');
    }
    this.pruneExpiredLeases();
    const snapshot = await this.getSnapshot(canvasId);
    const lease = leaseForNode(snapshot.leases, input.node_id);
    const existing = this.findTextDraftByField(input.node_id, input.field_path);
    const timestamp = nowIso();
    const incoming: TextDraft = {
      draft_id: input.draft_id,
      node_id: input.node_id,
      field_path: input.field_path,
      body: input.body,
      author,
      updated_at: timestamp,
    };
    const verdict = evaluateTextDraftUpsert({
      incoming,
      existing,
      lease,
      actorId: author.actor_id,
    });
    if (verdict === 'rejected_lease') {
      return { accepted: false, reason: 'lease_held', snapshot };
    }
    if (verdict === 'rejected_stale') {
      return { accepted: false, reason: 'stale', snapshot };
    }
    if (existing !== undefined) {
      this.ctx.storage.sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', existing.draft_id);
    }
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO text_drafts (draft_id, payload) VALUES (?, ?)',
      input.draft_id,
      JSON.stringify(incoming),
    );
    await this.broadcastSnapshot();
    return { accepted: true, reason: 'ok', snapshot: await this.getSnapshot(canvasId) };
  }

  async acquireLease(
    canvasId: string,
    holder: CollaborationActor,
    input: AcquireLeaseInput,
  ): Promise<{ accepted: boolean; snapshot: CollaborationSnapshot }> {
    this.ensureCanvasId(canvasId);
    this.pruneExpiredLeases();
    const snapshot = await this.getSnapshot(canvasId);
    // Lease ids are derived from node and holder, so a client cannot write its lease under the id of
    // another actor's lease and replace that row.
    if (input.lease_id !== leaseIdForActor(input.node_id, holder.actor_id)) {
      return { accepted: false, snapshot };
    }
    const conflict = leaseForNode(snapshot.leases, input.node_id);
    const verdict = leaseAcquireVerdict({
      existing: conflict,
      holder,
    });
    if (verdict === 'contested') {
      return { accepted: false, snapshot };
    }
    if (conflict !== undefined) {
      this.ctx.storage.sql.exec('DELETE FROM leases WHERE lease_id = ?', conflict.lease_id);
    }
    const acquiredAt = nowIso();
    const expiresAt = new Date(Date.now() + input.ttl_seconds * 1_000).toISOString();
    const lease = {
      lease_id: input.lease_id,
      node_id: input.node_id,
      holder,
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

  async releaseLease(
    canvasId: string,
    holder: CollaborationActor,
    leaseId: string,
  ): Promise<CollaborationSnapshot> {
    this.ensureCanvasId(canvasId);
    const row = this.ctx.storage.sql
      .exec<{ payload: string }>('SELECT payload FROM leases WHERE lease_id = ? LIMIT 1', leaseId)
      .toArray()[0];
    if (row) {
      const lease = parseJson<CollaborationSnapshot['leases'][number]>(row.payload);
      if (lease.holder.actor_id === holder.actor_id) {
        this.ctx.storage.sql.exec('DELETE FROM leases WHERE lease_id = ?', leaseId);
      }
    }
    await this.broadcastSnapshot();
    return this.getSnapshot(canvasId);
  }

  /**
   * Clears drafts after a revision checkpoint. This object has no database access and cannot confirm
   * the checkpoint, so authorization is decided from the bound actor alone: an actor may clear its
   * own drafts and drafts on nodes no other actor currently leases. A checkpoint merges every
   * author's unleased drafts into one revision, so that client may clear them; a draft on a node
   * leased by someone else stays until its holder clears it or the lease expires.
   */
  async clearCheckpointedDrafts(
    canvasId: string,
    actor: CollaborationActor,
    input: ClearCheckpointedDraftsInput,
  ): Promise<{ cleared_draft_ids: readonly string[]; snapshot: CollaborationSnapshot }> {
    this.ensureCanvasId(canvasId);
    this.pruneExpiredLeases();
    const leases = (await this.getSnapshot(canvasId)).leases;
    const requested = new Set(input.draft_ids);
    const cleared: string[] = [];
    const rows = this.ctx.storage.sql
      .exec<{ draft_id: string; payload: string }>('SELECT draft_id, payload FROM text_drafts')
      .toArray();
    for (const row of rows) {
      if (!requested.has(row.draft_id)) continue;
      const draft = parseJson<TextDraft>(row.payload);
      const lease = leaseForNode(leases, draft.node_id);
      const ownDraft = draft.author.actor_id === actor.actor_id;
      const leasedByOther = lease !== undefined && lease.holder.actor_id !== actor.actor_id;
      if (!ownDraft && leasedByOther) continue;
      this.ctx.storage.sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', row.draft_id);
      cleared.push(row.draft_id);
    }
    await this.broadcastSnapshot();
    return { cleared_draft_ids: cleared, snapshot: await this.getSnapshot(canvasId) };
  }

  private async broadcastSnapshot(): Promise<void> {
    const snapshot = await this.getSnapshot(this.readCanvasId());
    const payload = encodeServerMessage({ type: 'snapshot', payload: snapshot });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(payload);
      } catch {
        try {
          socket.close(1011, 'broadcast failed');
        } catch {
          // Already closed.
        }
      }
    }
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const canvasId = url.searchParams.get('canvas_id');
    if (!canvasId) {
      return Response.json(
        { error: { code: 'VALIDATION_FAILED', message: 'canvas_id is required' } },
        { status: 400 },
      );
    }

    // Defense in depth: the Worker always sets this header after verifying a ticket. A request
    // without a well-formed identity for this exact canvas is refused.
    const identity = decodeVerifiedIdentity(request.headers.get(INTERNAL_IDENTITY_HEADER));
    if (identity === null || identity.canvas_id !== canvasId) {
      return unauthenticated();
    }

    const upgrade = request.headers.get('Upgrade') === 'websocket';
    if (url.pathname === '/ws' && upgrade) {
      return this.acceptSocket(identity);
    }

    if (url.pathname === '/snapshot' && request.method === 'GET' && !upgrade) {
      return Response.json({ data: await this.getSnapshot(canvasId) });
    }

    return new Response('Not Found', { status: 404 });
  }

  private async acceptSocket(identity: VerifiedIdentity): Promise<Response> {
    const snapshot = await this.getSnapshot(identity.canvas_id);
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    const attachment: SocketAttachment = {
      v: ATTACHMENT_VERSION,
      socket_id: crypto.randomUUID(),
      canvas_id: identity.canvas_id,
      actor: identity.actor,
      surface: null,
    };
    server.serializeAttachment(attachment);
    server.send(encodeServerMessage({ type: 'snapshot', payload: snapshot }));
    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: { 'Sec-WebSocket-Protocol': COLLABORATION_WEBSOCKET_PROTOCOL },
    });
  }

  override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment === null) {
      socket.close(1008, 'collaboration identity unavailable');
      return;
    }
    await this.handleSocketMessage(socket, attachment, message);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) await this.releasePresenceFor(attachment);
    try {
      socket.close(1000, 'closed');
    } catch {
      // The runtime may already have completed the close handshake.
    }
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    const attachment = readAttachment(socket);
    if (attachment !== null) await this.releasePresenceFor(attachment);
  }

  /**
   * Removes the socket's bound actor from presence unless another socket of the same actor still
   * holds a presence join, in which case that socket's surface is kept. Other actors are untouched.
   */
  private async releasePresenceFor(attachment: SocketAttachment): Promise<void> {
    const remaining = this.ctx
      .getWebSockets()
      .map((candidate) => readAttachment(candidate))
      .find(
        (candidate) =>
          candidate !== null &&
          candidate.socket_id !== attachment.socket_id &&
          candidate.actor.actor_id === attachment.actor.actor_id &&
          candidate.surface !== null,
      );
    if (remaining?.surface) {
      await this.joinPresence(attachment.canvas_id, remaining.actor, remaining.surface);
      return;
    }
    await this.leavePresence(attachment.canvas_id, attachment.actor);
  }

  private async handleSocketMessage(
    socket: WebSocket,
    attachment: SocketAttachment,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const canvasId = attachment.canvas_id;
    const actor = attachment.actor;
    try {
      const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
      // The schema strips any identity fields a client sends. Every handler below acts as `actor`,
      // the identity bound when the socket was accepted.
      const parsed = ClientMessageSchema.parse(JSON.parse(text));
      if (parsed.type === 'presence.join') {
        socket.serializeAttachment({ ...attachment, surface: parsed.payload.surface });
        await this.joinPresence(canvasId, actor, parsed.payload.surface);
        return;
      }
      if (parsed.type === 'presence.leave') {
        socket.serializeAttachment({ ...attachment, surface: null });
        await this.releasePresenceFor(attachment);
        return;
      }
      if (parsed.type === 'comment.upsert') {
        await this.upsertComment(canvasId, actor, parsed.payload);
        return;
      }
      if (parsed.type === 'text.draft.upsert') {
        const result = await this.upsertTextDraft(canvasId, actor, parsed.payload);
        socket.send(
          encodeServerMessage({
            type: 'text.draft.result',
            payload: {
              accepted: result.accepted,
              draft_id: parsed.payload.draft_id,
              node_id: parsed.payload.node_id,
              field_path: parsed.payload.field_path,
              reason: result.reason,
            },
          }),
        );
        return;
      }
      if (parsed.type === 'lease.acquire') {
        const result = await this.acquireLease(canvasId, actor, parsed.payload);
        socket.send(
          encodeServerMessage({
            type: 'lease.result',
            payload: {
              accepted: result.accepted,
              lease_id: parsed.payload.lease_id,
              node_id: parsed.payload.node_id,
            },
          }),
        );
        return;
      }
      if (parsed.type === 'lease.release') {
        await this.releaseLease(canvasId, actor, parsed.payload.lease_id);
        return;
      }
      if (parsed.type === 'text.draft.clear') {
        const result = await this.clearCheckpointedDrafts(canvasId, actor, parsed.payload);
        socket.send(
          encodeServerMessage({
            type: 'text.draft.clear.result',
            payload: {
              cleared_draft_ids: [...result.cleared_draft_ids],
              revision_id: parsed.payload.revision_id,
            },
          }),
        );
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
          payload:
            error instanceof OwnershipError
              ? { code: 'FORBIDDEN', message: error.message }
              : { code: 'VALIDATION_FAILED', message: 'Invalid collaboration message' },
        }),
      );
    }
  }
}

export { CanvasCoordination as default };
