import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { loadGoldenBriefRegistry } from './golden-brief-registry';
import {
  HarnessFlowError,
  StagingLaunchPackTransport,
  USABLE_PACK_GATE_MICROS,
  createInMemoryHarnessTransport,
  executeGoldenBrief,
  type BriefRunRecord,
  type SafeHarnessError,
} from './launch-pack-harness-lib';
import { authenticateDisposableStagingUser, loadStagingAuthConfiguration } from './staging-auth';

const STAGING_CORE_URL = 'https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev';
const DEFAULT_OUT_DIRECTORY = fileURLToPath(
  new URL('../../../.scratch/launch-pack-harness/', import.meta.url),
);

interface HarnessArguments {
  readonly mode: 'dry-run' | 'staging';
  readonly outDirectory: string;
  readonly expectProviderUnavailable: boolean;
}

function argumentsFrom(argv: readonly string[]): HarnessArguments {
  const dryRun = argv.includes('--dry-run');
  const staging = argv.includes('--staging');
  if (dryRun === staging) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: 'Select exactly one mode: --dry-run or --staging.',
    });
  }
  const outIndex = argv.indexOf('--out');
  const outDirectory = outIndex < 0 ? DEFAULT_OUT_DIRECTORY : argv[outIndex + 1];
  if (outDirectory === undefined || outDirectory.length === 0 || outDirectory.startsWith('--')) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--out requires a directory path.',
    });
  }
  return {
    mode: dryRun ? 'dry-run' : 'staging',
    outDirectory,
    expectProviderUnavailable: !argv.includes('--expect-provider-run'),
  };
}

function safeFailure(error: unknown): SafeHarnessError {
  if (error instanceof HarnessFlowError) return error.safe;
  return { code: 'HARNESS_FAILURE', message: 'The harness encountered an internal failure.' };
}

function roundedAverage(total: bigint, count: number): bigint {
  return count === 0 ? 0n : total / BigInt(count);
}

export async function runLaunchPackHarness(
  argv: readonly string[],
  log: (message: string) => void = console.log,
): Promise<number> {
  const options = argumentsFrom(argv);
  // Unique per invocation: makes every workspace slug globally unique and scopes
  // idempotency keys so a re-run never collides with prior-run state on staging.
  const runId = randomBytes(4).toString('hex');
  const briefs = await loadGoldenBriefRegistry();
  const transport =
    options.mode === 'dry-run'
      ? createInMemoryHarnessTransport()
      : await (async () => {
          const authentication = await authenticateDisposableStagingUser({
            configuration: await loadStagingAuthConfiguration(),
            log,
          });
          log(`AUTHENTICATED disposable staging user: ${authentication.email}`);
          return new StagingLaunchPackTransport(STAGING_CORE_URL, authentication.accessToken);
        })();
  await mkdir(options.outDirectory, { recursive: true });
  const records: BriefRunRecord[] = [];
  const failures: Array<
    Readonly<{
      brief_id: string;
      code: string;
      message: string;
      operation?: string;
      http_status?: number;
    }>
  > = [];
  for (const brief of briefs) {
    try {
      const result = await executeGoldenBrief(
        brief,
        transport,
        options.expectProviderUnavailable,
        Date.now,
        runId,
      );
      records.push(result);
      await writeFile(
        `${options.outDirectory}/${brief.briefId}.json`,
        `${JSON.stringify(result, null, 2)}\n`,
        'utf8',
      );
    } catch (error) {
      const safe = safeFailure(error);
      failures.push({ brief_id: brief.briefId, ...safe });
    }
  }
  const totals = records.map((entry) => BigInt(entry.quote.total_micros));
  const aggregate = totals.reduce((sum, value) => sum + value, 0n);
  const minimum =
    totals.length === 0 ? 0n : totals.reduce((left, right) => (left < right ? left : right));
  const maximum =
    totals.length === 0 ? 0n : totals.reduce((left, right) => (left > right ? left : right));
  const summary = {
    mode: options.mode,
    briefs_attempted: briefs.length,
    succeeded_to_quote: records.length,
    quote_stats: {
      minimum_micros: minimum.toString(10),
      maximum_micros: maximum.toString(10),
      average_micros: roundedAverage(aggregate, totals.length).toString(10),
      aggregate_micros: aggregate.toString(10),
      usable_pack_gate_micros: USABLE_PACK_GATE_MICROS.toString(10),
      at_or_below_usable_pack_gate: totals.filter((value) => value <= USABLE_PACK_GATE_MICROS)
        .length,
    },
    failures,
  };
  await writeFile(
    `${options.outDirectory}/summary.json`,
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );
  log(`GOLDEN_BRIEF_SUMMARY ${JSON.stringify(summary)}`);
  return failures.length === 0 ? 0 : 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === pathToFileURL(invokedPath).href) {
  runLaunchPackHarness(process.argv.slice(2)).then(
    (exitCode) => {
      process.exitCode = exitCode;
    },
    (error: unknown) => {
      const safe = safeFailure(error);
      console.error(`HARNESS_ERROR ${safe.code}: ${safe.message}`);
      process.exitCode = 1;
    },
  );
}
