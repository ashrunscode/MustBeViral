'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PlatformInput, PlatformOperation, PlatformOutput } from '@mustbeviral/contracts';
import { platformRequest } from './platform-client';
import { createBrowserSupabaseClient } from '../../lib/supabase/client';

type QueryState<T> = { key: string; data?: T; error?: unknown };

/** Hide a prior scope immediately, including a stale success after a newer denial. */
export function visiblePlatformQuery<T>(
  enabled: boolean,
  state: QueryState<T> | null,
  key: string,
) {
  const matching = enabled && state?.key === key ? state : null;
  return {
    data: matching?.data,
    error: matching?.error,
    loading: enabled && matching === null,
  };
}

/** A prior scope's data is hidden synchronously, even before the new effect runs. */
export function usePlatformQuery<O extends PlatformOperation>(
  operation: O,
  input: PlatformInput<O>,
  enabled = true,
  refreshOnFocus = false,
) {
  const serialized = JSON.stringify(input);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([operation, serialized, revision]);
  const [state, setState] = useState<QueryState<PlatformOutput<O>> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let current = true;
    void platformRequest(operation, JSON.parse(serialized) as PlatformInput<O>).then(
      (data) => {
        if (current) setState({ key, data });
      },
      (error: unknown) => {
        if (current) setState({ key, error });
      },
    );
    return () => {
      current = false;
    };
  }, [operation, serialized, key, enabled]);
  const refresh = useCallback(() => setRevision((value) => value + 1), [setRevision]);
  useEffect(() => {
    try {
      let user: string | undefined;
      const { data } = createBrowserSupabaseClient().auth.onAuthStateChange((event, session) => {
        const next = session?.user.id;
        if (event === 'SIGNED_OUT' || (event !== 'INITIAL_SESSION' && next !== user)) refresh();
        user = next;
      });
      return () => data.subscription.unsubscribe();
    } catch {
      return;
    } // The request reports missing configuration without inventing session data.
  }, [refresh]);
  // Revalidate when returning to the tab; the existing data disappears until authority is checked.
  useEffect(() => {
    if (!enabled || !refreshOnFocus) return;
    const resume = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [enabled, refresh, refreshOnFocus]);
  return { ...visiblePlatformQuery(enabled, state, key), refresh };
}
