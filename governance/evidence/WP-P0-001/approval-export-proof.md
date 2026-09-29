# The $0.075 approval-and-export proof, and the true root cause of every stranded settlement

Work packet: `WP-P0-001`, step `p0-005-golden-launch-pack-runs`. Track E of the completion plan.
Recorded 2026-07-31.

## 1. What this proves

One master plus one adaptation through the full pipeline, then approval and export — the two
operations no run had ever exercised. Quoted $0.70 (master 500,000 + adaptation 200,000 micros);
real provider cost roughly $0.075. Run `c2c9c00b-9739-4899-99ae-19c1a33e9d17`, workspace
`ffdb50e5-a79f-4b89-9149-004049e67ccc`, disposable identity, wallet credited $1.00 by operator
ledger movement.

First live exercise of, all in one run:

- **Wave promotion driving real spend.** The barrier created both attempts eagerly, marked only the
  master ready (wave 1), and held the adaptation pending at wave 2. When the master settled, the
  promotion ran live for the first time: adaptation `pending -> ready`, run `dispatch_wave 1 -> 2`,
  one new outbox event `...:dispatch:2` armed while `...:dispatch:1` stood `published`.
- **The Track C dispatch payload.** The adaptation node carries no prompt material; its prompt was
  composed from the run's brief and brand context, and its `image_url` was a minted capability URL.
- **Real Kontext spend through the repointed `fal-ai/flux-pro/kontext`** — the application the
  catalog previously mispinned.
- **`POST /runs/:id/approvals`**: HTTP 200, `approved=2`, both rows promoted to `approved_output`
  in place. Replay: `replayed=2`, descriptions not overwritten.
- **`POST /runs/:id/exports`**: HTTP 201 — the first successful export in the system's history,
  closing the last of the six original execution-engine defects. A second export of the same
  members returned a byte-identical ZIP (content hash equal), proving determinism live.
- **Money**: captured exactly 700,000 micros, released 0, residual 0.

## 2. The true root cause of every stranded settlement, found mid-proof

The run stalled exactly like the Track D copy incident: the master's capture landed at 20:35:30 and
the attempt still read `running` eleven minutes later. Same signature — capture done, advance never
lands.

The Track D investigation had fixed five real missing grants and then verified the SQL path by
calling the RPC directly, which succeeded — so the Worker-side cause was recorded as "not
conclusively isolated". This time the experiment that closes the question was run: **replicate the
Worker's PostgREST call byte-for-byte with curl** — same `/rest/v1/rpc/` endpoint, same
`apikey`-only headers, same JSON body. The answer was immediate:

```
HTTP 400 {"code":"21000","message":"DELETE requires a WHERE clause"}
```

`app_private.advance_run_readiness` cleared its per-transaction scratch table with a bare
`delete from pg_temp_run_edges;`. **Supabase loads `pg_safeupdate` on API connections only**, so
every call arriving through PostgREST — which is every call the Worker makes — failed with SQLSTATE
21000, while every direct-SQL validation (psql, the management tool, pgTAP as `postgres`) sailed
through. The Worker mapped the 400 to a retryable "unavailable", answered the webhook with 503, and
the provider redelivered forever.

Because `advance_run_readiness` runs inside every `settle_attempt_transition`, this broke the
terminal advance for **every provider**: the three copy attempts stranded at `submitted` in Track D
and this master stranded at `running` were the same bug. The five missing grants were real defects —
the dispatch cron genuinely failed on them — but fixing them only moved the failure one call further
down the chain.

**Fix**: `delete from pg_temp_run_edges where true;` — semantically identical, satisfies
`pg_safeupdate` — shipped as forward-only migration `20260731020000_p0_readiness_safeupdate_fix.sql`,
applied to staging, and swept: no other bare `DELETE`/`UPDATE` exists in any migration.

**Proof the fix works on the real path**: re-running the identical curl replication returned
HTTP 200 and settled the master through PostgREST. Everything after that was fully autonomous — the
cron dispatched the adaptation, fal generated it, the webhook ingested, captured and advanced it
with no manual intervention, and the run reached `succeeded` on its own. **This is the first fully
autonomous multi-wave settlement in the system's history.** Every prior "settled" run had a manual
SQL step hidden in it.

## 3. The verification doctrine this rewrites

`pg_safeupdate` makes "it works when I run the SQL myself" categorically insufficient for anything
the Worker calls. Three layers of verification all passed while production was broken:

| Layer                              | Why it lied                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| pgTAP suites                       | connect as `postgres`; `pg_safeupdate` not loaded on that path                                             |
| Direct SQL via the management tool | elevated connection, same exemption                                                                        |
| `pg_get_functiondef` fingerprints  | prove the body transferred, not that any role can run it, nor how the API connection treats its statements |

Standing rule, joining the grants lesson in the 00021 suite's header: verification of anything the
privileged Worker composition calls must replicate the PostgREST path — REST `/rpc` endpoint,
`apikey` header, `service_role` — or it proves nothing about production behaviour.

## 4. Also fixed in passing

`approve-export-probe.ts --start` refuses to resume polling an already-started run because it checks
quote expiry unconditionally; the check should only guard the first start. Cosmetic (the run itself
was unaffected; direct SQL confirmed terminal state), noted for the tool's next edit.

## 5. What this does not cover

- The full 16-node pack ($0.67) and the 20 golden briefs (~$13) remain — Track F.
- Seedance (motion) has still never had real spend; its first will be in the full pack.
- The export ZIP's _contents_ were verified by determinism and registration, not unpacked and
  visually inspected; the manifest/receipt internals are pinned by unit tests on
  `createDeterministicExport`.
