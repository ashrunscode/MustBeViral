'use client';

import {
  CollaborationClient,
  InMemoryCollaborationSession,
  createPreviewCollaborationSnapshot,
  textDraftKey,
  type CollaborationActor,
  type CollaborationSnapshot,
} from '@mustbeviral/collaboration';
import { useEffect, useMemo, useRef, useState } from 'react';

import { readWebPublicEnvironment } from '../../config/public-environment';
import { requestCollaborationTicket } from './collaboration-ticket';

export type CollaborationTransport = 'preview' | 'websocket';

export interface UseCollaborationSessionOptions {
  readonly canvasId: string | null;
  /**
   * Local demo identity for the preview transport only. The websocket transport ignores it: its
   * identity is the one Core binds into the collaboration ticket for the signed-in user.
   */
  readonly previewActor: CollaborationActor;
  readonly surface: 'canvas' | 'review';
  readonly transport: CollaborationTransport;
}

export interface CollaborationSessionState {
  readonly snapshot: CollaborationSnapshot | null;
  readonly status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  /**
   * The identity this session acts as: the preview actor in preview, or the ticket-bound actor from
   * Core in websocket transport. Null until Core has issued a ticket.
   */
  readonly actor: CollaborationActor | null;
  /** Creates a comment. The collaboration Worker assigns its id; callers never choose one. */
  readonly createComment: (
    input: Readonly<{
      body: string;
      anchor_node_id?: string;
    }>,
  ) => void;
  /** Deletes one of the acting identity's own comments. Other members' comments are refused. */
  readonly deleteComment: (commentId: string) => void;
  readonly upsertTextDraft: (
    input: Readonly<{
      node_id: string;
      field_path: string;
      body: string;
    }>,
  ) => void;
  readonly acquireLease: (nodeId: string) => void;
  readonly releaseLease: (nodeId: string) => void;
  readonly clearCheckpointedDrafts: (draftIds: readonly string[], revisionId: string) => void;
}

function emptySnapshot(canvasId: string): CollaborationSnapshot {
  return {
    canvas_id: canvasId,
    presence: [],
    comments: [],
    text_drafts: [],
    leases: [],
  };
}

function sameActor(left: CollaborationActor | null, right: CollaborationActor): boolean {
  return (
    left !== null &&
    left.actor_id === right.actor_id &&
    left.display_name === right.display_name &&
    left.color === right.color
  );
}

const noop = () => undefined;

export function useCollaborationSession(
  options: UseCollaborationSessionOptions,
): CollaborationSessionState {
  const isActive = options.canvasId !== null && options.canvasId.length > 0;
  const [snapshot, setSnapshot] = useState<CollaborationSnapshot | null>(null);
  const [status, setStatus] = useState<CollaborationSessionState['status']>('connecting');
  const [boundActor, setBoundActor] = useState<CollaborationActor | null>(null);
  const createCommentRef = useRef<CollaborationSessionState['createComment']>(noop);
  const deleteCommentRef = useRef<CollaborationSessionState['deleteComment']>(noop);
  const upsertTextDraftRef = useRef<CollaborationSessionState['upsertTextDraft']>(noop);
  const acquireLeaseRef = useRef<CollaborationSessionState['acquireLease']>(noop);
  const releaseLeaseRef = useRef<CollaborationSessionState['releaseLease']>(noop);
  const clearCheckpointedDraftsRef =
    useRef<CollaborationSessionState['clearCheckpointedDrafts']>(noop);

  // Callers build the preview actor inline on every render. Key the session on the actor's field
  // values, not its object identity: every snapshot the session emits re-renders the caller, and a
  // fresh actor object in the effect dependencies would restart the session and emit again, without
  // end.
  const {
    actor_id: previewActorId,
    display_name: previewActorDisplayName,
    color: previewActorColor,
  } = options.previewActor;
  const previewActor = useMemo<CollaborationActor>(
    () => ({
      actor_id: previewActorId,
      display_name: previewActorDisplayName,
      ...(previewActorColor === undefined ? {} : { color: previewActorColor }),
    }),
    [previewActorColor, previewActorDisplayName, previewActorId],
  );

  const collaborationBaseUrl = useMemo(() => {
    try {
      return readWebPublicEnvironment().NEXT_PUBLIC_COLLABORATION_API_URL ?? null;
    } catch {
      return null;
    }
  }, []);

  const configurationError =
    isActive && options.transport === 'websocket' && collaborationBaseUrl === null;

  useEffect(() => {
    if (!isActive || configurationError) {
      createCommentRef.current = noop;
      deleteCommentRef.current = noop;
      upsertTextDraftRef.current = noop;
      acquireLeaseRef.current = noop;
      releaseLeaseRef.current = noop;
      clearCheckpointedDraftsRef.current = noop;
      return undefined;
    }

    if (options.transport === 'preview') {
      const previewSnapshot = createPreviewCollaborationSnapshot(
        options.canvasId!,
        options.surface,
      );
      const session = new InMemoryCollaborationSession({
        canvasId: options.canvasId!,
        actor: previewActor,
        surface: options.surface,
        seedPresence: previewSnapshot.presence,
        seedComments: previewSnapshot.comments,
        seedTextDrafts: previewSnapshot.text_drafts,
        seedLeases: previewSnapshot.leases,
      });
      const unsubscribe = session.subscribe((next) => {
        setSnapshot(next);
        setStatus('open');
      });
      session.connect();
      createCommentRef.current = (input) => {
        session.createComment(input);
      };
      deleteCommentRef.current = (commentId) => {
        session.deleteComment(commentId);
      };
      upsertTextDraftRef.current = (input) => {
        session.upsertTextDraft({
          draft_id: textDraftKey(input.node_id, input.field_path),
          ...input,
        });
      };
      acquireLeaseRef.current = (nodeId) => {
        session.acquireLease(nodeId);
      };
      releaseLeaseRef.current = (nodeId) => {
        session.releaseLease(nodeId);
      };
      clearCheckpointedDraftsRef.current = (draftIds, revisionId) => {
        session.clearCheckpointedDrafts({ draft_ids: draftIds, revision_id: revisionId });
      };
      return () => {
        unsubscribe();
        session.disconnect();
        createCommentRef.current = noop;
        deleteCommentRef.current = noop;
        upsertTextDraftRef.current = noop;
        acquireLeaseRef.current = noop;
        releaseLeaseRef.current = noop;
        clearCheckpointedDraftsRef.current = noop;
      };
    }

    const canvasId = options.canvasId!;
    const client = new CollaborationClient({
      baseUrl: collaborationBaseUrl!,
      canvasId,
      surface: options.surface,
      // Called for the first connection and again for every reconnect: tickets are single-use in
      // practice and expire within seconds. The Worker also ends every socket at its maximum
      // lifetime; the client then fetches a new ticket at once, so Core re-checks access, and the
      // session carries on without restarting this effect.
      ticketProvider: () => requestCollaborationTicket(canvasId),
      onActor: (next) => {
        setBoundActor((current) => (sameActor(current, next) ? current : next));
      },
      onSnapshot: setSnapshot,
      onStatus: setStatus,
    });
    client.connect();
    createCommentRef.current = (input) => {
      client.createComment(input);
    };
    deleteCommentRef.current = (commentId) => {
      client.deleteComment(commentId);
    };
    upsertTextDraftRef.current = (input) => {
      client.upsertTextDraft({
        draft_id: textDraftKey(input.node_id, input.field_path),
        ...input,
      });
    };
    acquireLeaseRef.current = (nodeId) => {
      client.acquireLease(nodeId);
    };
    releaseLeaseRef.current = (nodeId) => {
      client.releaseLease(nodeId);
    };
    clearCheckpointedDraftsRef.current = (draftIds, revisionId) => {
      client.clearCheckpointedDrafts(draftIds, revisionId);
    };
    return () => {
      client.disconnect();
      createCommentRef.current = noop;
      deleteCommentRef.current = noop;
      upsertTextDraftRef.current = noop;
      acquireLeaseRef.current = noop;
      releaseLeaseRef.current = noop;
      clearCheckpointedDraftsRef.current = noop;
    };
  }, [
    collaborationBaseUrl,
    configurationError,
    isActive,
    options.canvasId,
    options.surface,
    options.transport,
    previewActor,
  ]);

  const actor = options.transport === 'preview' ? previewActor : boundActor;

  if (!isActive) {
    return {
      snapshot: null,
      status: 'idle',
      actor: null,
      createComment: noop,
      deleteComment: noop,
      upsertTextDraft: noop,
      acquireLease: noop,
      releaseLease: noop,
      clearCheckpointedDrafts: noop,
    };
  }

  if (configurationError) {
    return {
      snapshot: emptySnapshot(options.canvasId!),
      status: 'error',
      actor: null,
      createComment: noop,
      deleteComment: noop,
      upsertTextDraft: noop,
      acquireLease: noop,
      releaseLease: noop,
      clearCheckpointedDrafts: noop,
    };
  }

  return {
    snapshot,
    status,
    actor,
    createComment: (input) => {
      createCommentRef.current(input);
    },
    deleteComment: (commentId) => {
      deleteCommentRef.current(commentId);
    },
    upsertTextDraft: (input) => {
      upsertTextDraftRef.current(input);
    },
    acquireLease: (nodeId) => {
      acquireLeaseRef.current(nodeId);
    },
    releaseLease: (nodeId) => {
      releaseLeaseRef.current(nodeId);
    },
    clearCheckpointedDrafts: (draftIds, revisionId) => {
      clearCheckpointedDraftsRef.current(draftIds, revisionId);
    },
  };
}

/** Local demo identity for preview collaboration. Never used for the live websocket transport. */
export function previewCollaborationActor(reviewer: string): CollaborationActor {
  return { actor_id: 'local-preview', display_name: reviewer, color: '#3182d4' };
}

export function commentsForAnchor(
  snapshot: CollaborationSnapshot | null,
  anchorId: string | null,
): readonly CollaborationSnapshot['comments'][number][] {
  if (snapshot === null || anchorId === null) return [];
  return snapshot.comments.filter((comment) => comment.anchor_node_id === anchorId);
}

export function presenceLabel(
  snapshot: CollaborationSnapshot | null,
  surface: 'canvas' | 'review',
): string {
  if (snapshot === null) return 'Connecting collaborators';
  const viewers = snapshot.presence.filter((entry) => entry.surface === surface);
  if (viewers.length === 0) return 'Only you';
  const names = viewers.map((entry) => entry.actor.display_name);
  return names.join(', ');
}
