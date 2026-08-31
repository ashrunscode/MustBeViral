'use client';

import { Button, MonoCaps } from '@mustbeviral/ui';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

import type { CollaborationSnapshot } from '@mustbeviral/collaboration';

import styles from './collaboration-panel.module.css';
import { presenceLabel } from './use-collaboration-session';

function initials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function PresenceBar({
  snapshot,
  status,
  surface,
}: Readonly<{
  snapshot: CollaborationSnapshot | null;
  status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  surface: 'canvas' | 'review';
}>) {
  const viewers = snapshot?.presence.filter((entry) => entry.surface === surface) ?? [];
  return (
    <section
      className={styles.presenceBar}
      aria-label="Collaborator presence"
      data-collaboration-status={status}
    >
      <ul className={styles.presenceAvatars} aria-label="Active collaborators">
        {viewers.map((entry) => (
          <li key={entry.actor.actor_id}>
            <span
              className={styles.presenceAvatar}
              style={
                entry.actor.color === undefined
                  ? undefined
                  : { background: `${entry.actor.color}22`, borderColor: entry.actor.color }
              }
              title={`${entry.actor.display_name} · ${entry.surface}`}
            >
              {initials(entry.actor.display_name)}
            </span>
          </li>
        ))}
      </ul>
      <div className={styles.presenceMeta}>
        <MonoCaps>Live presence</MonoCaps>
        <strong>{presenceLabel(snapshot, surface)}</strong>
        <span>
          {surface === 'canvas' ? 'Viewing graph' : 'Reviewing outputs'} · draft comments only
        </span>
      </div>
      <span className={styles.presenceStatus}>{status}</span>
    </section>
  );
}

export function CommentThreadPanel({
  anchorId,
  anchorLabel,
  comments,
  composerLabel = 'Add a draft comment',
  onSubmit,
}: Readonly<{
  anchorId: string | null;
  anchorLabel: string;
  comments: readonly CollaborationSnapshot['comments'][number][];
  composerLabel?: string;
  onSubmit: (body: string) => void;
}>) {
  const listId = useId();
  const composerId = useId();
  const [draft, setDraft] = useState('');
  const itemRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    itemRefs.current = itemRefs.current.slice(0, comments.length);
  }, [comments.length]);

  function focusComment(index: number): void {
    itemRefs.current[index]?.focus();
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLUListElement>): void {
    if (comments.length === 0) return;
    const currentIndex = itemRefs.current.findIndex(
      (element) => element === document.activeElement,
    );
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = currentIndex < 0 ? 0 : Math.min(comments.length - 1, currentIndex + 1);
      focusComment(nextIndex);
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
      focusComment(nextIndex);
    }
    if (event.key === 'Home') {
      event.preventDefault();
      focusComment(0);
    }
    if (event.key === 'End') {
      event.preventDefault();
      focusComment(comments.length - 1);
    }
  }

  function submitDraft(): void {
    const body = draft.trim();
    if (body.length === 0 || anchorId === null) return;
    onSubmit(body);
    setDraft('');
  }

  return (
    <section
      className={styles.commentPanel}
      aria-labelledby={listId}
      data-comment-anchor={anchorId ?? 'none'}
    >
      <div className={styles.commentPanelHeader}>
        <div>
          <MonoCaps>Draft comments</MonoCaps>
          <h3 id={listId}>{anchorLabel}</h3>
        </div>
        <span>
          {String(comments.length)} thread{comments.length === 1 ? '' : 's'}
        </span>
      </div>
      {comments.length === 0 ? (
        <p className={styles.commentEmpty}>No draft comments on this anchor yet.</p>
      ) : (
        <ul
          className={styles.commentList}
          role="list"
          aria-label={`Comment thread for ${anchorLabel}`}
          onKeyDown={handleListKeyDown}
        >
          {comments.map((comment, index) => (
            <li
              key={comment.comment_id}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              className={styles.commentItem}
              tabIndex={0}
              role="article"
              aria-label={`Comment by ${comment.author.display_name}`}
            >
              <span className={styles.commentAuthor}>{comment.author.display_name}</span>
              <p className={styles.commentBody}>{comment.body}</p>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.commentComposer}>
        <label htmlFor={composerId}>
          {composerLabel}
          <textarea
            id={composerId}
            value={draft}
            disabled={anchorId === null}
            placeholder={
              anchorId === null
                ? 'Select an element to anchor a draft comment'
                : 'Share a draft note for collaborators'
            }
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                event.preventDefault();
                submitDraft();
              }
            }}
          />
        </label>
        <div className={styles.commentComposerActions}>
          <Button
            variant="primary"
            disabled={anchorId === null || draft.trim().length === 0}
            onClick={submitDraft}
          >
            Post draft comment
          </Button>
        </div>
      </div>
    </section>
  );
}

export function CollaborationSidebar({
  anchorId,
  anchorLabel,
  comments,
  onSubmitComment,
  snapshot,
  status,
  surface,
}: Readonly<{
  anchorId: string | null;
  anchorLabel: string;
  comments: readonly CollaborationSnapshot['comments'][number][];
  onSubmitComment: (body: string) => void;
  snapshot: CollaborationSnapshot | null;
  status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  surface: 'canvas' | 'review';
}>) {
  return (
    <div className={styles.collaborationStack}>
      <PresenceBar snapshot={snapshot} status={status} surface={surface} />
      <CommentThreadPanel
        anchorId={anchorId}
        anchorLabel={anchorLabel}
        comments={comments}
        onSubmit={onSubmitComment}
      />
    </div>
  );
}

export function focusCollaborationComposer(
  composerRef: RefObject<HTMLTextAreaElement | null>,
): void {
  composerRef.current?.focus();
}
