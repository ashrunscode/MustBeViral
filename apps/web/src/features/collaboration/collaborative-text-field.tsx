'use client';

import {
  leaseForNode,
  requiresEditLease,
  textDraftKey,
  type CollaborationSnapshot,
  type TextDraft,
} from '@mustbeviral/collaboration';
import { MonoCaps } from '@mustbeviral/ui';
import { useEffect, useId, useRef, useState } from 'react';

import styles from './collaboration-panel.module.css';

export type CollaborativeLeaseState = 'released' | 'held' | 'contested';

export function resolveLeaseState(input: {
  readonly snapshot: CollaborationSnapshot | null;
  readonly nodeId: string;
  readonly actorId: string;
  readonly requiresLease: boolean;
}): CollaborativeLeaseState {
  if (!input.requiresLease) return 'released';
  const lease =
    input.snapshot === null ? undefined : leaseForNode(input.snapshot.leases, input.nodeId);
  if (lease === undefined) return 'released';
  if (lease.holder.actor_id === input.actorId) return 'held';
  return 'contested';
}

export function textDraftForField(
  snapshot: CollaborationSnapshot | null,
  nodeId: string,
  fieldPath: string,
): TextDraft | undefined {
  if (snapshot === null) return undefined;
  return snapshot.text_drafts.find(
    (draft) => draft.node_id === nodeId && draft.field_path === fieldPath,
  );
}

const leaseStateCopy: Record<CollaborativeLeaseState, { label: string; description: string }> = {
  held: {
    label: 'Edit lease held',
    description: 'You can edit this field. Draft text syncs to collaborators.',
  },
  contested: {
    label: 'Edit lease contested',
    description: 'Another collaborator holds the edit lease. View the remote draft or retry.',
  },
  released: {
    label: 'Edit lease released',
    description: 'Focus to acquire an edit lease on expensive node configuration.',
  },
};

export function CollaborativeTextField({
  actorId,
  disabled = false,
  fieldLabel,
  fieldPath,
  localValue,
  nodeId,
  nodeKind,
  onAcquireLease,
  onChange,
  onReleaseLease,
  onSyncDraft,
  placeholder,
  requiresLease: requiresLeaseOverride,
  snapshot,
}: Readonly<{
  actorId: string;
  disabled?: boolean;
  fieldLabel: string;
  fieldPath: string;
  localValue: string;
  nodeId: string;
  nodeKind?: string;
  onAcquireLease: (nodeId: string) => void;
  onChange: (value: string) => void;
  onReleaseLease: (nodeId: string) => void;
  onSyncDraft: (input: { nodeId: string; fieldPath: string; body: string }) => void;
  placeholder?: string;
  requiresLease?: boolean;
  snapshot: CollaborationSnapshot | null;
}>) {
  const fieldId = useId();
  const statusId = `${fieldId}-status`;
  const [focused, setFocused] = useState(false);
  const syncTimerRef = useRef<number | null>(null);
  const requiresLease =
    requiresLeaseOverride ?? (nodeKind === undefined ? true : requiresEditLease(nodeKind));
  const remoteDraft = textDraftForField(snapshot, nodeId, fieldPath);
  const leaseState = resolveLeaseState({
    snapshot,
    nodeId,
    actorId,
    requiresLease,
  });
  const readOnly =
    disabled || (requiresLease && leaseState !== 'held') || (leaseState === 'contested' && focused);

  useEffect(() => {
    return () => {
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  function handleFocus(): void {
    setFocused(true);
    if (requiresLease) onAcquireLease(nodeId);
  }

  function handleBlur(): void {
    setFocused(false);
    if (requiresLease) onReleaseLease(nodeId);
  }

  function handleChange(value: string): void {
    onChange(value);
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      onSyncDraft({ nodeId, fieldPath, body: value });
    }, 180);
  }

  const displayValue =
    leaseState === 'contested' && remoteDraft !== undefined && !focused
      ? remoteDraft.body
      : localValue;

  return (
    <div
      className={styles.collaborativeField}
      data-lease-state={leaseState}
      data-field-path={fieldPath}
    >
      <div className={styles.collaborativeFieldHeader}>
        <label htmlFor={fieldId}>{fieldLabel}</label>
        {requiresLease ? (
          <span
            className={styles.leaseBadge}
            role="status"
            aria-live="polite"
            aria-describedby={statusId}
            data-lease-state={leaseState}
          >
            {leaseStateCopy[leaseState].label}
          </span>
        ) : null}
      </div>
      <p className={styles.leaseHelp} id={statusId}>
        {requiresLease
          ? leaseStateCopy[leaseState].description
          : 'Draft text syncs to collaborators.'}
        {remoteDraft !== undefined && remoteDraft.author.actor_id !== actorId ? (
          <> Remote draft by {remoteDraft.author.display_name}.</>
        ) : null}
      </p>
      <textarea
        id={fieldId}
        className={styles.collaborativeTextarea}
        value={displayValue}
        readOnly={readOnly}
        aria-readonly={readOnly}
        aria-describedby={statusId}
        placeholder={placeholder}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={(event) => {
          if (!readOnly) handleChange(event.target.value);
        }}
      />
      {leaseState === 'contested' ? (
        <div className={styles.leaseActions}>
          <button
            type="button"
            className={styles.leaseRetry}
            onClick={() => onAcquireLease(nodeId)}
          >
            Retry lease
          </button>
          {remoteDraft !== undefined ? (
            <MonoCaps>Showing {remoteDraft.author.display_name}&apos;s draft</MonoCaps>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function canvasDraftFieldsForNode(
  nodeId: string,
  nodeKind: string,
): ReadonlyArray<{ fieldPath: string; label: string; placeholder: string }> {
  if (nodeKind === 'brief') {
    return [
      {
        fieldPath: 'parameters.product',
        label: 'Campaign product',
        placeholder: 'Draft the product truth collaborators should align on',
      },
      {
        fieldPath: 'parameters.notes',
        label: 'Brief notes',
        placeholder: 'Constraints, claims, and launch notes',
      },
    ];
  }
  if (requiresEditLease(nodeKind)) {
    return [
      {
        fieldPath: 'parameters.prompt',
        label: 'Generation prompt',
        placeholder: 'Draft the expensive node configuration prompt',
      },
      {
        fieldPath: 'parameters.notes',
        label: 'Configuration notes',
        placeholder: 'Capture tuning notes before checkpointing',
      },
    ];
  }
  return [
    {
      fieldPath: 'parameters.notes',
      label: 'Node notes',
      placeholder: 'Draft notes for this node',
    },
  ];
}

export function reviewDraftFieldsForAnchor(): ReadonlyArray<{
  fieldPath: string;
  label: string;
  placeholder: string;
}> {
  return [
    {
      fieldPath: 'accessibility_description',
      label: 'Accessibility description',
      placeholder: 'Describe this output before approval',
    },
    {
      fieldPath: 'review_notes',
      label: 'Review notes',
      placeholder: 'Draft review notes for collaborators',
    },
    {
      fieldPath: 'caption.primary_text',
      label: 'Caption draft',
      placeholder: 'Draft primary ad copy for this output',
    },
  ];
}

export function draftIdForField(nodeId: string, fieldPath: string): string {
  return textDraftKey(nodeId, fieldPath);
}
