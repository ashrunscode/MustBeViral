declare const integerMicrosBrand: unique symbol;
declare const tenantContextBrand: unique symbol;

export type IntegerMicros = number & { readonly [integerMicrosBrand]: true };

export interface TenantContext {
  readonly workspaceId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly [tenantContextBrand]: true;
}

export interface LedgerDraftEntry {
  readonly accountCode:
    'funding_clearing' | 'wallet_available' | 'wallet_reserved' | 'usage_expense';
  readonly direction: 'debit' | 'credit';
  readonly amountMicros: IntegerMicros;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function integerMicros(value: number): IntegerMicros {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError('Money must be a non-negative safe integer number of USD micros');
  }
  return value as IntegerMicros;
}

export function tenantContext(input: {
  workspaceId: string;
  actorId: string;
  requestId: string;
}): TenantContext {
  if (!uuidPattern.test(input.workspaceId) || !uuidPattern.test(input.actorId)) {
    throw new TypeError('Tenant context requires UUID workspace and actor identifiers');
  }
  if (input.requestId.length < 1 || input.requestId.length > 200) {
    throw new TypeError('Tenant context requires a request ID between 1 and 200 characters');
  }
  return Object.freeze({ ...input }) as TenantContext;
}

export function isBalancedLedgerEntries(entries: readonly LedgerDraftEntry[]): boolean {
  if (entries.length < 2) {
    return false;
  }
  const balance = entries.reduce((total, entry) => {
    integerMicros(entry.amountMicros);
    return total + (entry.direction === 'credit' ? entry.amountMicros : -entry.amountMicros);
  }, 0);
  return Number.isSafeInteger(balance) && balance === 0;
}

export function assertBalancedLedgerEntries(
  entries: readonly LedgerDraftEntry[],
): asserts entries is readonly [LedgerDraftEntry, LedgerDraftEntry, ...LedgerDraftEntry[]] {
  if (!isBalancedLedgerEntries(entries)) {
    throw new RangeError('Ledger transaction must contain at least two entries that sum to zero');
  }
}

export function assertQuoteWindow(createdAt: Date, expiresAt: Date): void {
  if (expiresAt.getTime() - createdAt.getTime() !== 15 * 60 * 1000) {
    throw new RangeError('Quote expiry must be exactly 15 minutes after creation');
  }
}
