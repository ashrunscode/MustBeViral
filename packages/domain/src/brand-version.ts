import type { RepresentativeAssertion } from './representative-extract';
import { knowledgeExpiryInstant } from './knowledge-expiry';

export const brandVersionStatuses = ['approved'] as const;
export type BrandVersionStatus = (typeof brandVersionStatuses)[number];

export function expiredOfferFieldKeys(
  assertions: readonly RepresentativeAssertion[],
  nowIso: string,
): readonly string[] {
  const now = knowledgeExpiryInstant(nowIso);
  if (now === null) throw new Error('Invalid review instant');
  return assertions
    .filter(
      (item) =>
        item.kind === 'offer' &&
        item.status !== 'unknown' &&
        item.ends_at !== null &&
        (knowledgeExpiryInstant(item.ends_at) === null ||
          knowledgeExpiryInstant(item.ends_at)! < now),
    )
    .map((item) => item.field_key);
}

export function contradictoryAssertionKeys(
  assertions: readonly RepresentativeAssertion[],
): readonly string[] {
  const current = assertions.filter((item) => item.status !== 'unknown');
  const keys: string[] = [];
  for (const item of current) {
    if (item.status === 'disputed') keys.push(`${item.kind}:${item.field_key}`);
    const conflict = current.find(
      (other) =>
        other.kind === item.kind &&
        other.field_key === item.field_key &&
        (other.value_text !== item.value_text ||
          (item.kind === 'offer' &&
            (other.ends_at === null ? null : knowledgeExpiryInstant(other.ends_at)) !==
              (item.ends_at === null ? null : knowledgeExpiryInstant(item.ends_at)))),
    );
    if (conflict) keys.push(`${item.kind}:${item.field_key}`);
  }
  return [...new Set(keys)];
}

export function approvalBlockReason(
  assertions: readonly RepresentativeAssertion[],
  nowIso: string,
): 'EXPIRED_OFFER' | 'CONTRADICTORY_KNOWLEDGE' | null {
  if (expiredOfferFieldKeys(assertions, nowIso).length > 0) return 'EXPIRED_OFFER';
  if (contradictoryAssertionKeys(assertions).length > 0) return 'CONTRADICTORY_KNOWLEDGE';
  return null;
}
