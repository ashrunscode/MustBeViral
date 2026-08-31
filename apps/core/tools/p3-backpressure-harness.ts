import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

import { buildGoldenLaunchPackGraph } from '@mustbeviral/contracts';

import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  HarnessFlowError,
  prepareGoldenBrief,
  type HarnessTransport,
  type PreparedGoldenBrief,
} from './launch-pack-harness-lib';
import {
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
const BACKPRESSURE_OPERATIONS = ['quote_run', 'validate_graph'] as const;
type BackpressureOperation = (typeof BACKPRESSURE_OPERATIONS)[number];

export interface BackpressureHarnessArguments {
  readonly common: ReturnType<typeof parseCommonHarnessArguments>;
  readonly briefId: string;
  readonly operations: readonly BackpressureOperation[];
  readonly includeDispatchProbe: boolean;
}

export function backpressureArgumentsFrom(argv: readonly string[]): BackpressureHarnessArguments {
  const common = parseCommonHarnessArguments(argv, {
    durationSeconds: 300,
    rampSeconds: 30,
    vuTier: 10,
  });
  const briefId = argv.includes('--brief')
    ? (argv[argv.indexOf('--brief') + 1] ?? DEFAULT_BRIEF_ID)
    : DEFAULT_BRIEF_ID;
  const operations = argv.includes('--operations')
    ? parseOperations(argv[argv.indexOf('--operations') + 1] ?? '')
    : BACKPRESSURE_OPERATIONS;
  return {
    common,
    briefId,
    operations,
    includeDispatchProbe: argv.includes('--include-dispatch-probe'),
  };
}

function parseOperations(value: string): readonly BackpressureOperation[] {
  const operations = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (operations.length === 0) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--operations requires comma-separated quote_run and/or validate_graph.',
    });
  }
  for (const operation of operations) {
    if (!BACKPRESSURE_OPERATIONS.includes(operation as BackpressureOperation)) {
      throw new HarnessFlowError({
        code: 'INVALID_ARGUMENTS',
        message: `Unsupported operation ${operation}.`,
      });
    }
  }
  return operations as BackpressureOperation[];
}

export async function createBackpressureTransport(
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

export async function runBackpressureHarness(
  arguments_: BackpressureHarnessArguments,
): Promise<Readonly<Record<string, unknown>>> {
  if (arguments_.includeDispatchProbe) {
    throw new HarnessFlowError({
      code: 'NOT_IMPLEMENTED',
      message:
        'Dispatch probe requires explicit operator budget authorization. Use executor:isolation harness.',
    });
  }

  if (arguments_.common.mode === 'dry-run') {
    await writeDryRunScaffold({
      outDirectory: arguments_.common.outDirectory,
      gate: 'queues_backpressure',
      notes: [
        'Dry-run validates arguments and output directories only.',
        'Re-run with --staging to collect live measurements.',
        `Planned operations: ${arguments_.operations.join(', ')}`,
      ],
    });
    return {
      mode: 'dry-run',
      gate: 'queues_backpressure',
      vu_tier: arguments_.common.vuTier,
      operations: arguments_.operations,
      out_directory: arguments_.common.outDirectory,
    };
  }

  const briefs = await loadGoldenBriefRegistry();
  const brief = briefs.find((entry) => entry.briefId === arguments_.briefId);
  if (brief === undefined) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `Unknown brief ${arguments_.briefId}.`,
    });
  }

  const transport = await createBackpressureTransport('staging');
  const prepared = await prepareGoldenBrief(brief, transport, Date.now, arguments_.common.runId);
  const graph = buildGoldenLaunchPackGraph(brief);
  const samples = await collectBackpressureSamples({
    prepared,
    transport,
    graph,
    arguments: arguments_,
  });
  const summary = summarizeLatency(samples);
  const runLabel = `vu-${arguments_.common.vuTier}__${arguments_.operations.join('-')}__${arguments_.common.runId}`;
  const artifacts = await writeEvidenceArtifacts({
    outDirectory: arguments_.common.outDirectory,
    gate: 'queues_backpressure',
    runLabel,
    samples,
    summary: {
      recorded_at: new Date().toISOString(),
      brief_id: arguments_.briefId,
      vu_tier: arguments_.common.vuTier,
      duration_seconds: arguments_.common.durationSeconds,
      ramp_seconds: arguments_.common.rampSeconds,
      operations: arguments_.operations,
      ...summary,
    },
  });
  return {
    mode: 'staging',
    gate: 'queues_backpressure',
    brief_id: arguments_.briefId,
    ...summary,
    raw_path: artifacts.rawPath,
    summary_path: artifacts.summaryPath,
  };
}

async function collectBackpressureSamples(input: {
  readonly prepared: PreparedGoldenBrief;
  readonly transport: HarnessTransport;
  readonly graph: ReturnType<typeof buildGoldenLaunchPackGraph>;
  readonly arguments: BackpressureHarnessArguments;
}): Promise<readonly P3EvidenceSample[]> {
  let sampleCounter = 0;
  const operationCycle = [...input.arguments.operations];
  return runClosedLoopWorkers({
    vuTier: input.arguments.common.vuTier,
    durationSeconds: input.arguments.common.durationSeconds,
    rampSeconds: input.arguments.common.rampSeconds,
    worker: async () => {
      const operation = operationCycle[sampleCounter % operationCycle.length] ?? 'quote_run';
      sampleCounter += 1;
      const started = performance.now();
      try {
        if (operation === 'validate_graph') {
          const result = await input.transport.call('validate_graph', {
            context: input.prepared.context,
            workspace_id: input.prepared.workspaceId,
            canvas_id: input.prepared.canvasId,
            revision_id: input.prepared.revisionId,
            graph: input.graph,
          });
          if (!result.ok)
            throw new HarnessFlowError(result.error, input.prepared.context.request_id);
        } else {
          const result = await input.transport.call('quote_run', {
            context: input.prepared.context,
            workspace_id: input.prepared.workspaceId,
            canvas_id: input.prepared.canvasId,
            revision_id: input.prepared.revisionId,
            revision_hash: input.prepared.revisionHash,
          });
          if (!result.ok)
            throw new HarnessFlowError(result.error, input.prepared.context.request_id);
        }
        return buildSample({
          runId: input.arguments.common.runId,
          sampleId: randomUUID(),
          gate: 'queues_backpressure',
          operation,
          vuTier: input.arguments.common.vuTier,
          elapsedMs: performance.now() - started,
          outcome: 'success',
          errorClass: '',
          httpStatus: 200,
          expectedOutcome: 'success',
        });
      } catch (error) {
        const classified = classifyHarnessError(error);
        return buildSample({
          runId: input.arguments.common.runId,
          sampleId: randomUUID(),
          gate: 'queues_backpressure',
          operation,
          vuTier: input.arguments.common.vuTier,
          elapsedMs: performance.now() - started,
          outcome: classified.outcome,
          errorClass: classified.error_class,
          httpStatus: classified.http_status,
          expectedOutcome: 'success',
        });
      }
    },
  });
}

function buildSample(input: {
  readonly runId: string;
  readonly sampleId: string;
  readonly gate: string;
  readonly operation: string;
  readonly vuTier: number;
  readonly elapsedMs: number;
  readonly outcome: P3EvidenceSample['outcome'];
  readonly errorClass: string;
  readonly httpStatus: number | '';
  readonly expectedOutcome: P3EvidenceSample['expected_outcome'];
}): P3EvidenceSample {
  return {
    run_id: input.runId,
    sample_id: input.sampleId,
    utc_time: new Date().toISOString(),
    gate: input.gate,
    operation: input.operation,
    vu_tier: input.vuTier,
    elapsed_ms: Math.round(input.elapsedMs * 100) / 100,
    outcome: input.outcome,
    error_class: input.errorClass,
    http_status: input.httpStatus,
    expected_outcome: input.expectedOutcome,
  };
}

async function main(): Promise<void> {
  const result = await runBackpressureHarness(backpressureArgumentsFrom(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
