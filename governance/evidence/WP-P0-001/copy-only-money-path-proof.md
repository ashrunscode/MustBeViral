# The $0.0004 copy-only money-path proof, and three grant defects it caught live

Work packet: `WP-P0-001`, step `p0-005-golden-launch-pack-runs`. Track D of the completion plan.
Recorded 2026-07-31.

## 1. What this proves

The plan's own words: _"the whole money path for less than a tenth of a cent... exercises artifact
registration, capture, attempt advance, run terminalization, terminal release, zero residual, and the
receipt — at 1% of the cost of proving it with images."_

A disposable staging workspace was quoted a 3-node copy-only graph (three `copy_set` nodes, no
masters/adaptations/motion), credited $0.50 by direct ledger movement (the only funding path in P0 —
there is no self-serve top-up, and `record_ledger_movement` requires the `postgres`/`service_role`
identity, which no REST caller has), then started for real against OpenRouter.

**Result, read back through the same `GET /v1/runs/:id/receipt` a real customer would call:**

```
run.status:  succeeded
reservation: { amount_micros: 450000, captured_micros: 450000, released_micros: 0,
               refunded_micros: 0, status: "captured" }
artifacts:   3 x { artifact_kind: "provider_output", mime_type: "application/json" }
workspace ledger balance: 0 (double-entry, checked across every account)
```

Quoted total $0.45 (3 × 150,000 micros, the pinned catalog price), captured exactly $0.45, zero
residual, three JSON artifacts registered, run terminal. Real OpenRouter cost for three short
completions was roughly $0.0004 — recorded as `provider_cost_micros` in each capture's ledger
metadata, never what the customer was charged.

## 2. Harness

New permanent tool: `apps/core/tools/copy-only-money-path-probe.ts`, run via `pnpm exec tsx`. Mirrors
`washbodega-pack-run.ts`'s two-phase `--prepare`/`--start` convention deliberately: `--prepare` builds
the canvas and takes a real named-price quote (using the server-minted `confirmationToken` from the
quote response, not an invented string — `single-image-canary.ts` still hardcodes a fake token and
would now fail against the real HMAC verification Track A's A5 fix added); `--start` spends. The
wallet credit happens between the two, out of band, because `record_ledger_movement` is
privileged-only.

Three copy nodes rather than one, deliberately: `create_quote`'s wave walk puts every `copy_set` node
in wave 1 regardless of count, but three exercises `settle_attempt_transition`'s readiness advance
being invoked three times against the same run rather than once — which a single node would not.

Disposable identity: signed up via `/auth/v1/signup`, confirmed by direct `UPDATE auth.users SET
email_confirmed_at = now()` (the operator-approved test-user-confirmation path), signed in for a real
JWT. No secret was printed or committed.

## 3. Three grant defects found live, none of them visible in `pnpm verify` or pgTAP

The run stalled for roughly 20 minutes holding a live $0.45 reservation before any of this was fixed.
`wrangler tail` caught the root cause directly:

```
ProviderError: provider outbox persistence rejected the privileged credential
  at misconfigured (index.js:22605)
  at SupabaseProviderOutboxPort.claimPending
  at OutboxDispatcher.dispatchPending
  at runProviderScheduled
```

**Root cause:** `DROP FUNCTION` clears every grant on an object. Adding OUT columns to
`get_outbox_dispatch_attempts` (Track C) required a drop-and-recreate rather than `create or replace`
(which cannot change a function's row type), and the migration only reissued the `revoke all ... from
public` line — never the `grant execute ... to service_role` the original definition carried. The
repository's default-privileges bootstrap
(`20260719010000_p0_authoritative_schema.sql:5-9`) revokes execute on every _future_ function from
`public, anon, authenticated, AND service_role`, so a fresh `CREATE FUNCTION` starts fully closed. The
function compiled, applied cleanly, and matched its `pg_get_functiondef` fingerprint exactly against
the local verification container — **fingerprint matching proves the body transferred correctly; it
says nothing about grants**, which live outside the function definition entirely. That gap in my own
verification method is what let this ship.

Two more of the same shape, both new functions from Track D's copy-terminal-path migration, neither
ever granted at all: `get_provider_artifact_context` and `advance_copy_provider_attempt`.

All three fixed on staging immediately (`grant execute on function ... to service_role`) and in the
source migrations (`20260730070000_p0_dispatch_brief_and_upstream.sql`,
`20260730080000_p0_copy_terminal_path.sql`), so a fresh apply from these files ships correctly granted
from the start.

## 4. A fourth and fifth defect, pre-existing from before this session's Track C/D work

Building a regression guard for the above (see §5) surfaced two more functions with the identical
shape, from Track A: `reap_dead_dispatch` (the dead-dispatch reaper) and
`finalize_cancel_requested_runs` (the cancellation finalizer). Both were written with only `revoke all
... from public` and never a matching grant, from the very first migration that created them
(`20260730010000_p0_reap_dead_dispatch.sql`, `20260730030000_p0_run_cancellation.sql`).

Both are called exclusively through the privileged Worker composition's `#rpc(...)`, so both have
almost certainly been unreachable by the actual cron invocation since they were introduced. Track A's
own evidence record validated the reaper "against the two real stranded runs: 2 terminalized, 32
attempts canceled" — that validation called the RPC **directly as `postgres`**, which bypasses grants
entirely and never exercised the path the cron uses at runtime. The same blind spot pgTAP has (see
§6). Fixed identically on staging and in both source files.

## 5. Regression guard added

New suite `supabase/tests/database/00021_p0_privileged_rpc_grants.test.sql`: 17 assertions, one per
service-role-privileged RPC, enumerated by grepping every literal and dynamic `#rpc(...)` call site in
`apps/core/src/composition/*.ts`. Each asserts
`has_function_privilege('service_role', '<exact signature>'::regprocedure, 'execute')`. A future
drop-and-recreate that forgets the grant now fails this suite instead of shipping silently.

`app_private.*` functions (`advance_run_readiness`, `settle_attempt_transition`) are deliberately
excluded: they are called only from within other `security definer` functions, which execute as the
_owner_, not the invoking role, so they need no direct grant of their own. Confirmed by checking
`has_function_privilege('service_role', ...)` returns `false` for both while the nested call chain
through them (via `advance_copy_provider_attempt` -> `settle_attempt_transition` ->
`advance_run_readiness`) works correctly once the _entry-point_ functions are granted.

## 6. The verification method's blind spot, named explicitly

Two independent things bypass `service_role` grants and would both report success on a function the
Worker can never actually call: pgTAP's local suite connects as `postgres` (superuser), and any manual
`select public.some_rpc(...)` run through this session's Supabase MCP tool also executes as the
connection's own elevated role. **Neither proves the privileged Worker composition — which calls
through PostgREST as `service_role` — can reach the function.** This is exactly how three grants
shipped invisibly today and two more shipped invisibly days ago. Section 5's suite closes this for the
known RPC surface; a new privileged RPC that is not added to that suite's list still passes silently,
which is a real, acknowledged gap rather than a claim of completeness.

## 7. A defect this proof did not require, but should not ship unaddressed

While root-causing, three of the copy attempts reached `submitted` with `provider_jobs` in
`normalized_evidence` unchanged for roughly 20 minutes even _after_ the grant fix landed and a fresh
cron tick had already re-leased the event — the SQL side genuinely works (proven: calling
`advance_copy_provider_attempt` directly settled all three attempts immediately, with no error).
Whatever the Worker-side cause, the practical consequence is a real gap: **once an attempt leaves
`created`, `get_outbox_dispatch_attempts`'s dispatch gate (`and attempt.status = 'created'`) never
selects it again**, so a copy attempt whose synchronous settlement fails after `record_provider_submission`
but before `advance_copy_provider_attempt` succeeds has **no automatic retry path** — only manual
intervention, as performed here. Track E's reconciler work already plans to give a similar class of
stranded fal delivery a real recovery path; extending that to a `submitted` OpenRouter job with no
terminal attempt status is now folded into that track rather than deferred separately.

## 8. What this does not cover

- The full-pack proof at $0.67 (Track F) still has adaptation/master/motion routes unexercised for
  real spend since the Kontext repoint.
- The Worker-side root cause in §7 was not conclusively isolated — only worked around by proving the
  SQL path independently and by fixing every grant defect the investigation surfaced. If it recurs
  with the reconciler fix in place, that fix is the safety net, not a diagnosis.
