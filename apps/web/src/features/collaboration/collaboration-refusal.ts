import type { CollaborationErrorPayload } from '@mustbeviral/collaboration';

/**
 * Short, specific wording for a collaboration change the Worker (or the client, before sending)
 * refused, so a comment or draft never disappears without the member knowing why.
 */
export function describeCollaborationRefusal(error: CollaborationErrorPayload): string {
  const details = error.details ?? {};
  switch (error.code) {
    case 'CANVAS_LIMIT_REACHED': {
      const own = details.scope === 'actor';
      switch (details.resource) {
        case 'comments':
          return own
            ? 'Comment not posted: you have reached your comment space on this canvas. Delete one of your comments to post another.'
            : 'Comment not posted: this canvas has reached its comment limit.';
        case 'text_drafts':
          return own
            ? 'Draft not synced: you have reached your draft space on this canvas. Checkpoint your drafts to keep syncing.'
            : 'Draft not synced: this canvas has reached its draft limit. Checkpoint drafts to keep syncing.';
        case 'leases':
          return own
            ? 'Lease not taken: you are editing too many nodes. Finish one to edit another.'
            : 'Lease not taken: too many nodes on this canvas are being edited.';
        case 'presence':
          return 'Too many collaborators are on this canvas, so you are not shown as present.';
        default:
          return 'Change not synced: a collaboration limit on this canvas was reached.';
      }
    }
    case 'RATE_LIMITED':
      return 'Changes not synced: you are sending them too quickly. Wait a moment and try again.';
    case 'FIELD_TOO_LARGE':
      return typeof details.limit === 'number' && details.unit === 'characters'
        ? `Not synced: the text is longer than ${details.limit.toLocaleString('en-US')} characters.`
        : 'Not synced: the change has too many items.';
    case 'PAYLOAD_TOO_LARGE':
      return 'Not synced: the change is too large.';
    case 'FORBIDDEN':
      return 'Not changed: you can only edit or delete your own comments.';
    case 'NOT_FOUND':
      return 'Not changed: that comment no longer exists.';
    case 'SNAPSHOT_TOO_LARGE':
      return 'Collaboration is paused: this canvas has more draft data than can be sent.';
    case 'VALIDATION_FAILED':
      return 'Change not synced: it was not valid.';
  }
}

/** Wording for a draft the Worker did not store, or null when nothing needs saying. */
export function describeTextDraftRefusal(reason: string | undefined): string | null {
  return reason === 'lease_held'
    ? 'Draft not synced: another collaborator holds the lease on this node.'
    : null;
}
