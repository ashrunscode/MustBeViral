import {
  COLLABORATION_COMMENTS_MAX_BYTES,
  COLLABORATION_COMMENTS_MAX_PER_ACTOR,
  COLLABORATION_COMMENTS_MAX_PER_CANVAS,
  COLLABORATION_LEASES_MAX_BYTES,
  COLLABORATION_LEASES_MAX_PER_ACTOR,
  COLLABORATION_LEASES_MAX_PER_CANVAS,
  COLLABORATION_PRESENCE_MAX_BYTES,
  COLLABORATION_PRESENCE_MAX_PER_CANVAS,
  COLLABORATION_TEXT_DRAFTS_MAX_BYTES,
  COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR,
  COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS,
  CommentDraftSchema,
  EditLeaseSchema,
  PresenceEntrySchema,
  TextDraftSchema,
  compareTextDrafts,
  evaluateTextDraftUpsert,
  leaseAcquireVerdict,
  leaseForNode,
  leaseIdForActor,
  legacyLeaseIdForActor,
  textDraftKey,
  utf8ByteLength,
  type AcquireLeaseInput,
  type ClearCheckpointedDraftsInput,
  type CollaborationActor,
  type CollaborationLimitedResource,
  type CollaborationSnapshot,
  type CommentDraft,
  type CreateCommentInput,
  type DeleteCommentInput,
  type EditLease,
  type PresenceEntry,
  type ReleaseLeaseInput,
  type TextDraft,
  type UpdateCommentInput,
  type UpsertTextDraftInput,
} from '@mustbeviral/collaboration';

const PRESENCE_STALE_MS = 60_000;
/** Version 2 introduced size limits, row caps and injective lease ids. */
export const COORDINATION_SCHEMA_VERSION = 2;

export type Surface = 'canvas' | 'review';

/** Raised when a client tries to write a row that belongs to another actor or another key. */
export class OwnershipError extends Error {
  override readonly name = 'OwnershipError';
}

/** Raised when a client names a row that does not exist. */
export class NotFoundError extends Error {
  override readonly name = 'NotFoundError';
}

export interface CanvasLimit {
  readonly resource: CollaborationLimitedResource;
  readonly scope: 'canvas' | 'actor';
  readonly unit: 'rows' | 'bytes';
  readonly limit: number;
}

/** Raised when a write would take a canvas section past a row cap or byte budget. */
export class CanvasLimitError extends Error {
  override readonly name = 'CanvasLimitError';
  readonly limit: CanvasLimit;

  constructor(limit: CanvasLimit) {
    super(
      limit.unit === 'rows'
        ? `The ${limit.scope} limit of ${String(limit.limit)} ${limit.resource.replace('_', ' ')} is reached.`
        : `The ${limit.resource.replace('_', ' ')} on this canvas are at their ${String(limit.limit)}-byte limit.`,
    );
    this.limit = limit;
  }
}

export type TextDraftUpsertResult =
  | Readonly<{ accepted: true; reason: 'ok' }>
  | Readonly<{ accepted: false; reason: 'lease_held' | 'stale' }>
  | Readonly<{ accepted: false; reason: 'limit_reached'; limit: CanvasLimit }>;

export type LeaseAcquireResult =
  | Readonly<{ accepted: true; lease_id: string; reason: 'ok' }>
  | Readonly<{ accepted: false; lease_id: string; reason: 'contested' | 'invalid_lease_id' }>
  | Readonly<{ accepted: false; lease_id: string; reason: 'limit_reached'; limit: CanvasLimit }>;

function nowIso(): string {
  return new Date().toISOString();
}

interface StoredRow<T> {
  readonly key: string;
  readonly value: T;
  readonly bytes: number;
}

function sumBytes(rows: readonly StoredRow<unknown>[]): number {
  return rows.reduce((total, row) => total + row.bytes, 0);
}

/** Checks one section's canvas row cap, per-actor row cap and byte budget after a write. */
function assertWithinLimits(input: {
  readonly resource: CollaborationLimitedResource;
  readonly rowsAfter: number;
  readonly canvasRowCap: number;
  readonly actorRowsAfter?: number;
  readonly actorRowCap?: number;
  readonly bytesAfter: number;
  readonly byteBudget: number;
}): void {
  if (input.rowsAfter > input.canvasRowCap) {
    throw new CanvasLimitError({
      resource: input.resource,
      scope: 'canvas',
      unit: 'rows',
      limit: input.canvasRowCap,
    });
  }
  if (
    input.actorRowsAfter !== undefined &&
    input.actorRowCap !== undefined &&
    input.actorRowsAfter > input.actorRowCap
  ) {
    throw new CanvasLimitError({
      resource: input.resource,
      scope: 'actor',
      unit: 'rows',
      limit: input.actorRowCap,
    });
  }
  if (input.bytesAfter > input.byteBudget) {
    throw new CanvasLimitError({
      resource: input.resource,
      scope: 'canvas',
      unit: 'bytes',
      limit: input.byteBudget,
    });
  }
}

/**
 * Draft collaboration state for one canvas, kept in the Durable Object's SQLite storage.
 *
 * This is deliberately not the Durable Object class: every method here changes or reads canvas
 * state, and the object exposes only its fetch, alarm and WebSocket handlers, so none of these
 * methods is reachable over Durable Object RPC. Every mutating method takes the acting identity as
 * its own argument; the object passes the actor bound to the socket, never a value from a client
 * message.
 *
 * Every section of the snapshot has a row cap and a byte budget (see `limits.ts`). Writes that would
 * exceed either are refused with `CanvasLimitError`, so the snapshot stays under its ceiling.
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
    this.#migrate();
  }

  /**
   * Brings state written before version 2 within the current limits, once. Collaboration state is a
   * recoverable draft, never authority (revisions live in Postgres), so rows that no client could
   * write today are dropped rather than served: rows that fail the current row schema, and the
   * least recently updated rows of any section over its caps. Leases stored under the ambiguous
   * joined id are dropped; they last at most 15 minutes and the deploy already closed their sockets.
   */
  #migrate(): void {
    const stored = this.#sql
      .exec<{ value: string }>('SELECT value FROM meta WHERE key = ? LIMIT 1', 'schema_version')
      .toArray()[0];
    if (stored !== undefined && Number(stored.value) >= COORDINATION_SCHEMA_VERSION) return;

    const dropped = { comments: 0, text_drafts: 0, leases: 0, presence: 0 };
    dropped.leases = this.#sql
      .exec<{ lease_id: string }>('SELECT lease_id FROM leases')
      .toArray().length;
    this.#sql.exec('DELETE FROM leases');

    const trim = <T>(
      table: 'comments' | 'text_drafts' | 'presence',
      keyColumn: string,
      schema: { safeParse(value: unknown): { success: boolean; data?: T } },
      recency: (value: T) => number,
      actorOf: (value: T) => string,
      caps: Readonly<{ canvas: number; actor: number; bytes: number }>,
    ): number => {
      const rows = this.#sql
        .exec<Record<string, string>>(`SELECT ${keyColumn} AS key, payload FROM ${table}`)
        .toArray();
      const valid: StoredRow<T>[] = [];
      let removed = 0;
      for (const row of rows) {
        let parsed: { success: boolean; data?: T };
        try {
          parsed = schema.safeParse(JSON.parse(String(row.payload)));
        } catch {
          parsed = { success: false };
        }
        if (parsed.success && parsed.data !== undefined) {
          valid.push({
            key: String(row.key),
            value: parsed.data,
            bytes: utf8ByteLength(String(row.payload)),
          });
        } else {
          this.#sql.exec(`DELETE FROM ${table} WHERE ${keyColumn} = ?`, String(row.key));
          removed += 1;
        }
      }
      valid.sort((left, right) => recency(right.value) - recency(left.value));
      let kept = 0;
      let bytes = 0;
      const perActor = new Map<string, number>();
      for (const row of valid) {
        const actorId = actorOf(row.value);
        const actorRows = perActor.get(actorId) ?? 0;
        if (kept < caps.canvas && actorRows < caps.actor && bytes + row.bytes <= caps.bytes) {
          kept += 1;
          bytes += row.bytes;
          perActor.set(actorId, actorRows + 1);
        } else {
          this.#sql.exec(`DELETE FROM ${table} WHERE ${keyColumn} = ?`, row.key);
          removed += 1;
        }
      }
      return removed;
    };

    dropped.comments = trim<CommentDraft>(
      'comments',
      'comment_id',
      CommentDraftSchema,
      (comment) => Date.parse(comment.updated_at),
      (comment) => comment.author.actor_id,
      {
        canvas: COLLABORATION_COMMENTS_MAX_PER_CANVAS,
        actor: COLLABORATION_COMMENTS_MAX_PER_ACTOR,
        bytes: COLLABORATION_COMMENTS_MAX_BYTES,
      },
    );
    dropped.text_drafts = trim<TextDraft>(
      'text_drafts',
      'draft_id',
      TextDraftSchema,
      (draft) => Date.parse(draft.updated_at),
      (draft) => draft.author.actor_id,
      {
        canvas: COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS,
        actor: COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR,
        bytes: COLLABORATION_TEXT_DRAFTS_MAX_BYTES,
      },
    );
    dropped.presence = trim<PresenceEntry>(
      'presence',
      'actor_id',
      PresenceEntrySchema,
      (entry) => Date.parse(entry.last_seen_at),
      (entry) => entry.actor.actor_id,
      {
        canvas: COLLABORATION_PRESENCE_MAX_PER_CANVAS,
        actor: 1,
        bytes: COLLABORATION_PRESENCE_MAX_BYTES,
      },
    );

    this.#sql.exec(
      'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
      'schema_version',
      String(COORDINATION_SCHEMA_VERSION),
    );
    if (Object.values(dropped).some((count) => count > 0)) {
      // Counts only: never ids, names or content.
      console.log(
        JSON.stringify({
          level: 'info',
          event: 'collaboration.state_migrated',
          schema_version: COORDINATION_SCHEMA_VERSION,
          dropped,
        }),
      );
    }
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
    for (const row of this.#presenceRows()) {
      const lastSeenMs = Date.parse(row.value.last_seen_at);
      if (Number.isNaN(lastSeenMs) || nowMs - lastSeenMs > PRESENCE_STALE_MS) {
        this.#sql.exec('DELETE FROM presence WHERE actor_id = ?', row.key);
      }
    }
  }

  #rows<T>(query: string): StoredRow<T>[] {
    return this.#sql
      .exec<{ key: string; payload: string }>(query)
      .toArray()
      .map((row) => ({
        key: row.key,
        value: JSON.parse(row.payload) as T,
        bytes: utf8ByteLength(row.payload),
      }));
  }

  #presenceRows(): StoredRow<PresenceEntry>[] {
    return this.#rows('SELECT actor_id AS key, payload FROM presence');
  }

  #commentRows(): StoredRow<CommentDraft>[] {
    return this.#rows('SELECT comment_id AS key, payload FROM comments');
  }

  #draftRows(): StoredRow<TextDraft>[] {
    return this.#rows('SELECT draft_id AS key, payload FROM text_drafts');
  }

  #leaseRows(): StoredRow<EditLease>[] {
    return this.#rows('SELECT lease_id AS key, payload FROM leases');
  }

  getSnapshot(canvasId: string): CollaborationSnapshot {
    this.ensureCanvasId(canvasId);
    this.#pruneExpiredLeases();
    this.#pruneStalePresence();
    return {
      canvas_id: this.readCanvasId(),
      presence: this.#presenceRows().map((row) => row.value),
      comments: this.#commentRows().map((row) => row.value),
      text_drafts: this.#draftRows().map((row) => row.value),
      leases: this.#leaseRows().map((row) => row.value),
    };
  }

  joinPresence(canvasId: string, actor: CollaborationActor, surface: Surface): void {
    this.ensureCanvasId(canvasId);
    this.#pruneStalePresence();
    const rows = this.#presenceRows();
    const existing = rows.find((row) => row.key === actor.actor_id);
    const timestamp = nowIso();
    const payload = JSON.stringify(
      PresenceEntrySchema.parse({ actor, joined_at: timestamp, last_seen_at: timestamp, surface }),
    );
    assertWithinLimits({
      resource: 'presence',
      rowsAfter: rows.length + (existing === undefined ? 1 : 0),
      canvasRowCap: COLLABORATION_PRESENCE_MAX_PER_CANVAS,
      bytesAfter: sumBytes(rows) - (existing?.bytes ?? 0) + utf8ByteLength(payload),
      byteBudget: COLLABORATION_PRESENCE_MAX_BYTES,
    });
    this.#sql.exec(
      'INSERT OR REPLACE INTO presence (actor_id, payload) VALUES (?, ?)',
      actor.actor_id,
      payload,
    );
  }

  leavePresence(canvasId: string, actor: CollaborationActor): void {
    this.ensureCanvasId(canvasId);
    this.#sql.exec('DELETE FROM presence WHERE actor_id = ?', actor.actor_id);
  }

  /**
   * Creates a comment under a server-generated id. Nothing a client sends becomes the id, so a
   * member can neither predict nor squat another member's comment.
   */
  createComment(
    canvasId: string,
    author: CollaborationActor,
    input: Pick<CreateCommentInput, 'body' | 'anchor_node_id'>,
  ): CommentDraft {
    this.ensureCanvasId(canvasId);
    const rows = this.#commentRows();
    const timestamp = nowIso();
    const comment = CommentDraftSchema.parse({
      comment_id: crypto.randomUUID(),
      author,
      body: input.body,
      created_at: timestamp,
      updated_at: timestamp,
      ...(input.anchor_node_id === undefined ? {} : { anchor_node_id: input.anchor_node_id }),
    });
    const payload = JSON.stringify(comment);
    assertWithinLimits({
      resource: 'comments',
      rowsAfter: rows.length + 1,
      canvasRowCap: COLLABORATION_COMMENTS_MAX_PER_CANVAS,
      actorRowsAfter:
        rows.filter((row) => row.value.author.actor_id === author.actor_id).length + 1,
      actorRowCap: COLLABORATION_COMMENTS_MAX_PER_ACTOR,
      bytesAfter: sumBytes(rows) + utf8ByteLength(payload),
      byteBudget: COLLABORATION_COMMENTS_MAX_BYTES,
    });
    // A plain INSERT: a duplicate id fails instead of replacing a row.
    this.#sql.exec(
      'INSERT INTO comments (comment_id, payload) VALUES (?, ?)',
      comment.comment_id,
      payload,
    );
    return comment;
  }

  #ownComment(
    rows: readonly StoredRow<CommentDraft>[],
    actor: CollaborationActor,
    commentId: string,
  ): StoredRow<CommentDraft> {
    const row = rows.find((candidate) => candidate.key === commentId);
    if (row === undefined) throw new NotFoundError('Comment not found');
    if (row.value.author.actor_id !== actor.actor_id) {
      throw new OwnershipError('Only the author can change this comment');
    }
    return row;
  }

  /** Changes the body of one of the actor's own comments. */
  updateComment(
    canvasId: string,
    actor: CollaborationActor,
    input: Pick<UpdateCommentInput, 'comment_id' | 'body'>,
  ): CommentDraft {
    this.ensureCanvasId(canvasId);
    const rows = this.#commentRows();
    const row = this.#ownComment(rows, actor, input.comment_id);
    const comment = CommentDraftSchema.parse({
      ...row.value,
      body: input.body,
      updated_at: nowIso(),
    });
    const payload = JSON.stringify(comment);
    assertWithinLimits({
      resource: 'comments',
      rowsAfter: rows.length,
      canvasRowCap: COLLABORATION_COMMENTS_MAX_PER_CANVAS,
      bytesAfter: sumBytes(rows) - row.bytes + utf8ByteLength(payload),
      byteBudget: COLLABORATION_COMMENTS_MAX_BYTES,
    });
    this.#sql.exec('UPDATE comments SET payload = ? WHERE comment_id = ?', payload, row.key);
    return comment;
  }

  /** Deletes one of the actor's own comments. */
  deleteComment(
    canvasId: string,
    actor: CollaborationActor,
    input: Pick<DeleteCommentInput, 'comment_id'>,
  ): void {
    this.ensureCanvasId(canvasId);
    const row = this.#ownComment(this.#commentRows(), actor, input.comment_id);
    this.#sql.exec('DELETE FROM comments WHERE comment_id = ?', row.key);
  }

  upsertTextDraft(
    canvasId: string,
    author: CollaborationActor,
    input: UpsertTextDraftInput,
  ): TextDraftUpsertResult {
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
    const sameKey = rows.find((row) => row.key === input.draft_id);
    if (
      sameKey !== undefined &&
      (sameKey.value.node_id !== input.node_id || sameKey.value.field_path !== input.field_path)
    ) {
      throw new OwnershipError('draft_id already identifies a different node field');
    }
    // Leases are checked against the real node id, never a node inferred from the key.
    const lease = leaseForNode(
      this.#leaseRows().map((row) => row.value),
      input.node_id,
    );
    const fieldRows = rows.filter(
      (row) => row.value.node_id === input.node_id && row.value.field_path === input.field_path,
    );
    const existing = fieldRows.reduce<(typeof fieldRows)[number] | undefined>(
      (latest, row) =>
        latest === undefined || compareTextDrafts(row.value, latest.value) > 0 ? row : latest,
      undefined,
    );
    const incoming = TextDraftSchema.parse({
      draft_id: input.draft_id,
      node_id: input.node_id,
      field_path: input.field_path,
      body: input.body,
      author,
      updated_at: nowIso(),
    });
    const verdict = evaluateTextDraftUpsert({
      incoming,
      existing: existing?.value,
      lease,
      actorId: author.actor_id,
    });
    if (verdict === 'rejected_lease') return { accepted: false, reason: 'lease_held' };
    if (verdict === 'rejected_stale') return { accepted: false, reason: 'stale' };
    const payload = JSON.stringify(incoming);
    const replacedKeys = new Set(fieldRows.map((row) => row.key));
    const remaining = rows.filter((row) => !replacedKeys.has(row.key));
    try {
      assertWithinLimits({
        resource: 'text_drafts',
        rowsAfter: remaining.length + 1,
        canvasRowCap: COLLABORATION_TEXT_DRAFTS_MAX_PER_CANVAS,
        actorRowsAfter:
          remaining.filter((row) => row.value.author.actor_id === author.actor_id).length + 1,
        actorRowCap: COLLABORATION_TEXT_DRAFTS_MAX_PER_ACTOR,
        bytesAfter: sumBytes(remaining) + utf8ByteLength(payload),
        byteBudget: COLLABORATION_TEXT_DRAFTS_MAX_BYTES,
      });
    } catch (error) {
      if (error instanceof CanvasLimitError) {
        return { accepted: false, reason: 'limit_reached', limit: error.limit };
      }
      throw error;
    }
    // Deletes every row for this field by its stored id, so a row written under an earlier key
    // format is replaced rather than duplicated.
    for (const key of replacedKeys) {
      this.#sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', key);
    }
    this.#sql.exec(
      'INSERT INTO text_drafts (draft_id, payload) VALUES (?, ?)',
      input.draft_id,
      payload,
    );
    return { accepted: true, reason: 'ok' };
  }

  /**
   * Leases one node to the bound actor. The stored id is always `leaseIdForActor(node, actor)`,
   * derived here; it is injective, so no other node or actor can produce it. A client-sent id is
   * accepted only as a check: it must be that id or the legacy joined id for the same node and actor.
   */
  acquireLease(
    canvasId: string,
    holder: CollaborationActor,
    input: AcquireLeaseInput,
  ): LeaseAcquireResult {
    this.ensureCanvasId(canvasId);
    this.#pruneExpiredLeases();
    const leaseId = leaseIdForActor(input.node_id, holder.actor_id);
    if (
      input.lease_id !== undefined &&
      input.lease_id !== leaseId &&
      input.lease_id !== legacyLeaseIdForActor(input.node_id, holder.actor_id)
    ) {
      return { accepted: false, lease_id: leaseId, reason: 'invalid_lease_id' };
    }
    const rows = this.#leaseRows();
    const nodeRows = rows.filter((row) => row.value.node_id === input.node_id);
    if (
      nodeRows.some((row) => row.value.holder.actor_id !== holder.actor_id) ||
      leaseAcquireVerdict({
        existing: leaseForNode(
          nodeRows.map((row) => row.value),
          input.node_id,
        ),
        holder,
      }) === 'contested'
    ) {
      return { accepted: false, lease_id: leaseId, reason: 'contested' };
    }
    const expiresAt = new Date(Date.now() + input.ttl_seconds * 1_000).toISOString();
    const lease = EditLeaseSchema.parse({
      lease_id: leaseId,
      node_id: input.node_id,
      holder,
      acquired_at: nowIso(),
      expires_at: expiresAt,
    });
    const payload = JSON.stringify(lease);
    const remaining = rows.filter((row) => row.value.node_id !== input.node_id);
    try {
      assertWithinLimits({
        resource: 'leases',
        rowsAfter: remaining.length + 1,
        canvasRowCap: COLLABORATION_LEASES_MAX_PER_CANVAS,
        actorRowsAfter:
          remaining.filter((row) => row.value.holder.actor_id === holder.actor_id).length + 1,
        actorRowCap: COLLABORATION_LEASES_MAX_PER_ACTOR,
        bytesAfter: sumBytes(remaining) + utf8ByteLength(payload),
        byteBudget: COLLABORATION_LEASES_MAX_BYTES,
      });
    } catch (error) {
      if (error instanceof CanvasLimitError) {
        return { accepted: false, lease_id: leaseId, reason: 'limit_reached', limit: error.limit };
      }
      throw error;
    }
    for (const row of nodeRows) {
      this.#sql.exec('DELETE FROM leases WHERE lease_id = ?', row.key);
    }
    this.#sql.exec(
      'INSERT INTO leases (lease_id, node_id, payload, expires_at) VALUES (?, ?, ?, ?)',
      leaseId,
      input.node_id,
      payload,
      expiresAt,
    );
    return { accepted: true, lease_id: leaseId, reason: 'ok' };
  }

  /**
   * Releases leases the bound actor holds: the one on `node_id`, or the one `lease_id` names. Only
   * the actor's own rows are candidates, so no id can reach another actor's lease.
   */
  releaseLease(canvasId: string, holder: CollaborationActor, input: ReleaseLeaseInput): boolean {
    this.ensureCanvasId(canvasId);
    const targets = this.#leaseRows().filter((row) => {
      if (row.value.holder.actor_id !== holder.actor_id) return false;
      if (input.node_id !== undefined) return row.value.node_id === input.node_id;
      return (
        row.key === input.lease_id ||
        legacyLeaseIdForActor(row.value.node_id, holder.actor_id) === input.lease_id
      );
    });
    for (const row of targets) {
      this.#sql.exec('DELETE FROM leases WHERE lease_id = ?', row.key);
    }
    return targets.length > 0;
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
      if (!requested.has(row.key)) continue;
      const lease = leaseForNode(leases, row.value.node_id);
      const ownDraft = row.value.author.actor_id === actor.actor_id;
      const leasedByOther = lease !== undefined && lease.holder.actor_id !== actor.actor_id;
      if (!ownDraft && leasedByOther) continue;
      this.#sql.exec('DELETE FROM text_drafts WHERE draft_id = ?', row.key);
      cleared.push(row.key);
    }
    return cleared;
  }
}
