# P3-002 framework handoff — 2026-08-31

Work packet: WP-P3-001, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`

## What was prepared (in-repo)

| Artifact                                                     | Purpose                                             |
| ------------------------------------------------------------ | --------------------------------------------------- |
| `staging-evidence-collection-runbook.md`                     | Operator runbook for all three gates                |
| `operator-checklist.yaml`                                    | Quick checklist and gate-blocked list               |
| `templates/*.template.yaml`                                  | Fillable evidence YAML with TBD fields              |
| `backpressure/`, `benchmarks/`, `separate-executor/` READMEs | Output directory layouts                            |
| `p3-scale-evidence-lib.ts`                                   | Shared CSV, latency summary, closed-loop workers    |
| `p3-backpressure-harness.ts`                                 | Staging load for quote/validate (no provider spend) |
| `p3-hyperdrive-benchmark-harness.ts`                         | Benchmark matrix scaffold; blocks candidate path    |
| `p3-executor-isolation-harness.ts`                           | Dispatch-probe fan-out baseline (quote_run only)    |

## Gate-blocked (no implementation)

- Cloudflare Queue bindings
- Hyperdrive staging user-path enablement
- Separate executor Worker deploy
- Direct high-volume provider adapters
- BYOK routing

## Operator next action

Run backpressure harness at VU tiers 1/10/50/200 against staging, fill
`backpressure/backpressure-fan-out-evidence.yaml`, and sign operator acceptance — or seed Hyperdrive
fixtures per benchmark plan.

```bash
cd apps/core
corepack pnpm backpressure:harness -- --dry-run --vus 10 --out ../../governance/evidence/WP-P3-001/backpressure
```
