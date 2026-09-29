import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  HarnessFlowError,
  prepareGoldenBrief,
  type HarnessTransport,
} from './launch-pack-harness-lib';
import {
  buildQuoteRunInput,
  classifyHarnessError,
  createStagingEvidenceTransport,
  parseCommonHarnessArguments,
  runClosedLoopWorkers,
  summarizeLatency,
  writeDryRunScaffold,
  writeEvidenceArtifacts,
  type P3EvidenceSample,
} from './p3-scale-evidence-lib';

const DEFAULT_BRIEF_ID = 'GB-02';

export interface ExecutorIsolationHarnessArguments {
  readonly common: ReturnType<typeof parseCommonHarnessArguments>;
  readonly briefId: string;
  readonly dispatchProbeOnly: boolean;
}

export function executorIsolationArgumentsFrom(
  argv: readonly string[],
): ExecutorIsolationHarnessArguments {
  const common = parseCommonHarnessArguments(argv, {
    durationSeconds: 180,
    rampSeconds: 30,
    vuTier: 10,
  });
  const briefId = argv.includes('--brief')
    ? (argv[argv.indexOf('--brief') + 1] ?? DEFAULT_BRIEF_ID)
    : DEFAULT_BRIEF_ID;
  return {
    common,
    briefId,
    dispatchProbeOnly: argv.includes('--dispatch-probe-only'),
  };
}

export async function createExecutorIsolationTransport(
  mode: 'dry-run' | 'staging',
): Promise<HarnessTransport> {
  if (mode === 'dry-run') {
    return {
      async call() {
        return { ok: true, data: { dry_run: true } };
      },
    };
  }
  return createStagingEvidenceTransport();
}

export async function runExecutorIsolationHarness(
  arguments_: ExecutorIsolationHarnessArguments,
): Promise<Readonly<Record<string, unknown>>> {
  if (arguments_.common.mode === 'dry-run') {
    await writeDryRunScaffold({
      outDirectory: arguments_.common.outDirectory,
      gate: 'separate_executor',
      notes: [
        'Dry-run validates arguments and output directories only.',
        'Dispatch probe uses quote_run fan-out without provider completion.',
        'Do not deploy separate executor Worker until evidence passes.',
      ],
    });
    return {
      mode: 'dry-run',
      gate: 'separate_executor',
      vu_tier: arguments_.common.vuTier,
      dispatch_probe_only: arguments_.dispatchProbeOnly,
      out_directory: arguments_.common.outDirectory,
    };
  }

  if (!arguments_.dispatchProbeOnly) {
    throw new HarnessFlowError({
      code: 'GATE_BLOCKED',
      message:
        'Live provider fan-out requires explicit operator budget. Re-run with --dispatch-probe-only for quote-run ingress load without paid execution.',
    });
  }

  const briefs = await loadGoldenBriefRegistry();
  const brief = briefs.find((entry) => entry.briefId === arguments_.briefId);
  if (brief === undefined) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `Unknown brief ${arguments_.briefId}.`,
    });
  }

  const transport = await createExecutorIsolationTransport('staging');
  const prepared = await prepareGoldenBrief(brief, transport, Date.now, arguments_.common.runId);
  const samples = await collectDispatchProbeSamples({
    prepared,
    transport,
    arguments: arguments_,
  });
  const summary = summarizeLatency(samples);
  const runLabel = `vu-${arguments_.common.vuTier}__dispatch-probe__${arguments_.common.runId}`;
  const artifacts = await writeEvidenceArtifacts({
    outDirectory: arguments_.common.outDirectory,
    gate: 'separate_executor',
    runLabel,
    samples,
    summary: {
      recorded_at: new Date().toISOString(),
      brief_id: arguments_.briefId,
      dispatch_probe_only: true,
      vu_tier: arguments_.common.vuTier,
      duration_seconds: arguments_.common.durationSeconds,
      ramp_seconds: arguments_.common.rampSeconds,
      ...summary,
    },
  });
  return {
    mode: 'staging',
    gate: 'separate_executor',
    brief_id: arguments_.briefId,
    dispatch_probe_only: true,
    ...summary,
    raw_path: artifacts.rawPath,
    summary_path: artifacts.summaryPath,
  };
}

async function collectDispatchProbeSamples(input: {
  readonly prepared: Awaited<ReturnType<typeof prepareGoldenBrief>>;
  readonly transport: HarnessTransport;
  readonly arguments: ExecutorIsolationHarnessArguments;
}): Promise<readonly P3EvidenceSample[]> {
  return runClosedLoopWorkers({
    vuTier: input.arguments.common.vuTier,
    durationSeconds: input.arguments.common.durationSeconds,
    rampSeconds: input.arguments.common.rampSeconds,
    worker: async () => {
      const started = performance.now();
      try {
        const result = await input.transport.call(
          'quote_run',
          buildQuoteRunInput({
            context: input.prepared.context,
            canvasId: input.prepared.canvasId,
            revisionId: input.prepared.revisionId,
            idempotencyKey: randomUUID(),
          }),
        );
        if (!result.ok) throw new HarnessFlowError(result.error, input.prepared.context.request_id);
        return buildSample({
          runId: input.arguments.common.runId,
          sampleId: randomUUID(),
          vuTier: input.arguments.common.vuTier,
          elapsedMs: performance.now() - started,
          outcome: 'success',
          errorClass: '',
          httpStatus: 200,
        });
      } catch (error) {
        const classified = classifyHarnessError(error);
        return buildSample({
          runId: input.arguments.common.runId,
          sampleId: randomUUID(),
          vuTier: input.arguments.common.vuTier,
          elapsedMs: performance.now() - started,
          outcome: classified.outcome,
          errorClass: classified.error_class,
          httpStatus: classified.http_status,
        });
      }
    },
  });
}

function buildSample(input: {
  readonly runId: string;
  readonly sampleId: string;
  readonly vuTier: number;
  readonly elapsedMs: number;
  readonly outcome: P3EvidenceSample['outcome'];
  readonly errorClass: string;
  readonly httpStatus: number | '';
}): P3EvidenceSample {
  return {
    run_id: input.runId,
    sample_id: input.sampleId,
    utc_time: new Date().toISOString(),
    gate: 'separate_executor',
    operation: 'quote_run_dispatch_probe',
    vu_tier: input.vuTier,
    elapsed_ms: Math.round(input.elapsedMs * 100) / 100,
    outcome: input.outcome,
    error_class: input.errorClass,
    http_status: input.httpStatus,
    expected_outcome: 'success',
  };
}

async function main(): Promise<void> {
  const result = await runExecutorIsolationHarness(
    executorIsolationArgumentsFrom(process.argv.slice(2)),
  );
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
