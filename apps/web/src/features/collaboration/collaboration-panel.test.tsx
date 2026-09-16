import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { createPreviewCollaborationSnapshot } from '@mustbeviral/collaboration';

import { CollaborationSidebar, CommentThreadPanel, PresenceBar } from './collaboration-panel';
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
    // Each comment is an article inside a plain list item, so the list keeps only listitem children.
    expect(html).toMatch(/<ul[^>]*role="list"[^>]*><li><article[^>]*tabindex="0"/u);
    expect(html).not.toContain('role="article"');
    expect(html).toContain('texture size');
    expect(html).toContain('Post draft comment');
    expect(html).toContain('data-comment-anchor="7"');
    expect(html).toContain('maxLength="4000"');
    // Without an acting identity and handler there is nothing to delete.
    expect(html).not.toContain('Delete your comment');
  });

  it('shows a refused change as an alert in the collaboration sidebar', () => {
    const message = 'Comment not posted: this canvas has reached its comment limit.';
    const withRefusal = renderToStaticMarkup(
      <CollaborationSidebar
        anchorId="7"
        anchorLabel="Asset 03"
        comments={[]}
        onSubmitComment={() => undefined}
        refusal={message}
        snapshot={snapshot}
        status="open"
        surface="canvas"
      />,
    );
    expect(withRefusal).toContain('role="alert"');
    expect(withRefusal).toContain(message);
    const without = renderToStaticMarkup(
      <CollaborationSidebar
        anchorId="7"
        anchorLabel="Asset 03"
        comments={[]}
        onSubmitComment={() => undefined}
        snapshot={snapshot}
        status="open"
        surface="canvas"
      />,
    );
    expect(without).not.toContain('role="alert"');
  });

  it("offers delete only on the acting member's own comments", () => {
    const comments = commentsForAnchor(snapshot, '7');
    const author = comments[0]!.author.actor_id;
    const own = renderToStaticMarkup(
      <CommentThreadPanel
        actorId={author}
        anchorId="7"
        anchorLabel="Asset 03"
        comments={comments}
        onDeleteComment={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(own).toContain('aria-label="Delete your comment on Asset 03"');
    const others = renderToStaticMarkup(
      <CommentThreadPanel
        actorId="someone-else"
        anchorId="7"
        anchorLabel="Asset 03"
        comments={comments}
        onDeleteComment={() => undefined}
        onSubmit={() => undefined}
      />,
    );
    expect(others).not.toContain('Delete your comment');
  });
});
