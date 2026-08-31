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
});
