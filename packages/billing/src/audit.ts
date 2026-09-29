import type { LedgerEntryType } from './ledger';
import type { UsdMicros } from './money';

export type BillingAuditActorType = 'user' | 'system' | 'operator' | 'provider';

export interface BillingAuditEvent {
  readonly workspaceId: string;
  readonly actorType: BillingAuditActorType;
  readonly actorId: string | null;
  readonly action: `billing.${string}` | `ledger.${LedgerEntryType}`;
  readonly entityType: string;
  readonly entityId: string;
  readonly requestId: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface LedgerAuditEventInput {
  readonly workspaceId: string;
  readonly transactionId: string;
  readonly entryType: LedgerEntryType;
  readonly amountMicros: UsdMicros;
  readonly causativeKey: string;
  readonly reservationId: string | null;
  readonly runId: string | null;
  readonly requestId: string;
}

const auditNamePattern = /^[a-z][a-z0-9_.-]*$/;

export function billingAuditEvent(event: BillingAuditEvent): BillingAuditEvent {
  if (
    event.workspaceId.length === 0 ||
    event.entityId.length === 0 ||
    event.requestId.length < 1 ||
    event.requestId.length > 200
  ) {
    throw new TypeError('Audit event identifiers and requestId are required');
  }
  if (!auditNamePattern.test(event.action) || !auditNamePattern.test(event.entityType)) {
    throw new TypeError('Audit action and entityType must use database-safe names');
  }
  if (event.actorType === 'user' && event.actorId === null) {
    throw new TypeError('User audit events require actorId');
  }
  return Object.freeze({ ...event, details: Object.freeze({ ...event.details }) });
}

export function ledgerAuditEvent(input: LedgerAuditEventInput): BillingAuditEvent {
  return billingAuditEvent({
    workspaceId: input.workspaceId,
    actorType: 'system',
    actorId: null,
    action: `ledger.${input.entryType}`,
    entityType: 'ledger_transaction',
    entityId: input.transactionId,
    requestId: input.requestId,
    details: {
      causative_key: input.causativeKey,
      amount_micros: input.amountMicros,
      reservation_id: input.reservationId,
      run_id: input.runId,
    },
  });
}
