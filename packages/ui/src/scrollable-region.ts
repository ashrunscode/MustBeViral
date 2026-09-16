'use client';

import { useEffect, useState, type RefCallback } from 'react';

export interface ScrollableRegion<T extends HTMLElement> {
  /** Attach to the element whose own overflow scrolls. */
  readonly ref: RefCallback<T>;
  /**
   * `0` while the element overflows, so keyboard users can reach and scroll it, and while focus is
   * inside it; otherwise unset.
   */
  readonly tabIndex: 0 | undefined;
}

function overflows(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1
  );
}

/**
 * Keyboard access for a scroll container that holds no focusable content. While the element
 * overflows it becomes a tab stop, so arrow and page keys can scroll it. A region that fits adds no
 * tab stop. The tab stop is never removed while focus is inside the region: removing it would drop
 * focus to the document body, so a region that stops overflowing (a wider window, zooming out) keeps
 * it until focus leaves, and is re-measured then. The caller names the region with
 * `aria-labelledby` or `aria-label`, because a focusable region must announce what it contains.
 */
export function useScrollableRegion<T extends HTMLElement>(): ScrollableRegion<T> {
  const [element, setElement] = useState<T | null>(null);
  const [scrollable, setScrollable] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);

  useEffect(() => {
    if (element === null) return undefined;
    let pendingFocusCheck: ReturnType<typeof setTimeout> | undefined;
    const handleFocusIn = () => {
      clearTimeout(pendingFocusCheck);
      setFocusWithin(true);
    };
    // During focusout the next focus target is not yet active, and a window losing focus keeps the
    // region as the active element, so decide once focus has settled.
    const handleFocusOut = () => {
      clearTimeout(pendingFocusCheck);
      pendingFocusCheck = setTimeout(() => {
        if (element.contains(element.ownerDocument.activeElement)) return;
        setFocusWithin(false);
        setScrollable(overflows(element));
      }, 0);
    };
    element.addEventListener('focusin', handleFocusIn);
    element.addEventListener('focusout', handleFocusOut);
    if (element.contains(element.ownerDocument.activeElement)) handleFocusIn();
    return () => {
      clearTimeout(pendingFocusCheck);
      element.removeEventListener('focusin', handleFocusIn);
      element.removeEventListener('focusout', handleFocusOut);
    };
  }, [element]);

  useEffect(() => {
    if (element === null || typeof ResizeObserver === 'undefined') return undefined;
    // A ResizeObserver reports every observed box once when observation starts, so the first
    // measurement needs no synchronous state update here.
    const resizes = new ResizeObserver(() => setScrollable(overflows(element)));
    const observeChildren = () => {
      resizes.observe(element);
      for (const child of element.children) resizes.observe(child);
    };
    observeChildren();
    // Content added or removed later changes the overflow without resizing the region itself.
    const mutations =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => {
            observeChildren();
            setScrollable(overflows(element));
          });
    mutations?.observe(element, { childList: true });
    return () => {
      resizes.disconnect();
      mutations?.disconnect();
    };
  }, [element]);

  return { ref: setElement, tabIndex: scrollable || focusWithin ? 0 : undefined };
}
