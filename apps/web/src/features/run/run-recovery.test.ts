import { describe, expect, it } from 'vitest';

import type { LaunchPackFailKind, P0OperationData } from '@mustbeviral/contracts';

import { runRecoveryView, runSettlementView } from './run-recovery';

function recoveryData(kind: LaunchPackFailKind): P0OperationData<'get_run'> {
  const reconciliation = kind === 'ambiguous';
  return {
    run: {
      runId: 'run-1',
      projectId: 'project-1',
      canvasId: 'canvas-1',
      canvasRevisionId: 'revision-1',
      quoteId: 'quote-1',
      status: reconciliation ? 'reconciliation_required' : 'failed',
      reservationId: 'reservation-1',
    },
    nodes: [
      {
        runNodeId: 'run-node-kept',
        nodeKey: 'copy-1',
        modelRouteId: 'copy-route',
        status: 'succeeded',
        dispatchWave: 0,
      },
      {
        runNodeId: 'run-node-affected',
        nodeKey: 'master-2',
        modelRouteId: 'image-route',
        status: reconciliation ? 'reconciliation_required' : 'failed',
        dispatchWave: 1,
      },
    ],
    recovery: {
      kind,
      affectedNodeKeys: ['master-2'],
      title: reconciliation ? 'This branch needs reconciliation' : 'This branch failed',
      message: 'This branch did not produce a verified output. 1 completed branch was kept.',
      nextAction: reconciliation
        ? 'Wait for operator reconciliation. Do not submit the same prompt again.'
        : 'Edit the brief, then request a new quote.',
    },
    spend: {
      currency: 'USD',
      authorizedMicros: '4550000',
      capturedMicros: '150000',
      releasedMicros: '3000000',
      refundedMicros: '125000',
      netMicros: '25000',
      settlementStatus: 'partially_captured',
    },
  };
}

describe('run recovery web mapping', () => {
  it.each([
    'content_policy_violation',
    'http_422',
    'fal_webhook_failed',
    'timeout',
    'ambiguous',
    'other',
  ] as const)('maps %s to customer-safe copy', (kind) => {
    const recovery = runRecoveryView(recoveryData(kind));
    expect(recovery).toMatchObject({
      kind,
      affectedNodes: [{ runNodeId: 'run-node-affected', kind }],
      retainedRunNodeIds: ['run-node-kept'],
    });
    expect(JSON.stringify(recovery)).not.toMatch(
      /normalized_evidence|provider payload|signed url|token=|customer prompt/iu,
    );
  });

  it('preserves exact integer micros for partial multi-branch recovery', () => {
    const data = recoveryData('content_policy_violation');
    data.nodes.push({
      runNodeId: 'run-node-timeout',
      nodeKey: 'motion-1',
      modelRouteId: 'motion-route',
      status: 'failed',
      dispatchWave: 2,
    });
    data.recovery?.affectedNodeKeys.push('motion-1');
    expect(runRecoveryView(data)?.affectedNodes).toHaveLength(2);
    expect(runSettlementView(data)).toEqual({
      reservationMicros: 4_550_000n,
      capturedMicros: 150_000n,
      releasedMicros: 3_000_000n,
      refundedMicros: 125_000n,
      pendingMicros: 1_400_000n,
      netMicros: 25_000n,
      settlementStatus: 'partially_captured',
    });
  });
});
