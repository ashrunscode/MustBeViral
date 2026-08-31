import { describe, expect, it } from 'vitest';

import {
  InMemoryCollaborationSession,
  createPreviewCollaborationSnapshot,
} from './in-memory-session';

describe('in-memory collaboration session', () => {
  it('tracks local presence and comment drafts without websocket transport', () => {
    const session = new InMemoryCollaborationSession({
      canvasId: 'preview-canvas',
      actor: { actor_id: 'you', display_name: 'You' },
      surface: 'canvas',
      seedPresence: createPreviewCollaborationSnapshot('preview-canvas', 'canvas').presence,
      seedComments: createPreviewCollaborationSnapshot('preview-canvas', 'canvas').comments,
    });
    const seen: string[] = [];
    const unsubscribe = session.subscribe((snapshot) => {
      seen.push(snapshot.comments.map((comment) => comment.comment_id).join(','));
    });
    session.connect();
    session.upsertComment({
      comment_id: 'comment-new',
      body: 'Validate before quoting.',
      anchor_node_id: '2',
    });
    session.disconnect();
    unsubscribe();
    expect(seen.at(-2)).toContain('comment-asset-7');
    expect(seen.at(-1)).toContain('comment-new');
    expect(session.snapshot.presence.some((entry) => entry.actor.actor_id === 'you')).toBe(false);
  });

  it('tracks text drafts and edit leases in preview transport', () => {
    const session = new InMemoryCollaborationSession({
      canvasId: 'preview-canvas',
      actor: { actor_id: 'you', display_name: 'You' },
      surface: 'canvas',
    });
    session.acquireLease('7');
    session.upsertTextDraft({
      draft_id: 'node-7::parameters.prompt',
      node_id: '7',
      field_path: 'parameters.prompt',
      body: 'Sharper rim light',
    });
    expect(session.snapshot.text_drafts).toHaveLength(1);
    expect(session.snapshot.leases).toHaveLength(1);
    session.releaseLease('lease-7-you');
    expect(session.snapshot.leases).toHaveLength(0);
  });
});
