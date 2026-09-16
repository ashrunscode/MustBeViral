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

  it('stays inert without ResizeObserver', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Region />);
    expect(screen.getByTestId('region').hasAttribute('tabindex')).toBe(false);
  });
});
