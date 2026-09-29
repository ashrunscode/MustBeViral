import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { HarnessFlowError } from './launch-pack-harness-lib';
import { parseCommonHarnessArguments, writeDryRunScaffold } from './p3-scale-evidence-lib';

export const HYPERDRIVE_WORKLOADS = ['W1', 'W2', 'W3', 'W4', 'W5'] as const;
export type HyperdriveWorkload = (typeof HYPERDRIVE_WORKLOADS)[number];

export const HYPERDRIVE_PATHS = ['baseline_data_api_rpc', 'candidate_hyperdrive_pooled'] as const;
export type HyperdrivePath = (typeof HYPERDRIVE_PATHS)[number];

export const HYPERDRIVE_THERMAL_STATES = ['cold', 'warm'] as const;
export type HyperdriveThermalState = (typeof HYPERDRIVE_THERMAL_STATES)[number];

export interface HyperdriveHarnessArguments {
  readonly common: ReturnType<typeof parseCommonHarnessArguments>;
  readonly path: HyperdrivePath;
  readonly workload: HyperdriveWorkload | 'mix';
  readonly thermal: HyperdriveThermalState;
  readonly loadRegion: string;
}

/**
 * Staging user-path Hyperdrive stays off until G1–G6 pass on a frozen fixture
 * manifest. Detects a real `hyperdrive` binding key, not the comment that says
 * the binding is intentionally absent.
 */
export function stagingEnvHasHyperdriveBinding(wranglerSource: string): boolean {
  const stagingStart = wranglerSource.indexOf('"staging":');
  const productionStart = wranglerSource.indexOf('"production":', stagingStart + 1);
  if (stagingStart < 0 || productionStart < 0) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: 'wrangler source must declare staging and production environments.',
    });
  }
  return /"hyperdrive"\s*:/.test(wranglerSource.slice(stagingStart, productionStart));
}

export function hyperdriveArgumentsFrom(argv: readonly string[]): HyperdriveHarnessArguments {
  const common = parseCommonHarnessArguments(argv, {
    durationSeconds: 300,
    rampSeconds: 30,
    vuTier: 50,
  });
  const path = parseEnum(argv, '--path', HYPERDRIVE_PATHS, 'baseline_data_api_rpc');
  const workload = parseWorkload(argv);
  const thermal = parseEnum(argv, '--thermal', HYPERDRIVE_THERMAL_STATES, 'warm');
  const loadRegion = argv.includes('--load-region')
    ? (argv[argv.indexOf('--load-region') + 1] ?? 'us-east')
    : 'us-east';
  return { common, path, workload, thermal, loadRegion };
}

function parseEnum<T extends string>(
  argv: readonly string[],
  flag: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (!argv.includes(flag)) return fallback;
  const value = argv[argv.indexOf(flag) + 1];
  if (value === undefined || !allowed.includes(value as T)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `${flag} requires one of: ${allowed.join(', ')}.`,
    });
  }
  return value as T;
}

function parseWorkload(argv: readonly string[]): HyperdriveWorkload | 'mix' {
  if (!argv.includes('--workload')) return 'W1';
  const value = argv[argv.indexOf('--workload') + 1];
  if (value === 'mix') return 'mix';
  if (value === undefined || !HYPERDRIVE_WORKLOADS.includes(value as HyperdriveWorkload)) {
    throw new HarnessFlowError({
      code: 'INVALID_ARGUMENTS',
      message: `--workload requires one of: ${[...HYPERDRIVE_WORKLOADS, 'mix'].join(', ')}.`,
    });
  }
  return value as HyperdriveWorkload;
}

export async function scaffoldHyperdriveEvidenceLayout(outDirectory: string): Promise<void> {
  const directories = ['raw', 'summary', 'identity', 'invariants'];
  for (const directory of directories) {
    await mkdir(join(outDirectory, directory), { recursive: true });
  }
  await writeFile(
    join(outDirectory, 'fixture-manifest.template.json'),
    `${JSON.stringify(
      {
        schema_version: 1,
        status: 'TBD',
        workspaces: 'TBD',
        canvases: 'TBD',
        tenants: ['TBD_A', 'TBD_B'],
        randomization_key: 'TBD',
        workloads: Object.fromEntries(HYPERDRIVE_WORKLOADS.map((workload) => [workload, 'TBD'])),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    join(outDirectory, 'run-manifest.template.json'),
    `${JSON.stringify(
      {
        schema_version: 1,
        status: 'TBD',
        commit_sha: 'TBD',
        staging_deployment_id: 'TBD',
        randomized_cell_order: 'TBD',
        supabase_region: 'TBD',
        load_regions: ['TBD'],
        observed_worker_colos: ['TBD'],
        paths: [...HYPERDRIVE_PATHS],
        thermal_states: [...HYPERDRIVE_THERMAL_STATES],
        vu_tiers: [1, 10, 50, 200],
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeFile(
    join(outDirectory, 'summary', 'decision-table.md'),
    `# Hyperdrive G1–G6 decision table\n\n| Gate | Status | Evidence |\n| ---- | ------ | -------- |\n| G1 | unchecked | TBD |\n| G2 | unchecked | TBD |\n| G3 | unchecked | TBD |\n| G4 | unchecked | TBD |\n| G5 | unchecked | TBD |\n| G6 | unchecked | TBD |\n`,
    'utf8',
  );
}

export async function runHyperdriveBenchmarkHarness(
  arguments_: HyperdriveHarnessArguments,
): Promise<Readonly<Record<string, unknown>>> {
  await scaffoldHyperdriveEvidenceLayout(arguments_.common.outDirectory);

  if (arguments_.common.mode === 'dry-run') {
    await writeDryRunScaffold({
      outDirectory: arguments_.common.outDirectory,
      gate: 'hyperdrive_g1_g6',
      notes: [
        'Scaffolded benchmark directory layout per RLS_HYPERDRIVE_BENCHMARK_PLAN.md.',
        'Staging candidate path requires operator-authorized Hyperdrive binding.',
        `Planned cell: path=${arguments_.path} workload=${arguments_.workload} thermal=${arguments_.thermal} vu=${arguments_.common.vuTier}`,
      ],
    });
    return {
      mode: 'dry-run',
      gate: 'hyperdrive_g1_g6',
      path: arguments_.path,
      workload: arguments_.workload,
      thermal: arguments_.thermal,
      vu_tier: arguments_.common.vuTier,
      out_directory: arguments_.common.outDirectory,
    };
  }

  if (arguments_.path === 'candidate_hyperdrive_pooled') {
    throw new HarnessFlowError({
      code: 'GATE_BLOCKED',
      message:
        'Hyperdrive candidate path is not enabled in staging wrangler.jsonc. Complete G1 role setup and operator authorization before candidate runs.',
    });
  }

  throw new HarnessFlowError({
    code: 'NOT_IMPLEMENTED',
    message:
      'Live Hyperdrive benchmark cells require fixture seeding and benchmark Worker deploy. Use dry-run scaffold, then follow governance/evidence/WP-P3-001/benchmarks/README.md.',
  });
}

async function main(): Promise<void> {
  const result = await runHyperdriveBenchmarkHarness(
    hyperdriveArgumentsFrom(process.argv.slice(2)),
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
