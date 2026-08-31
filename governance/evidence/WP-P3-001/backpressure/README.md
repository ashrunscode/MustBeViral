# Backpressure / fan-out evidence layout

Parent runbook: `../staging-evidence-collection-runbook.md`  
Template: `../templates/backpressure-fan-out-evidence.template.yaml`

## Directory layout (operator fills after runs)

```text
backpressure/
  README.md
  backpressure-fan-out-evidence.yaml    # copied from template, all TBD replaced
  raw/
    vu-1__quote-validate__run-1.csv
    vu-10__quote-validate__run-1.csv
    ...
  summary/
    matrix.csv
    observability-notes.md
```

## Raw CSV columns

`run_id`, `sample_id`, `utc_time`, `operation`, `vu_tier`, `elapsed_ms`, `outcome`, `error_class`,
`http_status`, `expected_outcome`

## Collect

```bash
cd apps/core
corepack pnpm backpressure:harness -- --dry-run --vus 10 --out ../../../governance/evidence/WP-P3-001/backpressure
corepack pnpm backpressure:harness -- --staging --vus 10 --duration-seconds 300 --out ../../../governance/evidence/WP-P3-001/backpressure
```

Repeat for VU tiers 1, 10, 50, and 200 per runbook.
