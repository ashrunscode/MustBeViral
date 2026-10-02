'use client';

import { useEffect, useRef } from 'react';

/**
 * After a server action answers, move focus to the first field marked invalid, or to the message
 * when no field is. The pending-disabled submit button would otherwise drop focus to the body.
 */
export function useFocusInvalid<T extends HTMLElement>(state: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = ref.current;
    if (root === null) return;
    const invalid = root.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid !== null) {
      invalid.focus();
      return;
    }
    const message = root.querySelector<HTMLElement>('[role="alert"], [role="status"]');
    if (message !== null) {
      message.setAttribute('tabindex', '-1');
      message.focus();
    }
  }, [state]);
  return ref;
}
