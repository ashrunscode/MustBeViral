// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useScrollableRegion } from './index';

type Size = {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
};

const observers: Array<{ callback: ResizeObserverCallback; targets: Element[] }> = [];

class FakeResizeObserver {
  private readonly entry: { callback: ResizeObserverCallback; targets: Element[] };

  constructor(callback: ResizeObserverCallback) {
    this.entry = { callback, targets: [] };
    observers.push(this.entry);
  }

  observe(target: Element) {
    this.entry.targets.push(target);
  }

  unobserve() {}

  disconnect() {
    this.entry.targets = [];
  }
}

function setSize(element: HTMLElement, size: Size) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
}

function notifyResize() {
  act(() => {
    for (const observer of observers) {
      if (observer.targets.length > 0) observer.callback([], {} as ResizeObserver);
    }
  });
}

function Region() {
  const region = useScrollableRegion<HTMLElement>();
  return (
    <section ref={region.ref} tabIndex={region.tabIndex} aria-label="Receipt" data-testid="region">
      <p>Receipt lines</p>
    </section>
  );
}

function RegionThenButton() {
  return (
    <>
      <Region />
      <button type="button">Next control</button>
    </>
  );
}

const overflowing: Size = {
  scrollHeight: 900,
  clientHeight: 400,
  scrollWidth: 320,
  clientWidth: 320,
};
const fitting: Size = { scrollHeight: 400, clientHeight: 400, scrollWidth: 320, clientWidth: 320 };

/** Lets the hook's deferred focus-settled check run. */
async function settleFocus() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useScrollableRegion', () => {
  it('adds a tab stop only while the region overflows', () => {
    render(<Region />);
    const region = screen.getByTestId('region');
    expect(region.hasAttribute('tabindex')).toBe(false);

    setSize(region, { scrollHeight: 900, clientHeight: 400, scrollWidth: 320, clientWidth: 320 });
    notifyResize();
    expect(region.getAttribute('tabindex')).toBe('0');

    setSize(region, { scrollHeight: 400, clientHeight: 400, scrollWidth: 320, clientWidth: 320 });
    notifyResize();
    expect(region.hasAttribute('tabindex')).toBe(false);

    setSize(region, { scrollHeight: 400, clientHeight: 400, scrollWidth: 480, clientWidth: 320 });
    notifyResize();
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('ignores a one-pixel rounding difference', () => {
    render(<Region />);
    const region = screen.getByTestId('region');
    setSize(region, { scrollHeight: 401, clientHeight: 400, scrollWidth: 321, clientWidth: 320 });
    notifyResize();
    expect(region.hasAttribute('tabindex')).toBe(false);
  });

  it('observes the region and its content so content growth is measured', () => {
    render(<Region />);
    const region = screen.getByTestId('region');
    const targets = observers.flatMap((observer) => observer.targets);
    expect(targets).toContain(region);
    expect(targets).toContain(region.firstElementChild);
  });

  it('keeps the tab stop and focus while a focused region stops overflowing', async () => {
    render(<RegionThenButton />);
    const region = screen.getByTestId('region');
    setSize(region, overflowing);
    notifyResize();
    act(() => region.focus());
    expect(document.activeElement).toBe(region);

    // A wider window or zooming out: the region fits while it holds focus.
    setSize(region, fitting);
    notifyResize();
    await settleFocus();
    expect(region.getAttribute('tabindex')).toBe('0');
    expect(document.activeElement).toBe(region);

    // Focus moves on (Tab), so the region is measured again and, fitting, stops being a tab stop.
    act(() => screen.getByRole('button', { name: 'Next control' }).focus());
    await settleFocus();
    expect(region.hasAttribute('tabindex')).toBe(false);
  });

  it('keeps the tab stop when focus has not left the region, such as the window losing focus', async () => {
    render(<RegionThenButton />);
    const region = screen.getByTestId('region');
    setSize(region, overflowing);
    notifyResize();
    act(() => region.focus());
    setSize(region, fitting);
    notifyResize();
    act(() => {
      region.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }));
    });
    await settleFocus();
    expect(document.activeElement).toBe(region);
    expect(region.getAttribute('tabindex')).toBe('0');
  });

  it('stays inert without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Region />);
    expect(screen.getByTestId('region').hasAttribute('tabindex')).toBe(false);
  });
});
