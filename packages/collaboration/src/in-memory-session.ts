import {
  DEFAULT_LEASE_TTL_SECONDS,
  type CollaborationActor,
  type CollaborationSnapshot,
  type CommentDraft,
  type EditLease,
  type TextDraft,
  type UpsertCommentInput,
  type UpsertTextDraftInput,
} from './protocol';
import {
  evaluateTextDraftUpsert,
  leaseAcquireVerdict,
  leaseForNode,
  textDraftKey,
} from './conflict-resolution';

function nowIso(): string {
  return new Date().toISOString();
}

export interface InMemoryCollaborationSessionOptions {
  readonly canvasId: string;
  readonly actor: CollaborationActor;
  readonly surface: 'canvas' | 'review';
  readonly seedPresence?: readonly CollaborationSnapshot['presence'][number][];
  readonly seedComments?: readonly CommentDraft[];
  readonly seedTextDrafts?: readonly TextDraft[];
  readonly seedLeases?: readonly EditLease[];
}

export class InMemoryCollaborationSession {
  readonly #canvasId: string;
  readonly #actor: CollaborationActor;
  readonly #surface: 'canvas' | 'review';
  #presence: CollaborationSnapshot['presence'];
  #comments: CommentDraft[];
  #textDrafts: TextDraft[];
  #leases: EditLease[];
  readonly #listeners = new Set<(snapshot: CollaborationSnapshot) => void>();
  readonly #leaseListeners = new Set<
    (result: { accepted: boolean; lease_id: string; node_id: string }) => void
  >();
  readonly #textListeners = new Set<
    (result: {
      accepted: boolean;
      draft_id: string;
      node_id: string;
      field_path: string;
      reason?: 'ok' | 'lease_held' | 'stale';
    }) => void
  >();

  constructor(options: InMemoryCollaborationSessionOptions) {
    this.#canvasId = options.canvasId;
    this.#actor = options.actor;
    this.#surface = options.surface;
    this.#presence = [...(options.seedPresence ?? [])];
    this.#comments = [...(options.seedComments ?? [])];
    this.#textDrafts = [...(options.seedTextDrafts ?? [])];
    this.#leases = [...(options.seedLeases ?? [])];
  }

  connect(): void {
    void this.joinPresence();
  }

  disconnect(): void {
    this.#presence = this.#presence.filter(
      (entry) => entry.actor.actor_id !== this.#actor.actor_id,
    );
    this.#emit();
  }

  get snapshot(): CollaborationSnapshot {
    this.#pruneExpiredLeases();
    return {
      canvas_id: this.#canvasId,
      presence: [...this.#presence],
      comments: [...this.#comments],
      text_drafts: [...this.#textDrafts],
      leases: [...this.#leases],
    };
  }

  subscribe(listener: (snapshot: CollaborationSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  onLeaseResult(
    listener: (result: { accepted: boolean; lease_id: string; node_id: string }) => void,
  ): () => void {
    this.#leaseListeners.add(listener);
    return () => {
      this.#leaseListeners.delete(listener);
    };
  }

  onTextDraftResult(
    listener: (result: {
      accepted: boolean;
      draft_id: string;
      node_id: string;
      field_path: string;
      reason?: 'ok' | 'lease_held' | 'stale';
    }) => void,
  ): () => void {
    this.#textListeners.add(listener);
    return () => {
      this.#textListeners.delete(listener);
    };
  }

  upsertComment(input: Omit<UpsertCommentInput, 'author'>): void {
    const timestamp = nowIso();
    const existing = this.#comments.find((comment) => comment.comment_id === input.comment_id);
    const draft: CommentDraft = {
      comment_id: input.comment_id,
      author: this.#actor,
      body: input.body,
      created_at: existing?.created_at ?? timestamp,
      updated_at: timestamp,
      ...(input.anchor_node_id === undefined ? {} : { anchor_node_id: input.anchor_node_id }),
    };
    this.#comments = [
      ...this.#comments.filter((comment) => comment.comment_id !== input.comment_id),
      draft,
    ];
    this.#emit();
  }

  upsertTextDraft(input: Omit<UpsertTextDraftInput, 'author'>): void {
    this.#pruneExpiredLeases();
    const existing = this.#textDrafts.find(
      (draft) => draft.node_id === input.node_id && draft.field_path === input.field_path,
    );
    const incoming: TextDraft = {
      draft_id: input.draft_id,
      node_id: input.node_id,
      field_path: input.field_path,
      body: input.body,
      author: this.#actor,
      updated_at: nowIso(),
    };
    const verdict = evaluateTextDraftUpsert({
      incoming,
      existing,
      lease: leaseForNode(this.#leases, input.node_id),
      actorId: this.#actor.actor_id,
    });
    const payload = {
      accepted: verdict === 'accepted',
      draft_id: input.draft_id,
      node_id: input.node_id,
      field_path: input.field_path,
      reason:
        verdict === 'accepted'
          ? ('ok' as const)
          : verdict === 'rejected_lease'
            ? ('lease_held' as const)
            : ('stale' as const),
    };
    if (verdict === 'accepted') {
      this.#textDrafts = [
        ...this.#textDrafts.filter(
          (draft) => !(draft.node_id === input.node_id && draft.field_path === input.field_path),
        ),
        incoming,
      ];
      this.#emit();
    }
    for (const listener of this.#textListeners) {
      listener(payload);
    }
  }

  acquireLease(
    nodeId: string,
    leaseId = `lease-${nodeId}-${this.#actor.actor_id}`,
    ttlSeconds = DEFAULT_LEASE_TTL_SECONDS,
  ): void {
    this.#pruneExpiredLeases();
    const conflict = leaseForNode(this.#leases, nodeId);
    const accepted =
      leaseAcquireVerdict({
        existing: conflict,
        holder: this.#actor,
      }) === 'accepted';
    if (accepted) {
      this.#leases = [
        ...this.#leases.filter((lease) => lease.node_id !== nodeId),
        {
          lease_id: leaseId,
          node_id: nodeId,
          holder: this.#actor,
          acquired_at: nowIso(),
          expires_at: new Date(Date.now() + ttlSeconds * 1_000).toISOString(),
        },
      ];
      this.#emit();
    }
    for (const listener of this.#leaseListeners) {
      listener({ accepted, lease_id: leaseId, node_id: nodeId });
    }
  }

  releaseLease(leaseId: string): void {
    const lease = this.#leases.find((candidate) => candidate.lease_id === leaseId);
    if (lease?.holder.actor_id === this.#actor.actor_id) {
      this.#leases = this.#leases.filter((candidate) => candidate.lease_id !== leaseId);
      this.#emit();
    }
  }

  clearCheckpointedDrafts(input: {
    draft_ids: readonly string[];
    revision_id: string;
  }): readonly string[] {
    const requested = new Set(input.draft_ids);
    const cleared: string[] = [];
    this.#textDrafts = this.#textDrafts.filter((draft) => {
      if (!requested.has(draft.draft_id)) return true;
      cleared.push(draft.draft_id);
      return false;
    });
    if (cleared.length > 0) this.#emit();
    return cleared;
  }

  async joinPresence(): Promise<void> {
    const timestamp = nowIso();
    const entry: CollaborationSnapshot['presence'][number] = {
      actor: this.#actor,
      joined_at: timestamp,
      last_seen_at: timestamp,
      surface: this.#surface,
    };
    this.#presence = [
      ...this.#presence.filter((candidate) => candidate.actor.actor_id !== this.#actor.actor_id),
      entry,
    ];
    this.#emit();
  }

  #pruneExpiredLeases(): void {
    const now = Date.now();
    this.#leases = this.#leases.filter((lease) => {
      const expiresMs = Date.parse(lease.expires_at);
      return !Number.isNaN(expiresMs) && expiresMs > now;
    });
  }

  #emit(): void {
    const snapshot = this.snapshot;
    for (const listener of this.#listeners) {
      listener(snapshot);
    }
  }
}

export function createPreviewCollaborationSnapshot(
  canvasId: string,
  surface: 'canvas' | 'review',
): CollaborationSnapshot {
  const timestamp = nowIso();
  return {
    canvas_id: canvasId,
    presence: [
      {
        actor: { actor_id: 'maya-chen', display_name: 'Maya Chen', color: '#3182d4' },
        joined_at: timestamp,
        last_seen_at: timestamp,
        surface,
      },
      {
        actor: {
          actor_id: 'jordan-lee',
          display_name: 'Jordan Lee',
          color: '#1F9D63',
        },
        joined_at: timestamp,
        last_seen_at: timestamp,
        surface: surface === 'canvas' ? 'review' : 'canvas',
      },
    ],
    comments:
      surface === 'canvas'
        ? [
            {
              comment_id: 'comment-asset-7',
              author: { actor_id: 'maya-chen', display_name: 'Maya Chen', color: '#3182d4' },
              body: 'Asset 03 failed on texture size — can we swap the source packshot?',
              anchor_node_id: '7',
              created_at: timestamp,
              updated_at: timestamp,
            },
          ]
        : [
            {
              comment_id: 'comment-hero-b',
              author: { actor_id: 'jordan-lee', display_name: 'Jordan Lee', color: '#1F9D63' },
              body: 'Hero B feels warmer than the brief. Compare to Hero A before approval.',
              anchor_node_id: 'hero-b',
              created_at: timestamp,
              updated_at: timestamp,
            },
          ],
    text_drafts:
      surface === 'canvas'
        ? [
            {
              draft_id: textDraftKey('7', 'parameters.prompt'),
              node_id: '7',
              field_path: 'parameters.prompt',
              body: 'Macro texture on matte ceramic with soft rim light.',
              author: { actor_id: 'maya-chen', display_name: 'Maya Chen', color: '#3182d4' },
              updated_at: timestamp,
            },
          ]
        : [
            {
              draft_id: textDraftKey('hero-b', 'accessibility_description'),
              node_id: 'hero-b',
              field_path: 'accessibility_description',
              body: 'Product hero on warm neutral backdrop with soft key light.',
              author: { actor_id: 'jordan-lee', display_name: 'Jordan Lee', color: '#1F9D63' },
              updated_at: timestamp,
            },
          ],
    leases:
      surface === 'canvas'
        ? [
            {
              lease_id: 'lease-7-maya-chen',
              node_id: '7',
              holder: { actor_id: 'maya-chen', display_name: 'Maya Chen', color: '#3182d4' },
              acquired_at: timestamp,
              expires_at: new Date(Date.now() + DEFAULT_LEASE_TTL_SECONDS * 1_000).toISOString(),
            },
          ]
        : [],
  };
}
