import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { percentileNearestRank } from './golden-20-staging-harness';
import { HarnessFlowError, StagingLaunchPackTransport } from './launch-pack-harness-lib';
import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  createDisposableIdentity,
  loadStagingAdminConfiguration,
} from './staging-auth';

export const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';

export const P3_EVIDENCE_CSV_COLUMNS = [
  'run_id',
  'sample_id',
  'utc_time',
  'gate',
  'operation',
  'vu_tier',
  'elapsed_ms',
  'outcome',
  'error_class',
  'http_status',
  'expected_outcome',
] as const;

export type P3EvidenceCsvColumn = (typeof P3_EVIDENCE_CSV_COLUMNS)[number];

export type P3EvidenceOutcome = 'success' | 'expected_error' | 'unexpected_error' | 'timeout';

export interface P3EvidenceSample {
  readonly run_id: string;
  readonly sample_id: string;
  readonly utc_time: string;
  readonly gate: string;
  readonly operation: string;
  readonly vu_tier: number;
  readonly elapsed_ms: number;
  readonly outcome: P3EvidenceOutcome;
  readonly error_class: string;
  readonly http_status: number | '';
  readonly expected_outcome: 'success' | 'error';
}

export interface P3EvidenceMode {
  readonly kind: 'dry-run' | 'staging';
}

export interface P3CommonHarnessArguments {
  readonly mode: P3EvidenceMode['kind'];
  readonly outDirectory: string;
  readonly vuTier: number;
  readonly rampSeconds: number;
  readonly durationSeconds: number;
  readonly runId: string;
}

export interface P3LatencySummary {
  readonly observation_count: number;
  readonly success_count: number;
  readonly unexpected_error_count: number;
  readonly unexpected_error_rate: number;
  readonly p50_ms: number | null;
  readonly p95_ms: number | null;
  readonly p99_ms: number | null;
}

export function optionalFlagValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.length === 0 || value.startsWith('--')) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} requires a value.`,
    });
  }
  return value;
}

export function parsePositiveInt(value: string, flag: string): number {
  if (!/^[1-9]\d*$/u.test(value)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} requires a positive integer.`,
    });
  }
  return Number.parseInt(value, 10);
}

export function parseCommonHarnessArguments(
  argv: readonly string[],
  defaults: Readonly<{ durationSeconds: number; rampSeconds: number; vuTier: number }>,
): P3CommonHarnessArguments {
  const dryRun = argv.includes('--dry-run');
  const staging = argv.includes('--staging');
  if (dryRun === staging) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: 'Select exactly one mode: --dry-run or --staging.',
    });
  }
  const outDirectory =
    optionalFlagValue(argv, '--out') ??
    throwMissing('--out directory is required for P3 evidence harnesses.');
  const vuTier = optionalFlagValue(argv, '--vus');
  const durationSeconds = optionalFlagValue(argv, '--duration-seconds');
  const rampSeconds = optionalFlagValue(argv, '--ramp-seconds');
  const runId = optionalFlagValue(argv, '--run-id') ?? `p3-${Date.now()}`;
  return {
    mode: dryRun ? 'dry-run' : 'staging',
    outDirectory,
    vuTier: vuTier === undefined ? defaults.vuTier : parsePositiveInt(vuTier, '--vus'),
    rampSeconds:
      rampSeconds === undefined
        ? defaults.rampSeconds
        : parsePositiveInt(rampSeconds, '--ramp-seconds'),
    durationSeconds:
      durationSeconds === undefined
        ? defaults.durationSeconds
        : parsePositiveInt(durationSeconds, '--duration-seconds'),
    runId,
  };
}

function throwMissing(message: string): never {
  throw new HarnessFlowError({ code: 'INVALID_ARGUMENTS', message });
}

export function summarizeLatency(samples: readonly P3EvidenceSample[]): P3LatencySummary {
  const latencies = samples.map((sample) => sample.elapsed_ms);
  const successCount = samples.filter((sample) => sample.outcome === 'success').length;
  const unexpectedErrorCount = samples.filter(
    (sample) => sample.outcome === 'unexpected_error' || sample.outcome === 'timeout',
  ).length;
  const observationCount = samples.length;
  return {
    observation_count: observationCount,
    success_count: successCount,
    unexpected_error_count: unexpectedErrorCount,
    unexpected_error_rate: observationCount === 0 ? 0 : unexpectedErrorCount / observationCount,
    p50_ms: percentileNearestRank(latencies, 0.5),
    p95_ms: percentileNearestRank(latencies, 0.95),
    p99_ms: percentileNearestRank(latencies, 0.99),
  };
}

export function escapeCsvField(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/u.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function samplesToCsv(samples: readonly P3EvidenceSample[]): string {
  const header = P3_EVIDENCE_CSV_COLUMNS.join(',');
  const rows = samples.map((sample) =>
    P3_EVIDENCE_CSV_COLUMNS.map((column) => escapeCsvField(sample[column])).join(','),
  );
  return [header, ...rows].join('\n');
}

export async function writeEvidenceArtifacts(input: {
  readonly outDirectory: string;
  readonly gate: string;
  readonly runLabel: string;
  readonly samples: readonly P3EvidenceSample[];
  readonly summary: Readonly<Record<string, unknown>>;
}): Promise<{ readonly rawPath: string; readonly summaryPath: string }> {
  const rawDirectory = join(input.outDirectory, 'raw');
  const summaryDirectory = join(input.outDirectory, 'summary');
  await mkdir(rawDirectory, { recursive: true });
  await mkdir(summaryDirectory, { recursive: true });
  const rawPath = join(rawDirectory, `${input.runLabel}.csv`);
  const summaryPath = join(summaryDirectory, `${input.runLabel}.json`);
  await writeFile(rawPath, `${samplesToCsv(input.samples)}\n`, 'utf8');
  await writeFile(
    summaryPath,
    `${JSON.stringify({ gate: input.gate, ...input.summary }, null, 2)}\n`,
    'utf8',
  );
  return { rawPath, summaryPath };
}

export async function writeDryRunScaffold(input: {
  readonly outDirectory: string;
  readonly gate: string;
  readonly notes: readonly string[];
}): Promise<void> {
  const summaryDirectory = join(input.outDirectory, 'summary');
  await mkdir(summaryDirectory, { recursive: true });
  await writeFile(
    join(summaryDirectory, 'dry-run-scaffold.json'),
    `${JSON.stringify(
      {
        gate: input.gate,
        mode: 'dry-run',
        recorded_at: new Date().toISOString(),
        notes: input.notes,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

export function classifyHarnessError(error: unknown): {
  readonly outcome: P3EvidenceOutcome;
  readonly error_class: string;
  readonly http_status: number | '';
} {
  if (error instanceof HarnessFlowError) {
    const httpStatus = error.safe.http_status ?? '';
    const expected =
      error.safe.code === 'REVISION_CONFLICT' ||
      error.safe.code === 'IDEMPOTENCY_CONFLICT' ||
      error.safe.code === 'PROVIDER_UNAVAILABLE';
    return {
      outcome: expected ? 'expected_error' : 'unexpected_error',
      error_class: error.safe.code,
      http_status: httpStatus,
    };
  }
  return {
    outcome: 'unexpected_error',
    error_class: error instanceof Error ? error.name : 'UnknownError',
    http_status: '',
  };
}

export async function runClosedLoopWorkers<T>(input: {
  readonly vuTier: number;
  readonly durationSeconds: number;
  readonly rampSeconds: number;
  readonly worker: (workerIndex: number) => Promise<T>;
}): Promise<readonly T[]> {
  const results: T[] = [];
  const deadline = Date.now() + input.durationSeconds * 1000;
  const rampDelayMs =
    input.vuTier <= 1 ? 0 : Math.max(1, Math.floor((input.rampSeconds * 1000) / input.vuTier));
  await Promise.all(
    Array.from({ length: input.vuTier }, async (_, workerIndex) => {
      await sleep(rampDelayMs * workerIndex);
      while (Date.now() < deadline) {
        results.push(await input.worker(workerIndex));
      }
    }),
  );
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function createStagingEvidenceTransport(): Promise<StagingLaunchPackTransport> {
  const configuration = await loadStagingAdminConfiguration();
  const identity = createDisposableIdentity();
  await createConfirmedDisposableStagingUser({ configuration, identity });
  const authentication = await authenticateDisposableStagingUser({ configuration, identity });
  return new StagingLaunchPackTransport(STAGING_CORE_URL, authentication.accessToken);
}

export { percentileNearestRank };
