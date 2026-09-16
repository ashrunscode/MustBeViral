import { z } from 'zod';

import {
  COLLABORATION_CLEAR_DRAFT_IDS_MAX_ITEMS,
  COLLABORATION_COMMENT_BODY_MAX_LENGTH,
  COLLABORATION_ERROR_CODES,
  COLLABORATION_FIELD_PATH_MAX_LENGTH,
  COLLABORATION_ID_MAX_LENGTH,
  COLLABORATION_LEASE_ID_MAX_LENGTH,
  COLLABORATION_TEXT_DRAFT_BODY_MAX_LENGTH,
  COLLABORATION_TEXT_DRAFT_ID_MAX_LENGTH,
} from './limits';

const IdSchema = z.string().min(1).max(COLLABORATION_ID_MAX_LENGTH);
const FieldPathSchema = z.string().min(1).max(COLLABORATION_FIELD_PATH_MAX_LENGTH);
const TextDraftIdSchema = z.string().min(1).max(COLLABORATION_TEXT_DRAFT_ID_MAX_LENGTH);
const LeaseIdSchema = z.string().min(1).max(COLLABORATION_LEASE_ID_MAX_LENGTH);
const CommentBodySchema = z.string().min(1).max(COLLABORATION_COMMENT_BODY_MAX_LENGTH);
const TextDraftBodySchema = z.string().max(COLLABORATION_TEXT_DRAFT_BODY_MAX_LENGTH);

export const CollaborationActorSchema = z.object({
  actor_id: IdSchema,
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
  comment_id: IdSchema,
  author: CollaborationActorSchema,
  body: CommentBodySchema,
  anchor_node_id: IdSchema.optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CommentDraft = z.infer<typeof CommentDraftSchema>;

export const TextDraftSchema = z.object({
  draft_id: TextDraftIdSchema,
  node_id: IdSchema,
  field_path: FieldPathSchema,
  body: TextDraftBodySchema,
  author: CollaborationActorSchema,
  updated_at: z.string().datetime(),
});

export type TextDraft = z.infer<typeof TextDraftSchema>;

export const EditLeaseSchema = z.object({
  lease_id: LeaseIdSchema,
  node_id: IdSchema,
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

// Client request payloads carry no identity. The collaboration Worker binds the actor from a
// verified ticket, and these object schemas strip unknown keys, so a legacy or hostile client that
// still sends `actor`, `author`, `holder` or `actor_id` parses, but those fields never reach the
// server's handlers. Every string and array is bounded; see `limits.ts`.

export const JoinPresenceInputSchema = z.object({
  surface: z.enum(['canvas', 'review']),
});

export type JoinPresenceInput = z.infer<typeof JoinPresenceInputSchema>;

/** Creates a comment. The Worker assigns the comment id and returns it in `comment.result`. */
export const CreateCommentInputSchema = z.object({
  body: CommentBodySchema,
  anchor_node_id: IdSchema.optional(),
  /** Opaque correlation value echoed in `comment.result` and `error`. Never used as an id. */
  client_request_id: IdSchema.optional(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentInputSchema>;

/** Changes the body of a comment the bound actor wrote. */
export const UpdateCommentInputSchema = z.object({
  comment_id: IdSchema,
  body: CommentBodySchema,
  client_request_id: IdSchema.optional(),
});

export type UpdateCommentInput = z.infer<typeof UpdateCommentInputSchema>;

/** Deletes a comment the bound actor wrote. */
export const DeleteCommentInputSchema = z.object({
  comment_id: IdSchema,
  client_request_id: IdSchema.optional(),
});

export type DeleteCommentInput = z.infer<typeof DeleteCommentInputSchema>;

/**
 * Legacy `comment.upsert` from clients that chose their own comment ids. It still parses, and the
 * Worker handles it exactly like `comment.create`: the client id is ignored and never becomes the
 * stored id, so it can neither squat nor overwrite another comment.
 */
export const LegacyUpsertCommentInputSchema = z.object({
  comment_id: IdSchema.optional(),
  body: CommentBodySchema,
  anchor_node_id: IdSchema.optional(),
});

export type LegacyUpsertCommentInput = z.infer<typeof LegacyUpsertCommentInputSchema>;

export const AcquireLeaseInputSchema = z.object({
  node_id: IdSchema,
  ttl_seconds: z.number().int().min(5).max(900).default(120),
  /**
   * Optional and never trusted. When present it must be `leaseIdForActor(node_id, actor)` or the
   * legacy joined form for the same node and bound actor; the Worker always stores the injective id.
   */
  lease_id: LeaseIdSchema.optional(),
});

export type AcquireLeaseInput = z.infer<typeof AcquireLeaseInputSchema>;

/** Releases the bound actor's lease on `node_id`, or the bound actor's lease named by `lease_id`. */
export const ReleaseLeaseInputSchema = z
  .object({
    node_id: IdSchema.optional(),
    lease_id: LeaseIdSchema.optional(),
  })
  .refine((input) => input.node_id !== undefined || input.lease_id !== undefined, {
    message: 'node_id or lease_id is required',
  });

export type ReleaseLeaseInput = z.infer<typeof ReleaseLeaseInputSchema>;

export const UpsertTextDraftInputSchema = z.object({
  draft_id: TextDraftIdSchema,
  node_id: IdSchema,
  field_path: FieldPathSchema,
  body: TextDraftBodySchema,
});

export type UpsertTextDraftInput = z.infer<typeof UpsertTextDraftInputSchema>;

export const ClearCheckpointedDraftsInputSchema = z.object({
  draft_ids: z.array(TextDraftIdSchema).min(1).max(COLLABORATION_CLEAR_DRAFT_IDS_MAX_ITEMS),
  revision_id: IdSchema,
});

export type ClearCheckpointedDraftsInput = z.infer<typeof ClearCheckpointedDraftsInputSchema>;

export const ClientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('presence.join'), payload: JoinPresenceInputSchema }),
  z.object({ type: z.literal('presence.leave'), payload: z.object({}) }),
  z.object({ type: z.literal('comment.create'), payload: CreateCommentInputSchema }),
  z.object({ type: z.literal('comment.update'), payload: UpdateCommentInputSchema }),
  z.object({ type: z.literal('comment.delete'), payload: DeleteCommentInputSchema }),
  z.object({ type: z.literal('comment.upsert'), payload: LegacyUpsertCommentInputSchema }),
  z.object({ type: z.literal('text.draft.upsert'), payload: UpsertTextDraftInputSchema }),
  z.object({ type: z.literal('lease.acquire'), payload: AcquireLeaseInputSchema }),
  z.object({ type: z.literal('lease.release'), payload: ReleaseLeaseInputSchema }),
  z.object({
    type: z.literal('text.draft.clear'),
    payload: ClearCheckpointedDraftsInputSchema,
  }),
  z.object({ type: z.literal('snapshot.request') }),
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage['type'];

export const CollaborationErrorCodeSchema = z.enum(COLLABORATION_ERROR_CODES);

/** Structured facts about a rejection. Never contains message content. */
export const CollaborationErrorDetailsSchema = z.object({
  /** Dotted path of the offending field, for FIELD_TOO_LARGE and VALIDATION_FAILED. */
  field: z.string().max(256).optional(),
  limit: z.number().int().nonnegative().optional(),
  unit: z.enum(['characters', 'bytes', 'items', 'rows', 'tokens']).optional(),
  resource: z
    .enum(['comments', 'text_drafts', 'leases', 'presence', 'sockets', 'snapshot', 'message'])
    .optional(),
  scope: z.enum(['canvas', 'actor', 'socket']).optional(),
  retry_after_ms: z.number().int().nonnegative().optional(),
});

export type CollaborationErrorDetails = z.infer<typeof CollaborationErrorDetailsSchema>;

export const CollaborationErrorPayloadSchema = z.object({
  code: CollaborationErrorCodeSchema,
  message: z.string().max(512),
  /** The `type` of the client message that was rejected, when it could be read. */
  request_type: z.string().max(64).optional(),
  client_request_id: IdSchema.optional(),
  details: CollaborationErrorDetailsSchema.optional(),
});

export type CollaborationErrorPayload = z.infer<typeof CollaborationErrorPayloadSchema>;

export const ServerMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('snapshot'), payload: CollaborationSnapshotSchema }),
  z.object({
    type: z.literal('lease.result'),
    payload: z.object({
      accepted: z.boolean(),
      lease_id: z.string(),
      node_id: z.string(),
      reason: z.enum(['ok', 'contested', 'invalid_lease_id', 'limit_reached']).optional(),
    }),
  }),
  z.object({
    type: z.literal('text.draft.result'),
    payload: z.object({
      accepted: z.boolean(),
      draft_id: z.string(),
      node_id: z.string(),
      field_path: z.string(),
      reason: z.enum(['ok', 'lease_held', 'stale', 'limit_reached']).optional(),
    }),
  }),
  z.object({
    type: z.literal('text.draft.clear.result'),
    payload: z.object({
      cleared_draft_ids: z.array(z.string()),
      revision_id: z.string(),
    }),
  }),
  z.object({
    type: z.literal('comment.result'),
    payload: z.object({
      operation: z.enum(['create', 'update', 'delete']),
      comment_id: IdSchema,
      client_request_id: IdSchema.optional(),
    }),
  }),
  z.object({ type: z.literal('error'), payload: CollaborationErrorPayloadSchema }),
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

function issuePath(path: readonly PropertyKey[]): string {
  return path.map(String).join('.').slice(0, 256);
}

/**
 * Describes a client message that failed `ClientMessageSchema`: the first over-limit string or array
 * as `FIELD_TOO_LARGE`, otherwise the first invalid field as `VALIDATION_FAILED`. It names fields
 * and limits only and never echoes message content.
 */
export function describeClientMessageIssues(
  issues: readonly z.core.$ZodIssue[],
): CollaborationErrorPayload {
  for (const issue of issues) {
    if (issue.code === 'too_big' && (issue.origin === 'string' || issue.origin === 'array')) {
      const field = issuePath(issue.path);
      const unit = issue.origin === 'array' ? 'items' : 'characters';
      const limit = Number(issue.maximum);
      return {
        code: 'FIELD_TOO_LARGE',
        message: `${field} exceeds its limit of ${String(limit)} ${unit}.`,
        details: { field, limit, unit },
      };
    }
  }
  const first = issues[0];
  return {
    code: 'VALIDATION_FAILED',
    message: 'Invalid collaboration message.',
    ...(first === undefined ? {} : { details: { field: issuePath(first.path) } }),
  };
}

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
