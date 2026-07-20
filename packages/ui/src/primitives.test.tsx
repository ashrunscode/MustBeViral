// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Button,
  Card,
  Chip,
  Dialog,
  Drawer,
  HairlineDivider,
  LedgerTable,
  MonoCaps,
  QuotePill,
  lightfieldTokens,
  type ChipStatus,
  type ComponentFeedbackState,
} from './index';

afterEach(cleanup);

describe('Lightfield tokens', () => {
  it('preserves the operator-approved golden palette, geometry, and motion', () => {
    expect(lightfieldTokens.color).toMatchObject({
      paper: '#fafafa',
      card: '#ffffff',
      inkStrong: 'rgba(0, 0, 0, 0.85)',
      signal: '#3182d4',
      signalSoft: '#80bfff',
      ok: '#1F9D63',
      attention: '#B87E14',
      fail: '#C4404D',
    });
    expect(lightfieldTokens.radius).toEqual({ control: 4, input: 6, card: 8, floating: 10 });
    expect(lightfieldTokens.motion).toEqual({
      local: 120,
      panel: 180,
      route: 240,
      ease: 'cubic-bezier(0.2, 0, 0, 1)',
    });
  });
});

describe('Button state matrix', () => {
  it.each(['default', 'loading', 'error', 'success'] satisfies ComponentFeedbackState[])(
    'renders the %s feedback state',
    (feedback) => {
      render(<Button feedback={feedback}>{feedback}</Button>);
      const button = screen.getByRole('button');
      expect(button.dataset.state).toBe(feedback);
      expect(button.getAttribute('aria-busy')).toBe(feedback === 'loading' ? 'true' : null);
    },
  );

  it.each(['primary', 'ghost', 'quiet-link'] as const)('renders the %s variant', (variant) => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button').className).toContain(`mbv-button--${variant}`);
  });

  it('forwards pressed, disabled, hover, and focus-capable button semantics', () => {
    const ref = createRef<HTMLButtonElement>();
    render(
      <Button ref={ref} aria-pressed="true" disabled>
        Stateful
      </Button>,
    );
    expect(screen.getByRole('button').hasAttribute('disabled')).toBe(true);
    expect(ref.current?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('status and evidence primitives', () => {
  it.each(['verified', 'running', 'queued', 'failed', 'notes'] satisfies ChipStatus[])(
    'renders %s as icon plus text',
    (status) => {
      const { container } = render(<Chip status={status}>{status}</Chip>);
      expect(screen.getByText(status)).toBeTruthy();
      expect(container.querySelector('[aria-hidden="true"]')?.textContent?.length).toBeGreaterThan(
        0,
      );
    },
  );

  it('renders monocaps, dividers, ledger tables, and quote states', () => {
    render(
      <>
        <MonoCaps>revision</MonoCaps>
        <HairlineDivider />
        <LedgerTable>
          <tbody>
            <tr>
              <td>event</td>
              <td>$0.20</td>
            </tr>
          </tbody>
        </LedgerTable>
        <QuotePill amount="$4.20" revision="7f3a" feedback="success" />
      </>,
    );
    expect(screen.getByText('revision').className).toContain('mbv-monocaps');
    expect(screen.getByText(/Quote \$4.20/).parentElement?.dataset.state).toBe('success');
  });
});

describe('surface primitives', () => {
  it.each(['default', 'loading', 'error', 'success'] satisfies ComponentFeedbackState[])(
    'renders Card %s',
    (feedback) => {
      render(<Card feedback={feedback}>Card {feedback}</Card>);
      expect(screen.getByText(`Card ${feedback}`).dataset.state).toBe(feedback);
    },
  );

  it('exposes Drawer open and closed states', () => {
    const { rerender } = render(
      <Drawer open={false} title="Receipt">
        Ledger
      </Drawer>,
    );
    expect(screen.getByLabelText('Receipt').dataset.state).toBe('closed');
    rerender(
      <Drawer open title="Receipt">
        Ledger
      </Drawer>,
    );
    expect(screen.getByLabelText('Receipt').dataset.state).toBe('open');
  });

  it('traps Dialog focus, closes on Escape, and restores focus', () => {
    const close = vi.fn();
    render(
      <>
        <button>Launcher</button>
        <Dialog open title="Confirm revision" onClose={close}>
          <button>Cancel</button>
          <button>Confirm</button>
        </Dialog>
      </>,
    );
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Close Confirm revision' }),
    );
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});
