'use client';

import {
  CollaborationClient,
  InMemoryCollaborationSession,
  createPreviewCollaborationSnapshot,
  type CollaborationActor,
  type CollaborationSnapshot,
} from '@mustbeviral/collaboration';
import { useEffect, useMemo, useRef, useState } from 'react';

import { readWebPublicEnvironment } from '../../config/public-environment';

export type CollaborationTransport = 'preview' | 'websocket';

export interface UseCollaborationSessionOptions {
  readonly canvasId: string | null;
  readonly actor: CollaborationActor;
  readonly surface: 'canvas' | 'review';
  readonly transport: CollaborationTransport;
}

export interface CollaborationSessionState {
  readonly snapshot: CollaborationSnapshot | null;
  readonly status: 'idle' | 'connecting' | 'open' | 'closed' | 'error';
  readonly upsertComment: (
    input: Readonly<{
      comment_id: string;
      body: string;
      anchor_node_id?: string;
    }>,
  ) => void;
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

const noopUpsertComment: CollaborationSessionState['upsertComment'] = () => undefined;

export function useCollaborationSession(
  options: UseCollaborationSessionOptions,
): CollaborationSessionState {
  const isActive = options.canvasId !== null && options.canvasId.length > 0;
  const [snapshot, setSnapshot] = useState<CollaborationSnapshot | null>(null);
  const [status, setStatus] = useState<CollaborationSessionState['status']>('connecting');
  const upsertRef = useRef<CollaborationSessionState['upsertComment']>(noopUpsertComment);

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
      upsertRef.current = noopUpsertComment;
      return undefined;
    }

    if (options.transport === 'preview') {
      const previewSnapshot = createPreviewCollaborationSnapshot(
        options.canvasId!,
        options.surface,
      );
      const session = new InMemoryCollaborationSession({
        canvasId: options.canvasId!,
        actor: options.actor,
        surface: options.surface,
        seedPresence: previewSnapshot.presence,
        seedComments: previewSnapshot.comments,
      });
      const unsubscribe = session.subscribe((next) => {
        setSnapshot(next);
        setStatus('open');
      });
      session.connect();
      upsertRef.current = (input) => {
        session.upsertComment(input);
      };
      return () => {
        unsubscribe();
        session.disconnect();
        upsertRef.current = noopUpsertComment;
      };
    }

    const client = new CollaborationClient({
      baseUrl: collaborationBaseUrl!,
      canvasId: options.canvasId!,
      actor: options.actor,
      surface: options.surface,
      onSnapshot: setSnapshot,
      onStatus: setStatus,
    });
    client.connect();
    upsertRef.current = (input) => {
      client.upsertComment(input);
    };
    return () => {
      client.disconnect();
      upsertRef.current = noopUpsertComment;
    };
  }, [
    collaborationBaseUrl,
    configurationError,
    isActive,
    options.actor,
    options.canvasId,
    options.surface,
    options.transport,
  ]);

  if (!isActive) {
    return {
      snapshot: null,
      status: 'idle',
      upsertComment: noopUpsertComment,
    };
  }

  if (configurationError) {
    return {
      snapshot: emptySnapshot(options.canvasId!),
      status: 'error',
      upsertComment: noopUpsertComment,
    };
  }

  return {
    snapshot,
    status,
    upsertComment: (input) => {
      upsertRef.current(input);
    },
  };
}

export function collaborationActorForReviewer(
  reviewer: string,
  transport: CollaborationTransport,
): CollaborationActor {
  if (transport === 'preview') {
    return { actor_id: 'local-preview', display_name: reviewer, color: '#3182d4' };
  }
  return {
    actor_id: reviewer.toLowerCase().replace(/\s+/gu, '-'),
    display_name: reviewer,
    color: '#3182d4',
  };
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
