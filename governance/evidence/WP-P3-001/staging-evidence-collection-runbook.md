# P3 staging evidence collection runbook

Work packet: **WP-P3-001**, step `p3-002-scale-infrastructure`  
Branch: `codex/viralgraph-cleanroom`  
Authority: `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`, `p3-infrastructure-gates-pending.yaml`

## Purpose

This runbook prepares **operator-ready, repeatable staging measurements** for the three P3
infrastructure gates that remain **not met**. No gate implementation (queues, Hyperdrive user-path
enablement, separate executor, BYOK) may ship until a filled evidence artifact passes review.

**Safe defaults**

- Staging only. Never run these harnesses against production.
- No Cloudflare Queue bindings, executor deploys, or Hyperdrive staging enablement from this repo
  step alone.
- Default harness modes avoid provider spend (`quote_run`, `validate_graph`, graph reads only).
- Never commit secrets, JWTs, connection strings, signed URLs, or raw tenant identifiers.

## Gate status (2026-08-31)

| Gate                            | Status                                     | Evidence output directory                          |
| ------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| Queues / backpressure / fan-out | met                                        | `governance/evidence/WP-P3-001/backpressure/`      |
| Hyperdrive G1–G6                | deferred; procedure accepted, not executed | `governance/evidence/WP-P3-001/benchmarks/`        |
| Separate-executor isolation     | not_met                                    | `governance/evidence/WP-P3-001/separate-executor/` |

Queue implementation note (2026-09-01): `mustbeviral-v2-staging-outbox-dispatch` exists and is
bound to `mustbeviral-v2-staging-core` as `OUTBOX_DISPATCH_QUEUE`. Staging has
`p3_start_run_barrier_outbox_event_id` applied and `QUEUES_ENABLED` is `"true"`. The producer
sends `{ type: 'outbox.wake', event_id }` after `start_run_barrier` commit. Instant rollback
is set the var back to `"false"` and redeploy; do not delete the queue. Evidence:
`governance/evidence/WP-P3-001/queues/live-wake-path-2026-09-01.md`.

Roll-up: `governance/evidence/WP-P3-001/p3-infrastructure-gates-pending.yaml`

## Operator prerequisites

1. Staging Core Worker URL: `https://mustbeviral-v2-staging-core.ernijs-ansons.workers.dev`
2. Disposable staging credentials via `apps/core/.dev.vars` or environment (`STAGING_TEST_EMAIL`,
   `STAGING_TEST_PASSWORD`, `SUPABASE_SERVICE_ROLE_KEY` for admin provisioning only).
3. Cloudflare dashboard access for Worker observability (CPU time, subrequests, errors, cron).
4. For Hyperdrive candidate runs only: dedicated least-privilege Postgres role, staging Hyperdrive
   binding, and operator authorization to add the binding (not present in repo as of 2026-08-31).
5. Rollback plan documented before any binding or deploy change (see each section).

## Shared workflow

```text
1. pnpm agent:preflight
2. Run harness in --dry-run to validate arguments and output layout
3. Run harness against staging with operator credentials
4. Copy template YAML → filled evidence file; replace every TBD field
5. Attach raw CSV + summary artifacts under the gate directory
6. Operator signs acceptance in the evidence YAML
7. Update p3-infrastructure-gates-pending.yaml gate status → met (only when complete)
8. pnpm agent:verify && pnpm agent:handoff
```

Harness entry points (from `apps/core`):

```bash
corepack pnpm backpressure:harness -- --dry-run --vus 10 --out ../../governance/evidence/WP-P3-001/backpressure
corepack pnpm hyperdrive:benchmark -- --dry-run --out ../../governance/evidence/WP-P3-001/benchmarks
corepack pnpm executor:isolation -- --dry-run --out ../../governance/evidence/WP-P3-001/separate-executor
```

Replace `--dry-run` with `--staging` only when ready to collect live measurements.

---

## Gate 1 — Queues / backpressure / fan-out

### Trigger (must be measured)

Per `docs/architecture/EXECUTION_PROVIDERS_AND_BILLING.md`: queues require **measured Worker
backpressure or fan-out** on a representative launch-pack workload, with rollback plan and
kill-switch path.

### What to measure

| Metric                                      | Source                           | Pass-oriented signal                                         |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------ |
| Worker-side operation latency (p50/p95/p99) | `p3-backpressure-harness.ts` CSV | Sustained p95 degradation or timeouts under closed-loop load |
| Unexpected error rate                       | harness `outcome` column         | >1% at representative concurrency suggests capacity limit    |
| Subrequest / CPU limit signals              | Cloudflare observability         | Approaching Worker limits during launch-pack mix             |
| Outbox dispatch lag                         | `outbox_events` age + cron logs  | p95 dispatch delay >1s target under concurrent quotes/runs   |
| Cron recovery backlog                       | scheduled reconciler metrics     | Abandoned events not recovered within 2-minute target        |

### Procedure

1. **Baseline (no queues)** — record current synchronous Core Worker behavior.
2. **Prepare fixtures** — one disposable workspace with a golden launch-pack graph (GB-02 recommended).
3. **Load tiers** — run harness at VU `1`, `10`, `50`, `200` with 30s ramp and 5-minute measured
   window per tier. Default operations: `quote_run` + `validate_graph` (no provider spend).
4. **Optional fan-out tier** — only with explicit operator budget: add `--include-dispatch-probe` to
   exercise outbox fan-out without completing paid provider runs (see harness help).
5. **Export observability** — capture Cloudflare Worker analytics screenshots or exported JSON for the
   measurement window (sanitize account IDs).
6. **Fill evidence** — copy
   `templates/backpressure-fan-out-evidence.template.yaml` →
   `backpressure/backpressure-fan-out-evidence.yaml`.

### Rollback (pre-implementation)

- Do not add queue bindings until evidence is accepted.
- If queues are later enabled: disable consumers via kill-switch / wrangler env var before namespace
  deletion.
- Git revert remains the code rollback path.

### Harness

`apps/core/tools/p3-backpressure-harness.ts` — see `backpressure/README.md`.

---

## Gate 2 — Hyperdrive G1–G6 benchmark matrix

### Trigger (must be measured)

Complete benchmark matrix per `docs/research/RLS_HYPERDRIVE_BENCHMARK_PLAN.md`. All six gates (G1–G6)
must pass before user-scoped barrier enablement on Hyperdrive.

### What to measure

| Gate | Workloads                                       | Pass rule (summary)                                 |
| ---- | ----------------------------------------------- | --------------------------------------------------- |
| G1   | role verification SQL                           | Dedicated login role; not owner/superuser/BYPASSRLS |
| G2   | reset-cases after commit/rollback/error/timeout | No residual session context                         |
| G3   | same-backend A↔B reuse (≥100 per VU tier)       | Zero cross-tenant leakage                           |
| G4   | W2/W3/W4 conflict + invariant checks            | Barrier recheck inside transaction                  |
| G5   | matched baseline vs candidate p95               | ≥20% faster on W2 + aggregate mix at 50 VU          |
| G6   | 50 VU US-East cold/warm                         | candidate p95 ≤250 ms, p99 ≤500 ms, error ≤1%       |

Workloads W1–W5, thermal states, VU tiers, and evidence layout are defined in the benchmark plan.
The harness scaffolds directory layout and CSV headers; **staging Hyperdrive binding is intentionally
absent** from `apps/core/wrangler.jsonc` until G1–G6 pass.

### Procedure

1. Use the accepted procedure in
   `benchmarks/hyperdrive-fixture-seed-procedure-2026-09-01.md` (plan corpus,
   tenants A/B, rollback). WP-P3-001 deferred execution; successor WP-P3-002 may
   seed. Do not invent a different corpus.
2. Commit `fixture-manifest.json` with byte counts and hashes.
3. Deploy benchmark build with **both** paths behind staging-only route selection (operator action).
4. Run `p3-hyperdrive-benchmark-harness.ts` for each matrix cell (3×5 min runs per cell).
5. Execute identity/isolation suites → `identity/` artifacts.
6. Run conflict scenarios at 10/50/200 VU.
7. Complete `summary/decision-table.md` with pass/fail per gate.
8. Fill `templates/hyperdrive-g1-g6-evidence.template.yaml`.

### Rollback

- Keep Data API/RPC baseline. Disable candidate route flag; remove Hyperdrive binding only with
  recorded binding ID and operator acceptance.
- Local Hyperdrive `postgres` superuser success **does not** prove G1.

### Harness

`apps/core/tools/p3-hyperdrive-benchmark-harness.ts` — see `benchmarks/README.md`.

---

## Gate 3 — Separate-executor isolation

### Trigger (must be measured)

Measured **fan-out and isolation benchmark** proving Core Worker CPU/subrequest limits or deploy
isolation requirements, with rollback plan.

### What to measure

| Metric                      | Purpose                                                              |
| --------------------------- | -------------------------------------------------------------------- |
| Concurrent dispatch fan-out | Count simultaneous outbox dispatches / subrequests per run wave      |
| Worker isolation boundary   | Prove execution load can be isolated without second policy authority |
| Error containment           | Failures in execution path do not block REST/command ingress         |
| Rollback drill              | Disable executor route; Core Worker resumes synchronous dispatch     |

### Procedure

1. Record baseline single-Worker fan-out under controlled concurrent `start_run` probes (operator
   budget required) or synthetic outbox load via `--dispatch-probe-only`.
2. Document target isolation claim (CPU, subrequests, deploy cadence).
3. Run `p3-executor-isolation-harness.ts` at VU tiers 10/50/200.
4. Capture observability split: ingress vs execution CPU time (pre-executor this is baseline only).
5. Fill `templates/separate-executor-isolation-evidence.template.yaml`.
6. **Do not deploy** a separate executor Worker until this evidence passes.

### Rollback

- Executor enablement requires route disable + Git revert.
- Postgres remains authoritative; executor never owns ledger or revision head.

### Harness

`apps/core/tools/p3-executor-isolation-harness.ts` — see `separate-executor/README.md`.

---

## Evidence templates

| Template                                                       | Filled output                                                 |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| `templates/backpressure-fan-out-evidence.template.yaml`        | `backpressure/backpressure-fan-out-evidence.yaml`             |
| `templates/hyperdrive-g1-g6-evidence.template.yaml`            | `benchmarks/hyperdrive-g1-g6-evidence.yaml`                   |
| `templates/separate-executor-isolation-evidence.template.yaml` | `separate-executor/separate-executor-isolation-evidence.yaml` |

## Acceptance checklist

- [ ] At least one gate has complete raw CSV, summary, and filled YAML (no `TBD` fields).
- [ ] Rollback plan recorded and operator acceptance signed.
- [ ] `p3-infrastructure-gates-pending.yaml` updated for passed gate(s) only.
- [ ] `pnpm agent:verify` green after evidence commit.
- [ ] No queue bindings added to any `wrangler.jsonc` unless backpressure gate passed.
- [ ] No Hyperdrive staging binding added unless G1–G6 evidence package complete.

## Gate-blocked implementation (honest status)

Until at least one gate above is **met**, step `p3-002-scale-infrastructure` cannot implement:

- Cloudflare Queue producers/consumers
- Separate executor Worker deploy
- Hyperdrive user-path enablement on staging/production Core
- Direct high-volume provider adapters beyond current fal transport
- BYOK routing

In-repo scaffolding prepared in this step is **measurement-only** and does not bypass gates.
