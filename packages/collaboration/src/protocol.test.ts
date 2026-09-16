import { describe, expect, it } from 'vitest';

import {
  AcquireLeaseInputSchema,
  ClientMessageSchema,
  CollaborationSnapshotSchema,
  JoinPresenceInputSchema,
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
