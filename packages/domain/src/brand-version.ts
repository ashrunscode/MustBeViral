import type { RepresentativeAssertion } from './representative-extract';

export const brandVersionStatuses = ['approved'] as const;
export type BrandVersionStatus = (typeof brandVersionStatuses)[number];

export function expiredOfferFieldKeys(
  assertions: readonly RepresentativeAssertion[],
  nowIso: string,
): readonly string[] {
  return assertions
    .filter(
      (item) =>
        item.kind === 'offer' &&
        item.status !== 'unknown' &&
        item.ends_at !== null &&
        item.ends_at < nowIso,
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
        other.value_text !== item.value_text,
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
