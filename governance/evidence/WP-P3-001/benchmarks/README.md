# Hyperdrive G1–G6 benchmark evidence layout

Authority: `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`  
Parent runbook: `../staging-evidence-collection-runbook.md`  
Template: `../templates/hyperdrive-g1-g6-evidence.template.yaml`

## Directory layout

Follows the benchmark plan evidence layout (adapted for WP-P3-001):

```text
benchmarks/
  README.md
  hyperdrive-g1-g6-evidence.yaml
  fixture-manifest.json
  run-manifest.json
  raw/
    <path>__<thermal>__<workload>__vu-<count>__<load-region>__run-<1-3>.csv
  summary/
    matrix.csv
    decision-table.md
    errors.csv
    conflicts.csv
  identity/
    role-verification.txt
    reset-cases.csv
    reuse-transitions.csv
  invariants/
    post-run-checks.csv
```

## Scaffold (dry-run)

```bash
cd apps/core
corepack pnpm hyperdrive:benchmark -- --dry-run --out ../../governance/evidence/WP-P3-001/benchmarks
```

## Staging matrix (operator)

Requires staging Hyperdrive binding and dedicated least-privilege role **outside** default repo
config. The harness fails fast if the candidate path is requested without operator authorization.

```bash
corepack pnpm hyperdrive:benchmark -- --staging --path baseline_data_api_rpc --workload W1 --thermal warm --vus 50 --out ../../governance/evidence/WP-P3-001/benchmarks
```

Run full Cartesian matrix per benchmark plan before filling evidence YAML.
