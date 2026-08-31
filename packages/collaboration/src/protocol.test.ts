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

  it('requires explicit actor identity for presence joins', () => {
    expect(() =>
      JoinPresenceInputSchema.parse({
        actor: { actor_id: '', display_name: 'A' },
        surface: 'canvas',
      }),
    ).toThrow();
  });

  it('bounds lease ttl to prevent indefinite locks', () => {
    expect(() =>
      AcquireLeaseInputSchema.parse({
        lease_id: 'lease-1',
        node_id: 'node-1',
        holder: { actor_id: 'actor-1', display_name: 'A' },
        ttl_seconds: 4_000,
      }),
    ).toThrow();
  });

  it('accepts websocket client messages with discriminated types', () => {
    const message = ClientMessageSchema.parse({
      type: 'presence.join',
      payload: {
        actor: { actor_id: 'actor-1', display_name: 'A' },
        surface: 'review',
      },
    });
    expect(message.type).toBe('presence.join');
  });

  it('accepts text draft and lease websocket messages', () => {
    expect(
      ClientMessageSchema.parse({
        type: 'text.draft.upsert',
        payload: {
          draft_id: 'node-1::parameters.prompt',
          node_id: 'node-1',
          field_path: 'parameters.prompt',
          body: 'Draft prompt',
          author: { actor_id: 'actor-1', display_name: 'A' },
        },
      }).type,
    ).toBe('text.draft.upsert');
    expect(
      ClientMessageSchema.parse({
        type: 'lease.release',
        payload: { lease_id: 'lease-1', actor_id: 'actor-1' },
      }).type,
    ).toBe('lease.release');
    expect(
      ClientMessageSchema.parse({
        type: 'text.draft.clear',
        payload: {
          draft_ids: ['node-1::parameters.prompt'],
          actor_id: 'actor-1',
          revision_id: 'revision-2',
        },
      }).type,
    ).toBe('text.draft.clear');
  });
});
