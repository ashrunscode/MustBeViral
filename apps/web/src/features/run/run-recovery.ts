import {
  runFailureRecoveryCopyForKind,
  type P0OperationData,
  type RunFailureNodeRecord,
  type RunFailureRecoveryCopy,
} from '@mustbeviral/contracts';

export interface RunRecoveryView extends RunFailureRecoveryCopy {
  readonly state: 'failed' | 'reconciliation_required';
  readonly affectedNodes: readonly RunFailureNodeRecord[];
  readonly retainedRunNodeIds: readonly string[];
}

export interface RunSettlementView {
  readonly reservationMicros: bigint;
  readonly capturedMicros: bigint;
  readonly releasedMicros: bigint;
  readonly refundedMicros: bigint;
  readonly pendingMicros: bigint;
  readonly netMicros: bigint;
  readonly settlementStatus: P0OperationData<'get_run'>['spend']['settlementStatus'];
}

export function runRecoveryView(data: P0OperationData<'get_run'>): RunRecoveryView | null {
  if (data.recovery === null) return null;
  const fallback = runFailureRecoveryCopyForKind(data.recovery.kind);
  const affectedNodeKeys = new Set(data.recovery.affectedNodeKeys);
  const affectedNodes = data.nodes
    .filter(
      (node): node is typeof node & { status: 'failed' | 'reconciliation_required' } =>
        affectedNodeKeys.has(node.nodeKey) &&
        (node.status === 'failed' || node.status === 'reconciliation_required'),
    )
    .map((node) => ({
      runNodeId: node.runNodeId,
      nodeKey: node.nodeKey,
      state: node.status,
      kind: data.recovery?.kind ?? 'other',
    }));
  return {
    ...fallback,
    title: data.recovery.title,
    whatFailed: data.recovery.message,
    nextAction: data.recovery.nextAction,
    state:
      data.run.status === 'reconciliation_required' ||
      data.recovery.kind === 'ambiguous' ||
      affectedNodes.some((node) => node.state === 'reconciliation_required')
        ? 'reconciliation_required'
        : 'failed',
    affectedNodes,
    retainedRunNodeIds: data.nodes
      .filter((node) => node.status === 'succeeded')
      .map((node) => node.runNodeId),
  };
}

export function runSettlementView(data: P0OperationData<'get_run'>): RunSettlementView {
  const reservationMicros = BigInt(data.spend.authorizedMicros);
  const capturedMicros = BigInt(data.spend.capturedMicros);
  const releasedMicros = BigInt(data.spend.releasedMicros);
  const pendingMicros = reservationMicros - capturedMicros - releasedMicros;
  if (pendingMicros < 0n) throw new RangeError('Run spend exceeds the authorized amount');
  return {
    reservationMicros,
    capturedMicros,
    releasedMicros,
    refundedMicros: BigInt(data.spend.refundedMicros),
    pendingMicros,
    netMicros: BigInt(data.spend.netMicros),
    settlementStatus: data.spend.settlementStatus,
  };
}
