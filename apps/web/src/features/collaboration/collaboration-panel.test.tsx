import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createPreviewCollaborationSnapshot } from '@mustbeviral/collaboration';

import { CommentThreadPanel, PresenceBar } from './collaboration-panel';
import { commentsForAnchor, presenceLabel } from './use-collaboration-session';

describe('collaboration panel', () => {
  const snapshot = createPreviewCollaborationSnapshot('preview-canvas', 'canvas');

  it('renders presence avatars and live status for the active surface', () => {
    const html = renderToStaticMarkup(
      <PresenceBar snapshot={snapshot} status="open" surface="canvas" />,
    );
    expect(html).toContain('aria-label="Collaborator presence"');
    expect(html).toContain('data-collaboration-status="open"');
    expect(html).toContain('Maya Chen');
    expect(presenceLabel(snapshot, 'canvas')).toContain('Maya Chen');
  });

  it('renders anchored comment threads with keyboard-focusable articles', () => {
    const comments = commentsForAnchor(snapshot, '7');
    const html = renderToStaticMarkup(
      <CommentThreadPanel
        anchorId="7"
        anchorLabel="Asset 03 — Texture"
        comments={comments}
        onSubmit={() => undefined}
      />,
    );
    expect(html).toContain('role="article"');
    expect(html).toContain('texture size');
    expect(html).toContain('Post draft comment');
    expect(html).toContain('data-comment-anchor="7"');
  });
});
