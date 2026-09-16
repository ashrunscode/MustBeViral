import { describe, expect, it } from 'vitest';

import {
  COLLABORATION_COMMENT_BODY_MAX_LENGTH,
  COLLABORATION_ID_MAX_LENGTH,
  COLLABORATION_TEXT_DRAFT_BODY_MAX_LENGTH,
} from './limits';
import {
  AcquireLeaseInputSchema,
  ClientMessageSchema,
  CollaborationSnapshotSchema,
  JoinPresenceInputSchema,
  ReleaseLeaseInputSchema,
  describeClientMessageIssues,
} from './protocol';

describe('collaboration protocol', () => {
  it('parses a collaboration snapshot', () => {
    const snapshot = CollaborationSnapshotSchema.parse({
      canvas_id: 'canvas-1',
      presence: [],
      comments: [],
      text_drafts: [],
      leases: [],
    });
    expect(snapshot.canvas_id).toBe('canvas-1');
  });

  it('requires a known surface for presence joins', () => {
    expect(() => JoinPresenceInputSchema.parse({ surface: 'settings' })).toThrow();
  });

  it('bounds lease ttl to prevent indefinite locks', () => {
    expect(() =>
      AcquireLeaseInputSchema.parse({
        lease_id: 'lease-1',
        node_id: 'node-1',
        ttl_seconds: 4_000,
      }),
    ).toThrow();
  });

  it('bounds every client-supplied field and describes the first over-limit one', () => {
    const tooLong = [
      {
        type: 'comment.create',
        payload: { body: 'x'.repeat(COLLABORATION_COMMENT_BODY_MAX_LENGTH + 1) },
      },
      {
        type: 'text.draft.upsert',
        payload: {
          draft_id: 'd',
          node_id: 'n',
          field_path: 'parameters.prompt',
          body: 'x'.repeat(COLLABORATION_TEXT_DRAFT_BODY_MAX_LENGTH + 1),
        },
      },
      {
        type: 'comment.delete',
        payload: { comment_id: 'c'.repeat(COLLABORATION_ID_MAX_LENGTH + 1) },
      },
      { type: 'lease.release', payload: { node_id: 'n'.repeat(COLLABORATION_ID_MAX_LENGTH + 1) } },
    ];
    for (const message of tooLong) {
      const result = ClientMessageSchema.safeParse(message);
      expect(result.success).toBe(false);
      if (result.success) continue;
      expect(describeClientMessageIssues(result.error.issues).code).toBe('FIELD_TOO_LARGE');
    }
    const invalid = ClientMessageSchema.safeParse({
      type: 'comment.create',
      payload: { body: '' },
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success) {
      expect(describeClientMessageIssues(invalid.error.issues)).toEqual({
        code: 'VALIDATION_FAILED',
        message: 'Invalid collaboration message.',
        details: { field: 'payload.body' },
      });
    }
    expect(ReleaseLeaseInputSchema.safeParse({}).success).toBe(false);
    // A client id on create is stripped, never passed on.
    const create = ClientMessageSchema.parse({
      type: 'comment.create',
      payload: { comment_id: 'chosen-by-client', body: 'Hi' },
    });
    expect(JSON.stringify(create)).not.toContain('chosen-by-client');
  });

  it('accepts websocket client messages with discriminated types', () => {
    const message = ClientMessageSchema.parse({
      type: 'presence.join',
      payload: { surface: 'review' },
    });
    expect(message.type).toBe('presence.join');
  });

  it('parses legacy identity fields but strips them so no handler can read them', () => {
    const forged = { actor_id: 'someone-else', display_name: 'Someone Else' };
    const messages = [
      { type: 'presence.join', payload: { actor: forged, surface: 'canvas' } },
      { type: 'presence.leave', payload: { actor_id: forged.actor_id } },
      { type: 'comment.upsert', payload: { comment_id: 'c-1', author: forged, body: 'Hi' } },
      {
        type: 'text.draft.upsert',
        payload: {
          draft_id: 'node-1::parameters.prompt',
          node_id: 'node-1',
          field_path: 'parameters.prompt',
          body: 'Draft prompt',
          author: forged,
        },
      },
      {
        type: 'lease.acquire',
        payload: { lease_id: 'lease-1', node_id: 'node-1', holder: forged, ttl_seconds: 120 },
      },
      { type: 'lease.release', payload: { lease_id: 'lease-1', actor_id: forged.actor_id } },
      { type: 'comment.create', payload: { author: forged, body: 'Hi' } },
      { type: 'comment.update', payload: { comment_id: 'c-1', author: forged, body: 'Hi' } },
      { type: 'comment.delete', payload: { comment_id: 'c-1', actor_id: forged.actor_id } },
      {
        type: 'text.draft.clear',
        payload: {
          draft_ids: ['node-1::parameters.prompt'],
          actor_id: forged.actor_id,
          revision_id: 'revision-2',
        },
      },
    ];
    for (const message of messages) {
      const parsed = ClientMessageSchema.parse(message);
      expect(parsed.type).toBe(message.type);
      expect(JSON.stringify(parsed)).not.toContain('someone-else');
      expect(JSON.stringify(parsed)).not.toMatch(/"(actor|author|holder|actor_id)"/u);
    }
  });
});
