'use client';

import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
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

export function Card({
  className,
  feedback = 'default',
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={classes('mbv-card', interactive && 'mbv-card--interactive', className)}
      data-state={feedback}
      {...props}
    />
  );
}

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

export function Drawer({ children, className, onClose, open, title, ...props }: DrawerProps) {
  return (
    <aside
      className={classes('mbv-drawer', className)}
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      aria-label={title}
      {...props}
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

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface DialogProps {
  readonly children: ReactNode;
  readonly description?: string;
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
}

export function Dialog({ children, description, onClose, open, title }: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(focusableSelector);
    (focusable?.[0] ?? panel)?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const elements = [...panel.querySelectorAll<HTMLElement>(focusableSelector)];
      if (elements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="mbv-dialog-backdrop" role="presentation">
      <div
        ref={panelRef}
        className="mbv-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="mbv-dialog__header">
          <h2 id={titleId}>{title}</h2>
          <Button variant="quiet-link" onClick={onClose} aria-label={`Close ${title}`}>
            Close
          </Button>
        </div>
        {description ? <p id={descriptionId}>{description}</p> : null}
        {children}
      </div>
    </div>
  );
}
