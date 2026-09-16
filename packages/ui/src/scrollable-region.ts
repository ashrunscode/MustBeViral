'use client';

import { useEffect, useState, type RefCallback } from 'react';

export interface ScrollableRegion<T extends HTMLElement> {
  /** Attach to the element whose own overflow scrolls. */
  readonly ref: RefCallback<T>;
  /** `0` while the element overflows, so keyboard users can reach and scroll it; otherwise unset. */
  readonly tabIndex: 0 | undefined;
}

function overflows(element: HTMLElement): boolean {
  return (
    element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1
  );
}

/**
 * Keyboard access for a scroll container that holds no focusable content. While, and only while,
 * the element actually overflows it becomes a tab stop, so arrow and page keys can scroll it. A
 * region that fits adds no tab stop. The caller names the region with `aria-labelledby` or
 * `aria-label`, because a focusable region must announce what it contains.
 */
export function useScrollableRegion<T extends HTMLElement>(): ScrollableRegion<T> {
  const [element, setElement] = useState<T | null>(null);
  const [scrollable, setScrollable] = useState(false);

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

  return { ref: setElement, tabIndex: scrollable ? 0 : undefined };
}
