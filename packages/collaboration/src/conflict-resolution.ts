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

/**
 * Identity of the draft for one node field. The JSON array encoding is injective: two different
 * `(nodeId, fieldPath)` pairs never produce the same key, whatever characters either contains. A
 * joined string such as `${nodeId}::${fieldPath}` is not, because node `n` with field
 * `1::parameters.prompt` and node `n::1` with field `parameters.prompt` spell the same key.
 */
export function textDraftKey(nodeId: string, fieldPath: string): string {
  return JSON.stringify([nodeId, fieldPath]);
}

/**
 * Identity of a lease: one node held by one actor. Like `textDraftKey` this JSON array encoding is
 * injective, so two different `(nodeId, actorId)` pairs never produce the same id. The earlier
 * joined string `lease-${nodeId}-${actorId}` was not: node `x` held by `a-b` and node `x-a` held by
 * `b` both spelled `lease-x-a-b`. The collaboration Worker derives this id itself from the requested
 * node and the ticket-bound actor and never stores a lease under a client-chosen id.
 */
export function leaseIdForActor(nodeId: string, actorId: string): string {
  return JSON.stringify(['lease', nodeId, actorId]);
}

/**
 * The joined lease id that clients released before the injective encoding. The Worker still
 * accepts it, but only compared against the calling actor's own node and id, where it is
 * unambiguous: with the actor fixed, prefix and suffix are fixed, so the string determines the node.
 */
export function legacyLeaseIdForActor(nodeId: string, actorId: string): string {
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
