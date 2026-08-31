import { z } from 'zod';

export const CollaborationActorSchema = z.object({
  actor_id: z.string().min(1).max(128),
  display_name: z.string().min(1).max(128),
  color: z.string().min(1).max(32).optional(),
});

export type CollaborationActor = z.infer<typeof CollaborationActorSchema>;

export const PresenceEntrySchema = z.object({
  actor: CollaborationActorSchema,
  joined_at: z.string().datetime(),
  last_seen_at: z.string().datetime(),
  surface: z.enum(['canvas', 'review']),
});

export type PresenceEntry = z.infer<typeof PresenceEntrySchema>;

export const CommentDraftSchema = z.object({
  comment_id: z.string().min(1).max(128),
  author: CollaborationActorSchema,
  body: z.string().min(1).max(8_000),
  anchor_node_id: z.string().min(1).max(128).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CommentDraft = z.infer<typeof CommentDraftSchema>;

export const TextDraftSchema = z.object({
  draft_id: z.string().min(1).max(128),
  node_id: z.string().min(1).max(128),
  field_path: z.string().min(1).max(256),
  body: z.string().max(32_000),
  author: CollaborationActorSchema,
  updated_at: z.string().datetime(),
});

export type TextDraft = z.infer<typeof TextDraftSchema>;

export const EditLeaseSchema = z.object({
  lease_id: z.string().min(1).max(128),
  node_id: z.string().min(1).max(128),
  holder: CollaborationActorSchema,
  acquired_at: z.string().datetime(),
  expires_at: z.string().datetime(),
});

export type EditLease = z.infer<typeof EditLeaseSchema>;

export const CollaborationSnapshotSchema = z.object({
  canvas_id: z.string().min(1).max(128),
  presence: z.array(PresenceEntrySchema),
  comments: z.array(CommentDraftSchema),
  text_drafts: z.array(TextDraftSchema),
  leases: z.array(EditLeaseSchema),
});

export type CollaborationSnapshot = z.infer<typeof CollaborationSnapshotSchema>;

export const JoinPresenceInputSchema = z.object({
  actor: CollaborationActorSchema,
  surface: z.enum(['canvas', 'review']),
});

export type JoinPresenceInput = z.infer<typeof JoinPresenceInputSchema>;

export const UpsertCommentInputSchema = z.object({
  comment_id: z.string().min(1).max(128),
  author: CollaborationActorSchema,
  body: z.string().min(1).max(8_000),
  anchor_node_id: z.string().min(1).max(128).optional(),
});

export type UpsertCommentInput = z.infer<typeof UpsertCommentInputSchema>;

export const AcquireLeaseInputSchema = z.object({
  lease_id: z.string().min(1).max(128),
  node_id: z.string().min(1).max(128),
  holder: CollaborationActorSchema,
  ttl_seconds: z.number().int().min(5).max(900).default(120),
});

export type AcquireLeaseInput = z.infer<typeof AcquireLeaseInputSchema>;

export const ReleaseLeaseInputSchema = z.object({
  lease_id: z.string().min(1).max(128),
  actor_id: z.string().min(1).max(128),
});

export type ReleaseLeaseInput = z.infer<typeof ReleaseLeaseInputSchema>;

export const UpsertTextDraftInputSchema = z.object({
  draft_id: z.string().min(1).max(128),
  node_id: z.string().min(1).max(128),
  field_path: z.string().min(1).max(256),
  body: z.string().max(32_000),
  author: CollaborationActorSchema,
});

export type UpsertTextDraftInput = z.infer<typeof UpsertTextDraftInputSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('presence.join'), payload: JoinPresenceInputSchema }),
  z.object({ type: z.literal('presence.leave'), payload: z.object({ actor_id: z.string() }) }),
  z.object({ type: z.literal('comment.upsert'), payload: UpsertCommentInputSchema }),
  z.object({ type: z.literal('text.draft.upsert'), payload: UpsertTextDraftInputSchema }),
  z.object({ type: z.literal('lease.acquire'), payload: AcquireLeaseInputSchema }),
  z.object({ type: z.literal('lease.release'), payload: ReleaseLeaseInputSchema }),
  z.object({ type: z.literal('snapshot.request') }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot'), payload: CollaborationSnapshotSchema }),
  z.object({
    type: z.literal('lease.result'),
    payload: z.object({
      accepted: z.boolean(),
      lease_id: z.string(),
      node_id: z.string(),
    }),
  }),
  z.object({
    type: z.literal('text.draft.result'),
    payload: z.object({
      accepted: z.boolean(),
      draft_id: z.string(),
      node_id: z.string(),
      field_path: z.string(),
      reason: z.enum(['ok', 'lease_held', 'stale']).optional(),
    }),
  }),
  z.object({
    type: z.literal('error'),
    payload: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export const DEFAULT_LEASE_TTL_SECONDS = 120;

export const LEASE_GATED_NODE_KINDS = [
  'image_generation',
  'image_edit',
  'video_generation',
] as const;

export function requiresEditLease(nodeKind: string): boolean {
  return (LEASE_GATED_NODE_KINDS as readonly string[]).includes(nodeKind);
}

export const FORBIDDEN_COLLABORATION_ROUTES = [
  '/v1/quotes',
  '/v1/runs',
  '/v1/workspaces',
  '/v1/webhooks',
  '/v1/billing',
  '/v1/revisions',
] as const;
