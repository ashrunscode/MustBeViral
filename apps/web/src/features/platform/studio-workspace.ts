'use client';
import { useCallback, useEffect, useState } from 'react';
import { platformRequest } from './platform-client';

export type StudioWorkspaceAssociation =
  | Readonly<{ status: 'idle' | 'pending' | 'associated' | 'unassociated' }>
  | Readonly<{ status: 'error'; error: unknown }>;

/** True when the studio's brand directory holds a brand that lives in the workspace. */
export function studioDirectoryOwnsWorkspace(
  items: ReadonlyArray<{ workspace_id: string }>,
  workspaceId: string,
): boolean {
  return items.some((item) => item.workspace_id === workspaceId);
}

/** Pages through the studio's brands until one in the workspace is found or the pages run out. */
export async function proveStudioWorkspace(
  studioId: string,
  workspaceId: string,
  list: (
    input: Readonly<{ studio_id: string; include_archived: true; limit: 100; cursor?: string }>,
  ) => Promise<
    Readonly<{ items: ReadonlyArray<{ workspace_id: string }>; next_cursor?: string | null }>
  >,
): Promise<StudioWorkspaceAssociation> {
  try {
    let cursor: string | undefined;
    do {
      const page = await list({
        studio_id: studioId,
        include_archived: true,
        limit: 100,
        ...(cursor ? { cursor } : {}),
      });
      if (studioDirectoryOwnsWorkspace(page.items, workspaceId)) return { status: 'associated' };
      cursor = page.next_cursor ?? undefined;
    } while (cursor !== undefined);
    return { status: 'unassociated' };
  } catch (error) {
    return { status: 'error', error };
  }
}

/**
 * Whether a studio may stand over a workspace: the studio must own a brand in it. Used by routes
 * that carry a studio but no brand in their link, such as the workspace tools.
 */
export function useStudioWorkspaceAssociation(
  studioId: string | undefined,
  workspaceId: string,
  enabled: boolean,
): StudioWorkspaceAssociation & Readonly<{ retry: () => void }> {
  const needed = enabled && studioId !== undefined;
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([studioId, workspaceId, nonce]);
  const [state, setState] = useState<{ key: string; result: StudioWorkspaceAssociation } | null>(
    null,
  );
  useEffect(() => {
    if (!needed || studioId === undefined) return;
    let current = true;
    void proveStudioWorkspace(studioId, workspaceId, (input) =>
      platformRequest('list_studio_brands', input),
    ).then((result) => {
      if (current) setState({ key, result });
    });
    return () => {
      current = false;
    };
  }, [key, needed, studioId, workspaceId]);
  const retry = useCallback(() => setNonce((value) => value + 1), []);
  if (!needed) return { status: 'idle', retry };
  if (state === null || state.key !== key) return { status: 'pending', retry };
  return { ...state.result, retry };
}
