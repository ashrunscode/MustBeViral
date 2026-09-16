'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import {
  forwardRef,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type FocusEvent,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type TableHTMLAttributes,
} from 'react';

export type ComponentFeedbackState = 'default' | 'loading' | 'error' | 'success';

function classes(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export type ButtonVariant = 'primary' | 'ghost' | 'quiet-link';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly feedback?: ComponentFeedbackState;
  readonly loadingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    feedback = 'default',
    loadingLabel = 'Loading',
    type = 'button',
    variant = 'ghost',
    ...props
  },
  ref,
) {
  const loading = feedback === 'loading';
  return (
    <button
      ref={ref}
      type={type}
      className={classes('mbv-button', `mbv-button--${variant}`, className)}
      data-state={disabled ? 'disabled' : feedback}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="mbv-state-mark" aria-hidden="true">
          ↻
        </span>
      ) : null}
      <span>{loading ? loadingLabel : children}</span>
    </button>
  );
});

export type ChipStatus = 'verified' | 'running' | 'queued' | 'failed' | 'notes';

const chipIcons: Record<ChipStatus, string> = {
  verified: '✓',
  running: '→',
  queued: '○',
  failed: '!',
  notes: '◆',
};

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  readonly icon?: ReactNode;
  readonly status: ChipStatus;
}

export function Chip({ children, className, icon, status, ...props }: ChipProps) {
  return (
    <span
      className={classes('mbv-chip', `mbv-chip--${status}`, className)}
      data-status={status}
      {...props}
    >
      <span className="mbv-chip__icon" aria-hidden="true">
        {icon ?? chipIcons[status]}
      </span>
      <span>{children}</span>
    </span>
  );
}

export function MonoCaps({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={classes('mbv-monocaps', className)} {...props} />;
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  readonly feedback?: ComponentFeedbackState;
  readonly interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, feedback = 'default', interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={classes('mbv-card', interactive && 'mbv-card--interactive', className)}
      data-state={feedback}
      {...props}
    />
  );
});

export function HairlineDivider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return <hr className={classes('mbv-hairline', className)} {...props} />;
}

export function LedgerTable({ className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <table className={classes('mbv-ledger', className)} {...props} />;
}

export interface QuotePillProps extends HTMLAttributes<HTMLDivElement> {
  readonly amount: string;
  readonly revision: string;
  readonly feedback?: ComponentFeedbackState;
}

export function QuotePill({
  amount,
  className,
  feedback = 'default',
  revision,
  ...props
}: QuotePillProps) {
  return (
    <div className={classes('mbv-quote-pill', className)} data-state={feedback} {...props}>
      <MonoCaps>Quote {amount}</MonoCaps>
      <span aria-hidden="true">·</span>
      <MonoCaps>Rev {revision}</MonoCaps>
    </div>
  );
}

export interface DrawerProps extends HTMLAttributes<HTMLElement> {
  readonly open: boolean;
  readonly title: string;
  readonly onClose?: () => void;
}

/**
 * Non-modal side panel. It never takes focus on its own; it only closes on Escape from inside and,
 * when it closes with focus inside, hands focus back to where it was before focus entered it.
 */
export function Drawer({
  children,
  className,
  onClose,
  onFocus,
  onKeyDown,
  open,
  title,
  ...props
}: DrawerProps) {
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(open);

  useLayoutEffect(() => {
    const closed = wasOpenRef.current && !open;
    wasOpenRef.current = open;
    if (!closed) return;
    const drawer = drawerRef.current;
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    if (drawer === null || !drawer.contains(document.activeElement)) return;
    if (target !== null && target.isConnected && !drawer.contains(target)) target.focus();
  }, [open]);

  function handleFocus(event: FocusEvent<HTMLElement>) {
    onFocus?.(event);
    const previous = event.relatedTarget;
    if (previous instanceof Node && event.currentTarget.contains(previous)) return;
    returnFocusRef.current = previous instanceof HTMLElement ? previous : null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== 'Escape' || !open || onClose === undefined) return;
    event.preventDefault();
    onClose();
  }

  return (
    <aside
      ref={drawerRef}
      className={classes('mbv-drawer', className)}
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      aria-label={title}
      {...props}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
    >
      <div className="mbv-drawer__header">
        <h2>{title}</h2>
        {onClose ? (
          <Button variant="quiet-link" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </Button>
        ) : null}
      </div>
      {children}
    </aside>
  );
}

export interface DialogProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}

/**
 * Return-focus target of the dialog that closed most recently and has not restored focus yet. A
 * dialog that opens in the same interaction (one dialog's action closes it and opens another)
 * finds focus on <body>, because the pressed button was removed, so it inherits this target and
 * focus still returns to the original trigger once the second dialog closes.
 */
let pendingReturnFocus: HTMLElement | null = null;

/**
 * Modal dialog on Radix Dialog: focus trap, Escape, background hidden from assistive technology,
 * and body scroll lock. Pressing the backdrop does not close it, so a half-filled form survives a
 * stray click. Only Close, Escape, or the consumer's own actions call `onClose`.
 */
export function Dialog({ children, description, onClose, open, title }: DialogProps) {
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    return () => {
      pendingReturnFocus = returnFocusRef.current;
    };
  }, [open]);

  function captureReturnFocus() {
    const active = document.activeElement;
    returnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : pendingReturnFocus;
    pendingReturnFocus = null;
  }

  function restoreFocus(event: Event) {
    // Radix would focus a Dialog.Trigger here; this API has none, so focus is restored explicitly.
    event.preventDefault();
    const target = returnFocusRef.current;
    returnFocusRef.current = null;
    // A dialog that opened meanwhile inherited the target and will restore it when it closes.
    if (target === null || pendingReturnFocus !== target) return;
    pendingReturnFocus = null;
    if (target.isConnected) target.focus();
  }

  return (
    <RadixDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="mbv-dialog-backdrop" role="presentation">
          <RadixDialog.Content
            className="mbv-dialog"
            aria-modal="true"
            onOpenAutoFocus={captureReturnFocus}
            onCloseAutoFocus={restoreFocus}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <div className="mbv-dialog__header">
              <RadixDialog.Title>{title}</RadixDialog.Title>
              <Button variant="quiet-link" onClick={onClose} aria-label={`Close ${title}`}>
                Close
              </Button>
            </div>
            {description ? <RadixDialog.Description>{description}</RadixDialog.Description> : null}
            {children}
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
