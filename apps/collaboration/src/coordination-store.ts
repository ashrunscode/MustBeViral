import {
  compareTextDrafts,
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
  type EditLease,
  type TextDraft,
  type UpsertCommentInput,
  type UpsertTextDraftInput,
} from '@mustbeviral/collaboration';

const PRESENCE_STALE_MS = 60_000;

export type Surface = 'canvas' | 'review';

/** Raised when a client tries to write a row that belongs to another actor or another key. */
export class OwnershipError extends Error {
  override readonly name = 'OwnershipError';
}

function nowIso(): string {
  return new Date().toISOString();
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

/**
 * Draft collaboration state for one canvas, kept in the Durable Object's SQLite storage.
 *
 * This is deliberately not the Durable Object class: every method here changes or reads canvas
 * state, and the object exposes only its fetch and WebSocket handlers, so none of these methods is
 * reachable over Durable Object RPC. Every mutating method takes the acting identity as its own
 * argument; the object passes the actor bound to the socket, never a value from a client message.
 */
export class CoordinationStore {
  readonly #sql: SqlStorage;
  #canvasId: string | null = null;

  constructor(sql: SqlStorage) {
    this.#sql = sql;
    this.#sql.exec(`
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
    this.#sql.exec(`
      CREATE TABLE IF NOT EXISTS presence (
        actor_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      )
    `);
    this.#sql.exec(`
      CREATE TABLE IF NOT EXISTS comments (
        comment_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      )
    `);
    this.#sql.exec(`
      CREATE TABLE IF NOT EXISTS text_drafts (
        draft_id TEXT PRIMARY KEY,
        payload TEXT NOT NULL
      )
    `);
    this.#sql.exec(`
      CREATE TABLE IF NOT EXISTS leases (
        lease_id TEXT PRIMARY KEY,
        node_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        expires_at TEXT NOT NULL
      )
    `);
  }

  ensureCanvasId(canvasId: string): void {
    if (this.#canvasId === null) {
      const stored = this.#sql
        .exec<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', 'canvas_id')
        .toArray()[0];
      if (stored === undefined) {
        this.#sql.exec(
          'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
          'canvas_id',
          canvasId,
        );
        this.#canvasId = canvasId;
        return;
      }
      this.#canvasId = stored.value;
    }
    if (this.#canvasId !== canvasId) {
      throw new Error('Canvas coordination object is bound to a different canvas');
    }
  }

  readCanvasId(): string {
    if (this.#canvasId !== null) return this.#canvasId;
    const row = this.#sql
      .exec<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', 'canvas_id')
      .toArray()[0];
    if (!row) throw new Error('Canvas coordination object is not initialized');
    this.#canvasId = row.value;
    return row.value;
  }

  #pruneExpiredLeases(now = nowIso()): void {
    this.#sql.exec('DELETE FROM leases WHERE expires_at <= ?', now);
  }

  #pruneStalePresence(nowMs = Date.now()): void {
    const rows = this.#sql
      .exec<{ actor_id: string; payload: string }>('SELECT actor_id, payload FROM presence')
      .toArray();
    for (const row of rows) {
      const entry = parseJson<{ last_seen_at: string }>(row.payload);
      const lastSeenMs = Date.parse(entry.last_seen_at);
      if (Number.isNaN(lastSeenMs) || nowMs - lastSeenMs > PRESENCE_STALE_MS) {
        this.#sql.exec('DELETE FROM presence WHERE actor_id = ?', row.actor_id);
      }
    }
  }

  getSnapshot(canvasId: string): CollaborationSnapshot {
    this.ensureCanvasId(canvasId);
    this.#pruneExpiredLeases();
    this.#pruneStalePresence();
    const presence = this.#sql
      .exec<{ payload: string }>('SELECT payload FROM presence')
      .toArray()
      .map((row) => parseJson<CollaborationSnapshot['presence'][number]>(row.payload));
    const comments = this.#sql
      .exec<{ payload: string }>('SELECT payload FROM comments')
      .toArray()
      .map((row) => parseJson<CommentDraft>(row.payload));
    const textDrafts = this.#sql
      .exec<{ payload: string }>('SELECT payload FROM text_drafts')
      .toArray()
      .map((row) => parseJson<TextDraft>(row.payload));
    const leases = this.#sql
      .exec<{ payload: string }>('SELECT payload FROM leases')
      .toArray()
      .map((row) => parseJson<EditLease>(row.payload));
    return {
      canvas_id: this.readCanvasId(),
      presence,
      comments,
      text_drafts: textDrafts,
      leases,
    };
  }

  joinPresence(canvasId: string, actor: CollaborationActor, surface: Surface): void {
    this.ensureCanvasId(canvasId);
    const timestamp = nowIso();
    this.#sql.exec(
      'INSERT OR REPLACE INTO presence (actor_id, payload) VALUES (?, ?)',
      actor.actor_id,
      JSON.stringify({ actor, joined_at: timestamp, last_seen_at: timestamp, surface }),
    );
  }

  leavePresence(canvasId: string, actor: CollaborationActor): void {
    this.ensureCanvasId(canvasId);
    this.#sql.exec('DELETE FROM presence WHERE actor_id = ?', actor.actor_id);
  }

  upsertComment(canvasId: string, author: CollaborationActor, input: UpsertCommentInput): void {
    this.ensureCanvasId(canvasId);
    const existing = this.#sql
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
    this.#sql.exec(
      'INSERT OR REPLACE INTO comments (comment_id, payload) VALUES (?, ?)',
      input.comment_id,
      JSON.stringify(draft),
    );
  }

  #draftRows(): { draft_id: string; draft: TextDraft }[] {
    return this.#sql
      .exec<{ draft_id: string; payload: string }>('SELECT draft_id, payload FROM text_drafts')
      .toArray()
      .map((row) => ({ draft_id: row.draft_id, draft: parseJson<TextDraft>(row.payload) }));
  }

  upsertTextDraft(
    canvasId: string,
    author: CollaborationActor,
    input: UpsertTextDraftInput,
  ): { accepted: boolean; reason: 'ok' | 'lease_held' | 'stale' } {
    this.ensureCanvasId(canvasId);
    // Draft identity is the (node_id, field_path) pair. textDraftKey encodes that pair injectively,
    // so a client-chosen id can never name another node's row, whatever the ids contain.
    if (input.draft_id !== textDraftKey(input.node_id, input.field_path)) {
      throw new OwnershipError('draft_id must identify the drafted node field');
    }
    this.#pruneExpiredLeases();
    const rows = this.#draftRows();
    // Defense in depth for rows stored under an earlier key format: never replace a row whose
    // stored node and field differ from the ones this write targets.
    const sameKey = rows.find((row) => row.draft_id === input.draft_id);
    if (
      sameKey !== undefined &&
      (sameKey.draft.node_id !== input.node_id || sameKey.draft.field_path !== input.field_path)
    ) {
      throw new OwnershipError('draft_id already identifies a different node field');
    }
    const leases = this.getSnapshot(canvasId).leases;
    // Leases are checked against the real node id, never a node inferred from the key.
    const lease = leaseForNode(leases, input.node_id);
    const fieldRows = rows.filter(
      (row) => row.draft.node_id === input.node_id && row.draft.field_path === input.field_path,
    );
    const existing = fieldRows.reduce<(typeof fieldRows)[number] | undefined>(
      (latest, row) =>
        latest === undefined || compareTextDrafts(row.draft, latest.draft) > 0 ? row : latest,
      undefined,
    );
    const incoming: TextDraft = {
      draft_id: input.draft_id,
      node_id: input.node_id,
      field_path: input.field_path,
      body: input.body,
      author,
      updated_at: nowIso(),
    };
    const verdict = evaluateTextDraftUpsert({
      incoming,
      existing: existing?.draft,
      lease,
      actorId: author.actor_id,
    });
    if (verdict === 'rejected_lease') return { accepted: false, reason: 'lease_held' };
    if (verdict === 'rejected_stale') return { accepted: false, reason: 'stale' };
    // Deletes every row for this field by its stored id, so a row written under an earlier key
    // format is replaced rather than duplicated.
    for (const row of fieldRows) {
      this.#sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', row.draft_id);
    }
    this.#sql.exec(
      'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
      input.draft_id,
      JSON.stringify(incoming),
    );
    return { accepted: true, reason: 'ok' };
  }

  acquireLease(canvasId: string, holder: CollaborationActor, input: AcquireLeaseInput): boolean {
    this.ensureCanvasId(canvasId);
    this.#pruneExpiredLeases();
    // Lease ids are derived from node and holder, so a client cannot choose another actor's id.
    if (input.lease_id !== leaseIdForActor(input.node_id, holder.actor_id)) return false;
    const leases = this.getSnapshot(canvasId).leases;
    // The derived id is a joined string; refuse any id already stored for a different node or
    // holder rather than replacing that row.
    const sameId = leases.find((lease) => lease.lease_id === input.lease_id);
    if (
      sameId !== undefined &&
      (sameId.node_id !== input.node_id || sameId.holder.actor_id !== holder.actor_id)
    ) {
      return false;
    }
    const conflict = leaseForNode(leases, input.node_id);
    if (leaseAcquireVerdict({ existing: conflict, holder }) === 'contested') return false;
    if (conflict !== undefined) {
      this.#sql.exec('DELETE FROM leases WHERE lease_id = ?', conflict.lease_id);
    }
    const expiresAt = new Date(Date.now() + input.ttl_seconds * 1_000).toISOString();
    const lease: EditLease = {
      lease_id: input.lease_id,
      node_id: input.node_id,
      holder,
      acquired_at: nowIso(),
      expires_at: expiresAt,
    };
    this.#sql.exec(
      'INSERT OR REPLACE INTO leases (lease_id, node_id, payload, expires_at) VALUES (?, ?, ?, ?)',
      input.lease_id,
      input.node_id,
      JSON.stringify(lease),
      expiresAt,
    );
    return true;
  }

  releaseLease(canvasId: string, holder: CollaborationActor, leaseId: string): void {
    this.ensureCanvasId(canvasId);
    const row = this.#sql
      .exec<{ payload: string }>('SELECT payload FROM leases WHERE lease_id = ? LIMIT 1', leaseId)
      .toArray()[0];
    if (row && parseJson<EditLease>(row.payload).holder.actor_id === holder.actor_id) {
      this.#sql.exec('DELETE FROM leases WHERE lease_id = ?', leaseId);
    }
  }

  /**
   * Clears drafts after a revision checkpoint. This object has no database access and cannot confirm
   * the checkpoint, so authorization is decided from the bound actor alone: an actor may clear its
   * own drafts and drafts on nodes no other actor currently leases. A checkpoint merges every
   * author's unleased drafts into one revision, so that client may clear them; a draft on a node
   * leased by someone else stays until its holder clears it or the lease expires. Leases are checked
   * against each stored draft's real node id.
   */
  clearCheckpointedDrafts(
    canvasId: string,
    actor: CollaborationActor,
    input: ClearCheckpointedDraftsInput,
  ): readonly string[] {
    this.ensureCanvasId(canvasId);
    const leases = this.getSnapshot(canvasId).leases;
    const requested = new Set(input.draft_ids);
    const cleared: string[] = [];
    for (const row of this.#draftRows()) {
      if (!requested.has(row.draft_id)) continue;
      const lease = leaseForNode(leases, row.draft.node_id);
      const ownDraft = row.draft.author.actor_id === actor.actor_id;
      const leasedByOther = lease !== undefined && lease.holder.actor_id !== actor.actor_id;
      if (!ownDraft && leasedByOther) continue;
      this.#sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', row.draft_id);
      cleared.push(row.draft_id);
    }
    return cleared;
  }
}
