# Separate-executor isolation evidence layout

Parent runbook: `../staging-evidence-collection-runbook.md`  
Template: `../templates/separate-executor-isolation-evidence.template.yaml`

## Directory layout

```text
separate-executor/
  README.md
  separate-executor-isolation-evidence.yaml
  raw/
    vu-10__dispatch-probe__run-1.csv
    ...
  summary/
    fan-out-matrix.csv
    isolation-notes.md
```

## Collect

```bash
cd apps/core
corepack pnpm executor:isolation -- --dry-run --vus 10 --out ../../../governance/evidence/WP-P3-001/separate-executor
corepack pnpm executor:isolation -- --staging --vus 10 --dispatch-probe-only --out ../../../governance/evidence/WP-P3-001/separate-executor
```

**Do not deploy** a separate executor Worker until evidence passes. Baseline measurements on the
single Core Worker establish the trigger.
