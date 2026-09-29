import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';

import { loadGoldenBriefRegistry } from './golden-brief-registry';
import { runGolden20StagingHarness } from './golden-20-staging-harness';
import {
  HarnessFlowError,
  USABLE_PACK_GATE_MICROS,
  createInMemoryHarnessTransport,
  executeGoldenBrief,
  type BriefRunRecord,
  type SafeHarnessError,
} from './launch-pack-harness-lib';
import {
  authenticateDisposableStagingUser,
  createConfirmedDisposableStagingUser,
  createDisposableIdentity,
  loadStagingAdminConfiguration,
  recoverConfirmedDisposableStagingUser,
} from './staging-auth';

const DEFAULT_OUT_DIRECTORY = fileURLToPath(
  new URL('../../../.scratch/launch-pack-harness/', import.meta.url),
);
type RegisteredGoldenBrief = Awaited<ReturnType<typeof loadGoldenBriefRegistry>>[number];

interface HarnessArguments {
  readonly mode: 'dry-run' | 'staging';
  readonly outDirectory: string;
  readonly expectProviderUnavailable: boolean;
  readonly briefIds: readonly string[];
  readonly expectedUtcDay?: string;
  readonly maximumReservationMicros?: bigint;
  readonly stopOnFailure: boolean;
}

function valuesFor(argv: readonly string[], flag: string): readonly string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] !== flag) continue;
    const value = argv[index + 1];
    if (value === undefined || value.length === 0 || value.startsWith('--')) {
      throw new HarnessFlowError({
        code: 'INVALID_ARGUMENTS',
        message: `${flag} requires a value.`,
      });
    }
    values.push(value);
  }
  return values;
}

function optionalValueFor(argv: readonly string[], flag: string): string | undefined {
  const values = valuesFor(argv, flag);
  if (values.length > 1) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} may be supplied at most once.`,
    });
  }
  return values[0];
}

export function harnessArgumentsFrom(argv: readonly string[]): HarnessArguments {
  const dryRun = argv.includes('--dry-run');
  const staging = argv.includes('--staging');
  if (dryRun === staging) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: 'Select exactly one mode: --dry-run or --staging.',
    });
  }
  const outDirectory = optionalValueFor(argv, '--out') ?? DEFAULT_OUT_DIRECTORY;
  const expectedUtcDay = optionalValueFor(argv, '--expected-utc-day');
  if (expectedUtcDay !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(expectedUtcDay)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--expected-utc-day requires YYYY-MM-DD.',
    });
  }
  const maximumReservationValue = optionalValueFor(argv, '--max-reserved-micros');
  if (maximumReservationValue !== undefined && !/^[1-9]\d*$/u.test(maximumReservationValue)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--max-reserved-micros requires positive integer micros.',
    });
  }
  return {
    mode: dryRun ? 'dry-run' : 'staging',
    outDirectory,
    expectProviderUnavailable: !argv.includes('--expect-provider-run'),
    briefIds: valuesFor(argv, '--brief'),
    ...(expectedUtcDay === undefined ? {} : { expectedUtcDay }),
    ...(maximumReservationValue === undefined
      ? {}
      : { maximumReservationMicros: BigInt(maximumReservationValue) }),
    stopOnFailure: argv.includes('--stop-on-failure'),
  };
}

export function selectGoldenBriefs(
  briefs: readonly RegisteredGoldenBrief[],
  briefIds: readonly string[],
): readonly RegisteredGoldenBrief[] {
  if (briefIds.length === 0) return briefs;
  if (new Set(briefIds).size !== briefIds.length) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: '--brief values must be unique.',
    });
  }
  const byId = new Map<string, RegisteredGoldenBrief>(
    briefs.map((brief) => [brief.briefId, brief]),
  );
  return briefIds.map((briefId) => {
    const brief = byId.get(briefId);
    if (brief === undefined) {
      throw new HarnessFlowError({
        code: 'INVALID_ARGUMENTS',
        message: `Unknown registered brief ${briefId}.`,
      });
    }
    return brief;
  });
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
  const options = harnessArgumentsFrom(argv);
  // Unique per invocation: makes every workspace slug globally unique and scopes
  // idempotency keys so a re-run never collides with prior-run state on staging.
  const runId = randomBytes(4).toString('hex');
  const briefs = selectGoldenBriefs(await loadGoldenBriefRegistry(), options.briefIds);
  await mkdir(options.outDirectory, { recursive: true });
  if (options.mode === 'staging') {
    const configuration = await loadStagingAdminConfiguration();
    const resumeEmailIndex = argv.indexOf('--resume-email');
    const resumeEmail = resumeEmailIndex < 0 ? undefined : argv[resumeEmailIndex + 1];
    const authentication =
      resumeEmail === undefined
        ? await (async () => {
            const identity = createDisposableIdentity();
            await createConfirmedDisposableStagingUser({ configuration, identity });
            return authenticateDisposableStagingUser({ configuration, identity, log });
          })()
        : await recoverConfirmedDisposableStagingUser({ configuration, email: resumeEmail });
    log('AUTHENTICATED disposable staging user');
    return runGolden20StagingHarness({
      briefs,
      outDirectory: options.outDirectory,
      accessToken: authentication.accessToken,
      log,
      ...(options.expectedUtcDay === undefined ? {} : { expectedUtcDay: options.expectedUtcDay }),
      ...(options.maximumReservationMicros === undefined
        ? {}
        : { maximumReservationMicros: options.maximumReservationMicros }),
      stopOnFailure: options.stopOnFailure,
    });
  }
  const transport = createInMemoryHarnessTransport();
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
