// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/studio',
  useSearchParams: () => new URLSearchParams(),
}));

import { PlatformFrame } from './platform-frame';

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true })),
  );
});
afterEach(() => vi.unstubAllGlobals());

function openMenu() {
  const toggle = screen.getByRole('button', { name: 'Menu' });
  fireEvent.click(toggle);
  const destination = screen.getByRole('link', { name: 'Switch studio' });
  destination.focus();
  return { toggle, destination };
}

describe('mobile navigation keyboard recovery', () => {
  it('closes with Escape from a navigation link and returns focus to the menu button', () => {
    render(
      <PlatformFrame>
        <p>Saved work</p>
      </PlatformFrame>,
    );
    const { toggle, destination } = openMenu();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(destination, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });

  it('leaves ordinary navigation keys alone', () => {
    render(
      <PlatformFrame>
        <p>Saved work</p>
      </PlatformFrame>,
    );
    const { toggle, destination } = openMenu();
    fireEvent.keyDown(destination, { key: 'ArrowDown' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(destination);
  });

  it('does not move desktop focus to the hidden mobile trigger after resizing', () => {
    render(
      <PlatformFrame>
        <p>Saved work</p>
      </PlatformFrame>,
    );
    const { toggle, destination } = openMenu();
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false })),
    );
    fireEvent.keyDown(destination, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(destination);
  });

  it('does not consume Escape already handled by a child control', () => {
    render(
      <PlatformFrame>
        <p>Saved work</p>
      </PlatformFrame>,
    );
    const { toggle, destination } = openMenu();
    destination.addEventListener('keydown', (event) => event.preventDefault());
    fireEvent.keyDown(destination, { key: 'Escape' });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(destination);
  });
});
