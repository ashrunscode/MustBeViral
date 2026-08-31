import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { HarnessFlowError } from '../../tools/launch-pack-harness-lib';
import { backpressureArgumentsFrom } from '../../tools/p3-backpressure-harness';
import { executorIsolationArgumentsFrom } from '../../tools/p3-executor-isolation-harness';
import {
  hyperdriveArgumentsFrom,
  runHyperdriveBenchmarkHarness,
  scaffoldHyperdriveEvidenceLayout,
} from '../../tools/p3-hyperdrive-benchmark-harness';
import {
  parseCommonHarnessArguments,
  samplesToCsv,
  summarizeLatency,
  writeDryRunScaffold,
  type P3EvidenceSample,
} from '../../tools/p3-scale-evidence-lib';

describe('P3 scale evidence harness', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('requires exactly one mode flag', () => {
    expect(() =>
      parseCommonHarnessArguments(['--out', '/tmp/p3'], {
        durationSeconds: 60,
        rampSeconds: 10,
        vuTier: 1,
      }),
    ).toThrow(HarnessFlowError);
  });

  it('parses backpressure harness arguments with defaults', () => {
    const arguments_ = backpressureArgumentsFrom([
      '--dry-run',
      '--out',
      '/tmp/backpressure',
      '--vus',
      '50',
    ]);
    expect(arguments_.common.mode).toBe('dry-run');
    expect(arguments_.common.vuTier).toBe(50);
    expect(arguments_.operations).toEqual(['quote_run', 'validate_graph']);
    expect(arguments_.briefId).toBe('GB-02');
  });

  it('parses hyperdrive harness matrix arguments', () => {
    const arguments_ = hyperdriveArgumentsFrom([
      '--dry-run',
      '--out',
      '/tmp/benchmarks',
      '--path',
      'baseline_data_api_rpc',
      '--workload',
      'W2',
      '--thermal',
      'cold',
      '--vus',
      '200',
    ]);
    expect(arguments_.path).toBe('baseline_data_api_rpc');
    expect(arguments_.workload).toBe('W2');
    expect(arguments_.thermal).toBe('cold');
    expect(arguments_.common.vuTier).toBe(200);
  });

  it('summarizes latency percentiles and unexpected error rate', () => {
    const samples: readonly P3EvidenceSample[] = [
      sample({ elapsed_ms: 100, outcome: 'success' }),
      sample({ elapsed_ms: 200, outcome: 'success' }),
      sample({ elapsed_ms: 300, outcome: 'unexpected_error' }),
      sample({ elapsed_ms: 400, outcome: 'success' }),
    ];
    const summary = summarizeLatency(samples);
    expect(summary.observation_count).toBe(4);
    expect(summary.unexpected_error_count).toBe(1);
    expect(summary.unexpected_error_rate).toBe(0.25);
    expect(summary.p50_ms).toBe(200);
    expect(summary.p95_ms).toBe(400);
  });

  it('serializes CSV with quoted fields when needed', () => {
    const csv = samplesToCsv([
      sample({
        elapsed_ms: 12.5,
        error_class: 'note,with-comma',
      }),
    ]);
    expect(csv.split('\n')[0]).toBe(
      'run_id,sample_id,utc_time,gate,operation,vu_tier,elapsed_ms,outcome,error_class,http_status,expected_outcome',
    );
    expect(csv).toContain('"note,with-comma"');
  });

  it('writes dry-run scaffold and hyperdrive benchmark layout', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'p3-evidence-'));
    await writeDryRunScaffold({
      outDirectory: directory,
      gate: 'queues_backpressure',
      notes: ['test scaffold'],
    });
    await scaffoldHyperdriveEvidenceLayout(directory);
    const scaffold = JSON.parse(
      await readFile(join(directory, 'summary', 'dry-run-scaffold.json'), 'utf8'),
    );
    expect(scaffold.gate).toBe('queues_backpressure');
    const decisionTable = await readFile(join(directory, 'summary', 'decision-table.md'), 'utf8');
    expect(decisionTable).toContain('G1');
  });

  it('runs hyperdrive harness in dry-run without staging bindings', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'p3-hyperdrive-'));
    const result = await runHyperdriveBenchmarkHarness(
      hyperdriveArgumentsFrom(['--dry-run', '--out', directory]),
    );
    expect(result.mode).toBe('dry-run');
    expect(result.gate).toBe('hyperdrive_g1_g6');
  });

  it('blocks hyperdrive candidate path on staging without operator binding', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'p3-hyperdrive-staging-'));
    await expect(
      runHyperdriveBenchmarkHarness(
        hyperdriveArgumentsFrom([
          '--staging',
          '--out',
          directory,
          '--path',
          'candidate_hyperdrive_pooled',
        ]),
      ),
    ).rejects.toMatchObject({ safe: { code: 'GATE_BLOCKED' } });
  });

  it('requires dispatch-probe-only for executor isolation staging mode', () => {
    const arguments_ = executorIsolationArgumentsFrom([
      '--staging',
      '--out',
      '/tmp/executor',
      '--vus',
      '10',
    ]);
    expect(arguments_.dispatchProbeOnly).toBe(false);
  });
});

function sample(overrides: Partial<P3EvidenceSample> = {}): P3EvidenceSample {
  return {
    run_id: 'run-1',
    sample_id: 'sample-1',
    utc_time: '2026-08-31T12:00:00.000Z',
    gate: 'queues_backpressure',
    operation: 'quote_run',
    vu_tier: 10,
    elapsed_ms: 100,
    outcome: 'success',
    error_class: '',
    http_status: 200,
    expected_outcome: 'success',
    ...overrides,
  };
}
