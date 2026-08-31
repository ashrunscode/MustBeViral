import type { CollaborationActor, EditLease, TextDraft } from './protocol';

export type TextDraftUpsertVerdict = 'accepted' | 'rejected_lease' | 'rejected_stale';

export function leaseForNode(
  leases: readonly EditLease[],
  nodeId: string,
  nowMs = Date.now(),
): EditLease | undefined {
  return leases.find((lease) => {
    if (lease.node_id !== nodeId) return false;
    const expiresMs = Date.parse(lease.expires_at);
    return !Number.isNaN(expiresMs) && expiresMs > nowMs;
  });
}

export function textDraftKey(nodeId: string, fieldPath: string): string {
  return `${nodeId}::${fieldPath}`;
}

export function leaseIdForActor(nodeId: string, actorId: string): string {
  return `lease-${nodeId}-${actorId}`;
}

export function compareTextDrafts(left: TextDraft, right: TextDraft): number {
  const leftMs = Date.parse(left.updated_at);
  const rightMs = Date.parse(right.updated_at);
  if (leftMs !== rightMs) return leftMs - rightMs;
  return left.author.actor_id.localeCompare(right.author.actor_id);
}

export function evaluateTextDraftUpsert(input: {
  readonly incoming: TextDraft;
  readonly existing: TextDraft | undefined;
  readonly lease: EditLease | undefined;
  readonly actorId: string;
}): TextDraftUpsertVerdict {
  if (input.lease !== undefined && input.lease.holder.actor_id !== input.actorId) {
    return 'rejected_lease';
  }
  if (input.existing === undefined) return 'accepted';
  if (compareTextDrafts(input.incoming, input.existing) >= 0) return 'accepted';
  return 'rejected_stale';
}

export function leaseAcquireVerdict(input: {
  readonly existing: EditLease | undefined;
  readonly holder: CollaborationActor;
}): 'accepted' | 'contested' {
  if (input.existing === undefined) return 'accepted';
  if (input.existing.holder.actor_id === input.holder.actor_id) return 'accepted';
  return 'contested';
}
