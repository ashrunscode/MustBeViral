// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, createRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
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

afterEach(async () => {
  cleanup();
  // Overlay focus management may schedule focus restoration on a macrotask after unmount; let it
  // settle so it cannot move focus inside the next test.
  await new Promise((resolve) => setTimeout(resolve, 0));
});

function focusedElement(): HTMLElement {
  const element = document.activeElement;
  if (!(element instanceof HTMLElement)) throw new Error('Expected a focused HTML element.');
  return element;
}

/** Lets macrotask-scheduled work (outside-press listeners, focus restoration) run. */
async function settle() {
  await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
}

function focus(element: HTMLElement) {
  act(() => {
    element.focus();
  });
}

/**
 * Types like a keyboard does: every keystroke goes to whatever element holds focus at that moment,
 * and only a focused text input receives the character.
 */
function typeCharacters(text: string) {
  for (const character of text) {
    const target = focusedElement();
    fireEvent.keyDown(target, { key: character });
    if (target instanceof HTMLInputElement) {
      fireEvent.change(target, { target: { value: `${target.value}${character}` } });
    }
    fireEvent.keyUp(target, { key: character });
  }
}

function PublishHarness() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open publisher
      </button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Publish a Skill version"
        description="Publishing creates a new immutable version."
      >
        <label>
          <span>Skill name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <button type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </Dialog>
    </>
  );
}

/** One dialog's action closes it and opens the next, like issuing an API key. */
function ChainedHarness() {
  const [createOpen, setCreateOpen] = useState(false);
  const [secretOpen, setSecretOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setCreateOpen(true)}>
        Create API key
      </button>
      <Dialog open={createOpen} title="Create scoped API key" onClose={() => setCreateOpen(false)}>
        <button
          type="button"
          onClick={() => {
            setSecretOpen(true);
            setCreateOpen(false);
          }}
        >
          Issue key
        </button>
      </Dialog>
      <Dialog open={secretOpen} title="Copy your API key now" onClose={() => setSecretOpen(false)}>
        <button type="button" onClick={() => setSecretOpen(false)}>
          I saved the secret
        </button>
      </Dialog>
    </>
  );
}

function DrawerHarness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Show QA findings
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Hide QA findings
      </button>
      <Drawer open={open} title="QA findings" onClose={() => setOpen(false)}>
        <button type="button">Inspect finding</button>
      </Drawer>
    </>
  );
}

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
    fireEvent.keyDown(focusedElement(), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Confirm' }));
    fireEvent.keyDown(focusedElement(), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });
});

describe('Dialog', () => {
  it('keeps focus and every character in a controlled input while the parent re-renders per keystroke', () => {
    render(<PublishHarness />);
    const trigger = screen.getByRole('button', { name: 'Open publisher' });
    focus(trigger);
    fireEvent.click(trigger);
    const input = screen.getByRole('textbox', { name: 'Skill name' });
    focus(input);

    typeCharacters('launch-copy');

    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).value).toBe('launch-copy');
  });

  it('calls onClose when Escape is pressed inside the dialog', () => {
    const close = vi.fn();
    render(
      <Dialog open title="Confirm revision" onClose={close}>
        <button type="button">Confirm</button>
      </Dialog>,
    );
    fireEvent.keyDown(focusedElement(), { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('returns focus to the trigger after it closes', async () => {
    render(<PublishHarness />);
    const trigger = screen.getByRole('button', { name: 'Open publisher' });
    focus(trigger);
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Publish a Skill version' });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(focusedElement(), { key: 'Escape' });

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await settle();
    expect(document.activeElement).toBe(trigger);
  });

  it('wraps Tab and Shift+Tab inside the dialog', () => {
    render(
      <>
        <button type="button">Launcher</button>
        <Dialog open title="Confirm revision" onClose={() => undefined}>
          <button type="button">Cancel</button>
          <button type="button">Confirm</button>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm revision' });
    const close = screen.getByRole('button', { name: 'Close Confirm revision' });
    const confirm = screen.getByRole('button', { name: 'Confirm' });

    focus(confirm);
    fireEvent.keyDown(focusedElement(), { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(focusedElement(), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm);
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('scrolls the control that Tab wraps to into view inside a scrolled dialog', () => {
    // The focus trap focuses with preventScroll; jsdom has no layout, so record the scroll request.
    const revealed: Array<{ element: Element; options: unknown }> = [];
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value(this: Element, options: unknown) {
        revealed.push({ element: this, options });
      },
    });
    try {
      render(
        <>
          <button type="button">Launcher</button>
          <Dialog open title="Confirm revision" onClose={() => undefined}>
            <button type="button">Cancel</button>
            <button type="button">Confirm</button>
          </Dialog>
        </>,
      );
      const close = screen.getByRole('button', { name: 'Close Confirm revision' });
      const confirm = screen.getByRole('button', { name: 'Confirm' });
      focus(confirm);
      revealed.length = 0;

      fireEvent.keyDown(focusedElement(), { key: 'Tab' });

      expect(document.activeElement).toBe(close);
      expect(revealed).toEqual([
        { element: close, options: { block: 'nearest', inline: 'nearest' } },
      ]);
    } finally {
      delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it('wires the title and description to aria-labelledby and aria-describedby', () => {
    render(
      <Dialog
        open
        title="Copy your API key now"
        description="This secret cannot be shown again."
        onClose={() => undefined}
      >
        <button type="button">I saved the secret</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', {
      name: 'Copy your API key now',
      description: 'This secret cannot be shown again.',
    });
    const title = document.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    const description = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
    expect(title?.tagName).toBe('H2');
    expect(title?.textContent).toBe('Copy your API key now');
    expect(description?.textContent).toBe('This secret cannot be shown again.');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('omits aria-describedby when no description is given', () => {
    render(
      <Dialog open title="Confirm revision" onClose={() => undefined}>
        <button type="button">Confirm</button>
      </Dialog>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Confirm revision' }).hasAttribute('aria-describedby'),
    ).toBe(false);
  });

  it('keeps the backdrop, panel, header, and title structure the stylesheet targets', () => {
    render(
      <Dialog
        open
        title="Confirm revision"
        description="Check the quote."
        onClose={() => undefined}
      >
        <button type="button">Confirm</button>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Confirm revision' });
    expect(dialog.classList.contains('mbv-dialog')).toBe(true);
    expect(dialog.parentElement?.classList.contains('mbv-dialog-backdrop')).toBe(true);
    const header = dialog.firstElementChild;
    expect(header?.classList.contains('mbv-dialog__header')).toBe(true);
    expect(header?.querySelector('h2')?.textContent).toBe('Confirm revision');
    expect(dialog.querySelector(':scope > p')?.textContent).toBe('Check the quote.');
  });

  it('hides content outside the dialog from assistive technology only while open', () => {
    const { rerender } = render(
      <>
        <main>
          <button type="button">Launcher</button>
        </main>
        <Dialog open title="Confirm revision" onClose={() => undefined}>
          <button type="button">Confirm</button>
        </Dialog>
      </>,
    );
    expect(screen.queryByRole('button', { name: 'Launcher' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Launcher', hidden: true })).toBeTruthy();

    rerender(
      <>
        <main>
          <button type="button">Launcher</button>
        </main>
        <Dialog open={false} title="Confirm revision" onClose={() => undefined}>
          <button type="button">Confirm</button>
        </Dialog>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Launcher' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('locks body scroll while open and releases it after close', () => {
    const { rerender } = render(
      <Dialog open title="Confirm revision" onClose={() => undefined}>
        <button type="button">Confirm</button>
      </Dialog>,
    );
    expect(getComputedStyle(document.body).overflow).toBe('hidden');

    rerender(
      <Dialog open={false} title="Confirm revision" onClose={() => undefined}>
        <button type="button">Confirm</button>
      </Dialog>,
    );
    expect(getComputedStyle(document.body).overflow).not.toBe('hidden');
  });

  it('stays open when the backdrop is pressed, as before', async () => {
    const close = vi.fn();
    render(
      <Dialog open title="Confirm revision" onClose={close}>
        <button type="button">Confirm</button>
      </Dialog>,
    );
    const backdrop = screen.getByRole('dialog', { name: 'Confirm revision' }).parentElement;
    if (backdrop === null) throw new Error('Expected a backdrop.');
    // Outside-press listeners attach on the next macrotask after opening; press after that.
    await settle();

    fireEvent.pointerDown(backdrop, { button: 0, pointerType: 'mouse' });
    fireEvent.mouseDown(backdrop, { button: 0 });
    fireEvent.pointerUp(backdrop, { button: 0, pointerType: 'mouse' });
    fireEvent.mouseUp(backdrop, { button: 0 });
    fireEvent.click(backdrop, { button: 0 });
    await settle();

    expect(close).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Confirm revision' })).toBeTruthy();
  });

  it('returns focus to the first trigger when one dialog closes and opens the next', async () => {
    render(<ChainedHarness />);
    const trigger = screen.getByRole('button', { name: 'Create API key' });
    focus(trigger);
    fireEvent.click(trigger);
    const issue = screen.getByRole('button', { name: 'Issue key' });
    focus(issue);

    fireEvent.click(issue);
    const secretDialog = screen.getByRole('dialog', { name: 'Copy your API key now' });
    await waitFor(() => expect(secretDialog.contains(document.activeElement)).toBe(true));
    await settle();
    expect(secretDialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'I saved the secret' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await settle();
    expect(document.activeElement).toBe(trigger);
  });

  it('does not flash focus onto the page behind while the next dialog is open', async () => {
    render(<ChainedHarness />);
    const trigger = screen.getByRole('button', { name: 'Create API key' });
    focus(trigger);
    fireEvent.click(trigger);
    focus(screen.getByRole('button', { name: 'Issue key' }));
    const focusTargets: Element[] = [];
    const recordFocus = (event: FocusEvent) => {
      if (event.target instanceof Element) focusTargets.push(event.target);
    };
    document.addEventListener('focusin', recordFocus);

    try {
      fireEvent.click(screen.getByRole('button', { name: 'Issue key' }));
      const secretDialog = screen.getByRole('dialog', { name: 'Copy your API key now' });
      await settle();
      await settle();

      expect(secretDialog.contains(document.activeElement)).toBe(true);
      expect(focusTargets.length).toBeGreaterThan(0);
      expect(focusTargets.filter((target) => !secretDialog.contains(target))).toEqual([]);
    } finally {
      document.removeEventListener('focusin', recordFocus);
    }
  });

  it('returns focus to the trigger under React StrictMode', async () => {
    render(
      <StrictMode>
        <PublishHarness />
      </StrictMode>,
    );
    const trigger = screen.getByRole('button', { name: 'Open publisher' });
    focus(trigger);
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Publish a Skill version' });
    await settle();
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    await settle();
    expect(document.activeElement).toBe(trigger);
  });
});

describe('Drawer', () => {
  it('closes on Escape when focus is inside and ignores Escape pressed outside', () => {
    const close = vi.fn();
    render(
      <>
        <button type="button">Outside</button>
        <Drawer open title="QA findings" onClose={close}>
          <button type="button">Inspect finding</button>
        </Drawer>
      </>,
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Outside' }), { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();

    const inside = screen.getByRole('button', { name: 'Inspect finding' });
    focus(inside);
    fireEvent.keyDown(inside, { key: 'Enter' });
    expect(close).not.toHaveBeenCalled();
    fireEvent.keyDown(inside, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
  });

  it('leaves Escape to an inner widget or consumer handler that already handled it', () => {
    const close = vi.fn();
    const consumerKeyDown = vi.fn((event: ReactKeyboardEvent<HTMLElement>) => {
      const handledByConsumer =
        event.target instanceof HTMLElement && event.target.dataset.consumerEscape === 'true';
      if (event.key === 'Escape' && handledByConsumer) event.preventDefault();
    });
    render(
      <Drawer open title="QA findings" onClose={close} onKeyDown={consumerKeyDown}>
        <input
          aria-label="Filter findings"
          defaultValue="contrast"
          onKeyDown={(event) => {
            if (event.key === 'Escape' && event.currentTarget.value !== '') {
              event.preventDefault();
              event.currentTarget.value = '';
            }
          }}
        />
        <button type="button" data-consumer-escape="true">
          Pin finding
        </button>
        <button type="button">Inspect finding</button>
      </Drawer>,
    );

    const filter = screen.getByRole('textbox', { name: 'Filter findings' }) as HTMLInputElement;
    focus(filter);
    fireEvent.keyDown(filter, { key: 'Escape' });
    expect(filter.value).toBe('');
    expect(close).not.toHaveBeenCalled();

    const pin = screen.getByRole('button', { name: 'Pin finding' });
    focus(pin);
    fireEvent.keyDown(pin, { key: 'Escape' });
    expect(close).not.toHaveBeenCalled();

    const inside = screen.getByRole('button', { name: 'Inspect finding' });
    focus(inside);
    fireEvent.keyDown(inside, { key: 'Escape' });
    expect(consumerKeyDown).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledOnce();
  });

  it('returns focus to the element focused before focus entered the drawer when it closes', () => {
    render(<DrawerHarness />);
    const before = screen.getByRole('button', { name: 'Show QA findings' });
    const closeButton = screen.getByRole('button', { name: 'Close QA findings' });
    focus(before);
    focus(closeButton);

    fireEvent.click(closeButton);

    expect(screen.getByLabelText('QA findings').dataset.state).toBe('closed');
    expect(document.activeElement).toBe(before);
  });

  it('returns focus after an Escape close even when focus moved around inside the drawer', () => {
    render(<DrawerHarness />);
    const before = screen.getByRole('button', { name: 'Show QA findings' });
    const inside = screen.getByRole('button', { name: 'Inspect finding' });
    focus(before);
    focus(screen.getByRole('button', { name: 'Close QA findings' }));
    focus(inside);

    fireEvent.keyDown(inside, { key: 'Escape' });

    expect(screen.getByLabelText('QA findings').dataset.state).toBe('closed');
    expect(document.activeElement).toBe(before);
  });

  it('leaves focus alone when the drawer closes while focus is outside it', () => {
    render(<DrawerHarness />);
    const before = screen.getByRole('button', { name: 'Show QA findings' });
    const hide = screen.getByRole('button', { name: 'Hide QA findings' });
    focus(before);
    focus(screen.getByRole('button', { name: 'Inspect finding' }));
    focus(hide);

    fireEvent.click(hide);

    expect(screen.getByLabelText('QA findings').dataset.state).toBe('closed');
    expect(document.activeElement).toBe(hide);
  });

  it('does not take focus on mount or when rendered open by default', () => {
    render(<button type="button">Outside</button>);
    const outside = screen.getByRole('button', { name: 'Outside' });
    focus(outside);

    render(<DrawerHarness />);

    expect(document.activeElement).toBe(outside);
  });

  it('marks the closed state with data-state and aria-hidden', () => {
    const { rerender } = render(
      <Drawer open title="Receipt" onClose={() => undefined}>
        Ledger
      </Drawer>,
    );
    const drawer = screen.getByLabelText('Receipt');
    expect(drawer.dataset.state).toBe('open');
    expect(drawer.getAttribute('aria-hidden')).toBe('false');

    rerender(
      <Drawer open={false} title="Receipt" onClose={() => undefined}>
        Ledger
      </Drawer>,
    );
    expect(drawer.dataset.state).toBe('closed');
    expect(drawer.getAttribute('aria-hidden')).toBe('true');
    expect(drawer.classList.contains('mbv-drawer')).toBe(true);
  });
});
