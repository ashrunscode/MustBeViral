'use client';

import { useFormStatus } from 'react-dom';

/** A submit button that names what it is doing while its form action runs. */
export function PendingSubmit({
  className,
  label,
  pendingLabel,
}: Readonly<{ className: string; label: string; pendingLabel: string }>) {
  const { pending } = useFormStatus();
  return (
    <button aria-busy={pending || undefined} className={className} disabled={pending} type="submit">
      {pending ? pendingLabel : label}
    </button>
  );
}
