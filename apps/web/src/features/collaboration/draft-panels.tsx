'use client';

import { MonoCaps } from '@mustbeviral/ui';

import type { CollaborationSnapshot } from '@mustbeviral/collaboration';

import styles from './collaboration-panel.module.css';
import {
  CollaborativeTextField,
  canvasDraftFieldsForNode,
  draftIdForField,
  reviewDraftFieldsForAnchor,
} from './collaborative-text-field';

export function NodeConfigDraftPanel({
  actorId,
  localDrafts,
  nodeId,
  nodeKind,
  nodeLabel,
  onAcquireLease,
  onChange,
  onReleaseLease,
  onSyncDraft,
  snapshot,
}: Readonly<{
  actorId: string;
  localDrafts: Readonly<Record<string, string>>;
  nodeId: string | null;
  nodeKind?: string | undefined;
  nodeLabel: string;
  onAcquireLease: (nodeId: string) => void;
  onChange: (fieldPath: string, value: string) => void;
  onReleaseLease: (nodeId: string) => void;
  onSyncDraft: (input: { nodeId: string; fieldPath: string; body: string }) => void;
  snapshot: CollaborationSnapshot | null;
}>) {
  if (nodeId === null || nodeKind === undefined) {
    return (
      <section className={styles.draftPanel} aria-label="Collaborative text drafts">
        <MonoCaps>Draft text</MonoCaps>
        <p className={styles.commentEmpty}>Select a node to edit collaborative draft text.</p>
      </section>
    );
  }

  const fields = canvasDraftFieldsForNode(nodeId, nodeKind);
  return (
    <section className={styles.draftPanel} aria-label="Collaborative text drafts">
      <div className={styles.commentPanelHeader}>
        <div>
          <MonoCaps>Draft text</MonoCaps>
          <h3>{nodeLabel}</h3>
        </div>
        <span>{String(fields.length)} fields</span>
      </div>
      <div className={styles.draftFieldStack}>
        {fields.map((field) => (
          <CollaborativeTextField
            key={field.fieldPath}
            actorId={actorId}
            fieldLabel={field.label}
            fieldPath={field.fieldPath}
            localValue={localDrafts[field.fieldPath] ?? ''}
            nodeId={nodeId}
            nodeKind={nodeKind}
            placeholder={field.placeholder}
            snapshot={snapshot}
            onAcquireLease={onAcquireLease}
            onReleaseLease={onReleaseLease}
            onChange={(value) => onChange(field.fieldPath, value)}
            onSyncDraft={onSyncDraft}
          />
        ))}
      </div>
    </section>
  );
}

export function ReviewDraftPanel({
  actorId,
  anchorId,
  anchorLabel,
  localDrafts,
  onAcquireLease,
  onChange,
  onReleaseLease,
  onSyncDraft,
  snapshot,
}: Readonly<{
  actorId: string;
  anchorId: string | null;
  anchorLabel: string;
  localDrafts: Readonly<Record<string, string>>;
  onAcquireLease: (nodeId: string) => void;
  onChange: (fieldPath: string, value: string) => void;
  onReleaseLease: (nodeId: string) => void;
  onSyncDraft: (input: { nodeId: string; fieldPath: string; body: string }) => void;
  snapshot: CollaborationSnapshot | null;
}>) {
  if (anchorId === null) {
    return null;
  }
  const fields = reviewDraftFieldsForAnchor();
  return (
    <section className={styles.draftPanel} aria-label="Collaborative review drafts">
      <div className={styles.commentPanelHeader}>
        <div>
          <MonoCaps>Review drafts</MonoCaps>
          <h3>{anchorLabel}</h3>
        </div>
      </div>
      <div className={styles.draftFieldStack}>
        {fields.map((field) => (
          <CollaborativeTextField
            key={field.fieldPath}
            actorId={actorId}
            fieldLabel={field.label}
            fieldPath={field.fieldPath}
            localValue={localDrafts[field.fieldPath] ?? ''}
            nodeId={anchorId}
            placeholder={field.placeholder}
            requiresLease={false}
            snapshot={snapshot}
            onAcquireLease={onAcquireLease}
            onReleaseLease={onReleaseLease}
            onChange={(value) => onChange(field.fieldPath, value)}
            onSyncDraft={onSyncDraft}
          />
        ))}
      </div>
    </section>
  );
}

export { draftIdForField };
