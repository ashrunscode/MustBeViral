'use client';
import { useRef, useState } from 'react';
import type { PlatformInput, PlatformOperation } from '@mustbeviral/contracts';
import { platformRequest } from './platform-client';

export function retainIdempotencyAttempt(
  current: { signature: string; key: string } | null,
  signature: string,
  createKey: () => string,
) {
  if (current?.signature === signature) return current;
  return { signature, key: createKey() };
}

/** Keep an uncertain attempt's key for identical retries; never claim success before acknowledgement. */
export function usePlatformMutation() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(undefined);
  const attempt = useRef<{ signature: string; key: string } | null>(null);
  const busy = useRef(false);
  async function mutate<O extends PlatformOperation>(operation: O, input: PlatformInput<O>) {
    if (busy.current) return undefined;
    busy.current = true;
    setPending(true);
    setError(undefined);
    const signature = JSON.stringify([operation, input]);
    attempt.current = retainIdempotencyAttempt(attempt.current, signature, () =>
      crypto.randomUUID(),
    );
    try {
      const result = await platformRequest(operation, input, attempt.current.key);
      attempt.current = null;
      return result;
    } catch (failure) {
      setError(failure);
      return undefined;
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { mutate, pending, error, clearError: () => setError(undefined) };
}
