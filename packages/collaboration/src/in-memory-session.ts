import type {
  CollaborationActor,
  CollaborationSnapshot,
  CommentDraft,
  PresenceEntry,
  UpsertCommentInput,
} from './protocol';

function nowIso(): string {
  return new Date().toISOString();
}

export interface InMemoryCollaborationSessionOptions {
  readonly canvasId: string;
  readonly actor: CollaborationActor;
  readonly surface: 'canvas' | 'review';
  readonly seedPresence?: readonly PresenceEntry[];
  readonly seedComments?: readonly CommentDraft[];
}

export class InMemoryCollaborationSession {
  readonly #canvasId: string;
  readonly #actor: CollaborationActor;
  readonly #surface: 'canvas' | 'review';
  #presence: PresenceEntry[];
  #comments: CommentDraft[];
  readonly #listeners = new Set<(snapshot: CollaborationSnapshot) => void>();

  constructor(options: InMemoryCollaborationSessionOptions) {
    this.#canvasId = options.canvasId;
    this.#actor = options.actor;
    this.#surface = options.surface;
    this.#presence = [...(options.seedPresence ?? [])];
    this.#comments = [...(options.seedComments ?? [])];
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
    return {
      canvas_id: this.#canvasId,
      presence: [...this.#presence],
      comments: [...this.#comments],
      text_drafts: [],
      leases: [],
    };
  }

  subscribe(listener: (snapshot: CollaborationSnapshot) => void): () => void {
    this.#listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.#listeners.delete(listener);
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

  async joinPresence(): Promise<void> {
    const timestamp = nowIso();
    const entry: PresenceEntry = {
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
    text_drafts: [],
    leases: [],
  };
}
