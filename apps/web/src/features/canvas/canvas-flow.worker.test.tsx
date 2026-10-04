// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CanvasFlow } from '../../../app/(en)/studio/[workspace]/(workflow)/canvas/canvas-flow';
import { createCanvasFixture, type CanvasReadResult } from './canvas-port';

const observers: Array<{
  callback: ResizeObserverCallback;
  elements: Set<Element>;
}> = [];
let mobile = false;

beforeEach(() => {
  observers.length = 0;
  mobile = false;
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(max-width: 767px)' && mobile,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => true,
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      readonly record: (typeof observers)[number];
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, elements: new Set() };
        observers.push(this.record);
      }
      observe(element: Element) {
        this.record.elements.add(element);
      }
      disconnect() {
        this.record.elements.clear();
      }
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function resize(element: Element, width: number, height: number): void {
  act(() => {
    for (const observer of observers) {
      if (!observer.elements.has(element)) continue;
      observer.callback(
        [{ target: element, contentRect: new DOMRect(0, 0, width, height) } as ResizeObserverEntry],
        {} as ResizeObserver,
      );
    }
  });
}

function flowRoot(): HTMLElement {
  const root = screen.getByRole('region', { name: 'Campaign plan' }).parentElement;
  if (root === null) throw new Error('The campaign plan root is missing.');
  return root;
}

describe('CanvasFlow responsive navigation and late worker loading', () => {
  it('measures the available layout before mounting a worker graph or its rail', async () => {
    await act(async () => {
      render(
        <CanvasFlow
          dataMode="worker"
          readPort={{ read: () => Promise.resolve({ type: 'ok', model: createCanvasFixture() }) }}
          workspace="workspace-fixture"
        />,
      );
    });
    expect(screen.queryByTestId('canvas-surface')).toBeNull();
    const root = document.getElementById('main-content');
    if (root === null) throw new Error('The campaign plan root is missing.');
    expect(root.getAttribute('data-canvas-state')).toBe('loading');

    resize(root, 375, 700);
    expect(await screen.findByTestId('canvas-surface')).toBeTruthy();
    expect(root.getAttribute('data-canvas-layout')).toBe('drawer');
    expect(document.getElementById('canvas-navigation-rail')?.hasAttribute('inert')).toBe(true);
  });

  it('observes the graph surface after a delayed worker read and fits its measured size', async () => {
    let resolveRead: ((result: CanvasReadResult) => void) | undefined;
    const pending = new Promise<CanvasReadResult>((resolve) => {
      resolveRead = resolve;
    });
    render(
      <CanvasFlow
        dataMode="worker"
        readPort={{ read: () => pending }}
        workspace="workspace-fixture"
      />,
    );
    expect(screen.queryByTestId('canvas-surface')).toBeNull();
    const root = document.getElementById('main-content');
    if (root === null) throw new Error('The campaign plan root is missing.');
    resize(root, 520, 760);
    await act(async () => resolveRead?.({ type: 'ok', model: createCanvasFixture() }));
    const surface = await screen.findByTestId('canvas-surface');
    expect(observers.some((observer) => observer.elements.has(surface))).toBe(true);
    resize(surface, 520, 480);
    fireEvent.click(screen.getByRole('button', { name: /^Fit$/u }));
    const graph = screen.getByTestId('graph-plane');
    const model = createCanvasFixture();
    const zoom = Math.min(1, Math.max(0.12, Math.min(488 / model.width, 448 / model.height)));
    expect(graph.style.transform).toContain(`scale(${String(zoom)})`);
  });

  it('keeps the outline and comment draft in one drawer with Escape focus recovery', () => {
    render(<CanvasFlow dataMode="preview" workspace="lumen-skin" />);
    resize(flowRoot(), 520, 760);
    const trigger = screen.getByRole('button', { name: 'Outline and comments' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    act(() => trigger.focus());
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const close = screen.getByRole('button', { name: 'Close Plan outline and comments' });
    expect(document.activeElement).toBe(close);
    expect(screen.getByRole('heading', { name: 'Graph outline' })).toBeTruthy();
    const comment = screen.getByRole('textbox', { name: 'Add a draft comment' });
    fireEvent.change(comment, { target: { value: 'Keep this local draft through closing.' } });
    act(() => comment.focus());
    fireEvent.keyDown(comment, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(document.getElementById('canvas-navigation-rail')?.hasAttribute('inert')).toBe(true);
    fireEvent.click(trigger);
    expect(
      (screen.getByRole('textbox', { name: 'Add a draft comment' }) as HTMLTextAreaElement).value,
    ).toBe('Keep this local draft through closing.');
    expect(document.querySelectorAll('#outline-title')).toHaveLength(1);
  });

  it('explains mobile graph editing while leaving outline navigation and comments available', () => {
    mobile = true;
    render(<CanvasFlow dataMode="preview" workspace="lumen-skin" />);
    resize(flowRoot(), 375, 700);
    expect(
      (screen.getByRole('button', { name: 'Validate graph' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Checkpoint drafts' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Plan editing needs a desktop/u)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open this plan on a desktop' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Outline and comments' }));
    expect(screen.getByRole('textbox', { name: 'Add a draft comment' })).toBeTruthy();
    const parameters = screen.getByRole('group', { name: 'Plan parameters' });
    expect((parameters as HTMLFieldSetElement).disabled).toBe(true);
  });
});
