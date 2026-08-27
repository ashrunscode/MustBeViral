# Go-live orchestration plan: the agent-executable path to P0 exit

Work packet: WP-P0-001, step p0-005-golden-launch-pack-runs. Recorded 2026-08-11.

This plan is the operative execution queue for driving WP-P0-001 from its current position to a
P0 exit package. It synthesizes the accepted authorities (roadmap, quality gates, deploy runbook,
legacy retirement) and the Track A–F evidence into one ordered queue. It changes no authority: the
active packet, `PROJECT_STATE.yaml`, and the accepted documents keep their governing roles. Where
this plan and an authority disagree, the authority wins and this plan must be corrected.

Execution model: a planning agent (Claude) sequences, verifies, and reports; an implementation
agent (Codex CLI) performs the engineering one task at a time on `codex/viralgraph-cleanroom`.
Both agents commit. Every task ends with green verification, a conventional commit, a push, and a
structured report before the next task starts. Single-packet phase rules apply: no additional
linked worktrees, serial execution only.

## 1. What "go live" means from here

- The P0 exit is the ten all-must-pass validation gates (`docs/delivery/QUALITY_GATES.md`
  lines 42–58). They mix engineering gates (16/20 runs, latency, caps, perf, MCP parity) with
  human gates (80% unassisted completion, 70% usable concepts, evaluator preference, paid
  pilot). Engineering cannot substitute for the human gates.
- Production deployment, rollback, and the legacy-v1 → v2 cutover are P1a scope
  (`docs/delivery/ROADMAP.md` line 12, `docs/product/RELEASE_SCOPE.md` lines 20–22). No agent
  action in this plan touches production. The legacy production route stays live and untouched
  per `docs/operations/LEGACY_V1_RETIREMENT.md` (inventory only, DNS kept, 72-hour observation
  window after any future cutover, destructive action forbidden without a machine-readable
  inventory).
- Therefore the agent-executable "go live from here" is: complete every code-gated P0 item on
  staging, wire the real web product so evaluator sessions never touch fixtures, assemble the
  p0-007 gate-evaluation package, and hand the operator a decision-ready P0 exit with the P1a
  production work scoped as the successor.

## 2. Position at the time of writing

- Spend ladder ($0.04 → $0.0004 → $0.075 → $0.67 → ~$13): first three rungs proven live with
  evidence. The $0.67 rung (Track F, WashBodega August pack, run
  143e6229-cd55-4e10-b98b-290916589ae6, 2026-08-02) was attempted, settled 9 of 16 nodes, then
  stalled on the staggered-promotion dedupe defect, stranding 2,000,000 of 4,550,000 reserved
  micros. The defect is fixed (migration `20260802020000_p0_dispatch_epoch_and_stranded_sweeper`,
  regression suite 00023) and applied to staging, but `PROJECT_STATE.yaml` and `docs/STATUS.md`
  still narrate the ladder as if $0.67 were unattempted. That staleness is itself a defect: it
  invites double-spend planning.
- The poll-provider `reconciliation_required` trap is half-closed. The synchronous variant is
  closed by `20260731010000_p0_reap_stranded_synchronous_jobs`; the poll variant can still leave
  `runs.status` stuck after all attempts resolve, and `refund_run_capture` exists with zero
  application callers.
- Confirmation-token verification is real HMAC and wired into start_run (verified in code).
- The five private MCP operations are fully implemented over the shared REST handlers
  (`apps/core/src/routes/mcp.ts`); no p0-006 parity evidence exists yet.
- The web product is a fixture shell: real Supabase SSR session gating, no sign-in surface, zero
  Worker calls, no response schemas for the 18 REST operations, OpenAPI documents only
  `/health`.
- CI: Quality lane restored to green by the Prettier fix on the dispatch-epoch evidence
  (commit 718e056). Deploys are manual (`wrangler deploy` for core; no deploy CI exists), which
  is compliant for this phase.

## 3. Execution queue

Tasks run serially. A task is done only when its named checks pass, evidence is filed per the
established convention (claim-title, packet/step header, recorded date, numbered sections,
amendments appended), and the work is committed and pushed. Money-safety ordering is absolute:
no spend rung while a known money-path defect is open.

### T1 — Truth-sync and settlement closure (no spend)

1. Record the Track F attempt, its stranded-micros outcome, and the dispatch-epoch fix in
   `PROJECT_STATE.yaml` and `docs/STATUS.md` so governance narrates reality.
2. Close the poll-provider `reconciliation_required` exit: extend
   `record_provider_job_reconciliation` (or add a successor function) so `runs.status` leaves
   `reconciliation_required` when every attempt reaches a terminal state, mirroring the
   WHERE-guarded pattern of the synchronous fix. Forward-only migration plus pgTAP coverage,
   applied to staging under the section 5 doctrine below.
3. Give `refund_run_capture` an auditable caller or record the explicit decision that it stays
   an operator-SQL-only tool for P0; either way the decision lands in evidence.
4. Fix the `washbodega-pack-run.ts --start` "STATUS unknown" early-exit so an unattended run
   reports real progress; this defect hid the 40-minute Track F stall.
5. Prove staging carries no residue: no non-terminal run and no unexpired reservation from run
   143e6229; confirm `arm_stranded_dispatch` is wired into the live cron cycle before
   `dispatchPending`, not merely migration-applied.

### T2 — Track F completion: the $0.67 full-pack proof

Re-run the WashBodega August pack (two-phase `--prepare`/`--start`) against staging with the
fixed engine. Acceptance: all 16 nodes terminal, captured micros equal quoted micros with zero
residual, approval and export succeed, immutable receipt retrievable through the customer path,
evidence document filed. This closes the rung the 2026-08-02 attempt opened.

### T3 — Response contracts, sign-in, typed client (no spend)

1. Add Zod response schemas for the 18 P0 REST operations beside their input schemas; align them
   exactly with the hand-written result unions in `handlers.ts`; discriminate the success
   envelope; regenerate OpenAPI beyond `/health`; add the parity tests the API authority already
   requires.
2. Build the sign-in surface on the existing Supabase SSR plumbing (`/login` or landing-page
   form, redirect-back handling through `proxy.ts`); keep the `MBV_LOCAL_GOLDEN_PREVIEW` bypass
   dev-only.
3. Generate the typed client wrapping fetch with bearer JWT, `Idempotency-Key`, and
   `X-Request-Id` per the HTTP contract.

### T4 — Wire the seven screens to the real Worker (no spend until quote/run)

Replace fixture ports in money-safety order: canvas read → canvas patch/validate → quote →
run start/poll → review/approval → export/receipt. Preserve the golden-locked UI states — the
fixture scenarios (conflict, expired_quote, cap_exceeded, graph_invalid, review_incomplete)
already mirror the real error taxonomy. E2E against staging with a disposable authenticated
user. The production build must not contain a reachable fixture bypass.

### T5 — p0-005 acceptance: the 20-brief golden run (~$13)

Run the golden set through the launch-pack harness against staging. Acceptance per the packet:
at least 16 of 20 runs technically complete; median time to first reviewable static pack at
most 10 minutes, p90 at most 15; machine-readable evidence under
`governance/evidence/WP-P0-001/launch-pack-runs/`; caps transactionally enforced; no duplicate
submission or charge; every completed run carries lineage and an immutable receipt.

### T6 — p0-006: private MCP parity proof (no spend beyond trivial reads)

Drive the five MCP operations through MCP Inspector and two real clients against staging;
record contract-vector parity with REST semantics (success, validation, authorization,
conflict, expiry, explicit confirmation, idempotent replay, rate limit, provider ambiguity,
safe errors). File the evidence; advance the step ledger.

### T7 — p0-007 gate-evaluation package

Assemble the roll-up evidence for every automated gate (runs, latency, caps/dedup/ledger,
artifact trust, canvas and web performance, MCP parity, landed cost per usable pack) and the
prepared materials for the human gates, so the operator can run evaluator sessions and record
the exit decision without archaeology.

## 4. Delegation protocol

- One Codex run per task, launched from the repository root with the packet branch checked out.
  Codex must run `pnpm agent:preflight` first and stop on any packet validation failure.
- Verification before commit: `pnpm verify` for repository-wide changes, the packet's named
  gates for governance-visible changes, and the task's own acceptance checks. Database changes
  additionally prove staging application under the section 5 doctrine.
- Commits are conventional, scoped to the task, and pushed to
  `origin/codex/viralgraph-cleanroom` immediately so CI validates each increment.
- Each task returns a structured report: changed paths, checks run with results, evidence files
  written, exact spend (micros) if any, blockers, and one next action. The planning agent
  reviews the report and the diff before dispatching the next task.
- No task may broaden packet scope in the same change as implementation; scope amendments follow
  the packet's own spec-revision discipline in a separate governance commit.

## 5. Standing doctrines (from proven evidence; violations are defects)

- Staging migrations: MCP `apply_migration` plus md5(`pg_get_functiondef`) fingerprint
  comparison against a local Postgres 17 with the migration files applied. Never
  `supabase db push --linked`, never `db pull`, never `--status reverted`; the 18-row history
  divergence stays untouched pending an operator decision.
- Anything the privileged Worker calls is verified through the PostgREST path (REST `/rpc`,
  apikey, service_role), never only direct SQL — `pg_safeupdate` loads on API connections only.
- A fal queue submit returning 200 IN_QUEUE proves nothing; validation happens at execution, so
  route callability is proven only by reading a result body.
- Secrets never appear in code, evidence, logs, or reports; evidence records identifiers and
  readiness, not values.
- No remote destructive action, no production mutation, no legacy-v1 mutation. Staging only.
- Evidence documents follow the established naming and structure convention and are appended,
  never rewritten.

## 6. Operator (human) gates — outside agent reach

1. Five to eight paid evaluator sessions (all slots pending) and one signed paid pilot; sessions
   must run against the real web product (post-T4), never fixtures.
2. The P0 exit go/no-go decision; silence is not approval; any failed value, cost, or
   paid-demand gate records a pivot/stop decision.
3. The staging migration-history reconciliation decision (18 orphan rows; push refused by
   design).
4. Refund authorization policy (who may invoke `refund_run_capture`, on what evidence).
5. Disposition of the untracked single-use tool `apps/core/tools/approve-export-august-pack.ts`
   (superseded by the tracked generic probe; recommend deletion, operator's call).
6. Funding/authorization confirmation for the staging test account used by unattended harness
   runs.
7. Everything P1a: production provisioning, deployment, DNS cutover with named operator and
   observed rollback, the 72-hour observation window, disaster-recovery rehearsal before paid
   launch, and legacy retirement per its runbook.

## 7. Left open

- The ~$13 rung total is an estimate from the catalog price of 4,550,000 micros per pack times
  20 briefs; the exact figure lands with T5 evidence.
- Whether web performance evidence (p75 LCP/INP/CLS on the agreed production segment) can be
  gathered pre-cutover on staging is decided at T7; the gate text targets the production
  segment, which may defer final measurement to P1a with an operator-accepted staging proxy.
- This plan does not decide P1a sequencing beyond naming it the successor; WP-P1A-001 scoping
  happens at p0-008 per the packet.

## 8. Amendment 2026-08-21: owner-first activation window

The operator replaced the previously ambiguous single 72-hour launch observation with two explicit
audiences and two clocks. The full execution and evidence contract is recorded in
`owner-first-rollout-plan-2026-08-21.md`.

1. P0 remains staging-only until every accepted P0 gate passes and the operator records an explicit
   go decision. The operator may use the existing staging product now; this is rehearsal and does
   not count as qualified-evaluator, paid-pilot, production-performance, or production-launch proof.
2. After a governed P1a production deployment passes migrations, smoke, rollback, isolation,
   ledger, artifact, and telemetry checks, production stays closed for one continuous hour of
   automated and operator-observed canary health.
3. If that hour is clean, the operator account may begin production use. Self-service signup,
   invitations, and all non-operator production access remain disabled.
4. A new 72-hour owner-only stability window begins when the operator first receives production
   access. Other users may be admitted only after that entire window is clean and an explicit
   admission decision is recorded.
5. Any cross-tenant access, public artifact, duplicate provider submission or money movement,
   ledger imbalance, uncontrolled spend, signature bypass, Sev-1 incident, rollback, or unresolved
   provider ambiguity resets the active clock after verified remediation.

This amendment does not shorten the separate 72-hour zero-legacy-traffic observation required by
`docs/operations/LEGACY_V1_RETIREMENT.md` before legacy-resource retirement. It also does not
authorize P1a production work from the P0 packet.
