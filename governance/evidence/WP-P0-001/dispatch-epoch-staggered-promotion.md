# Staggered promotion inside a wave silently dropped every batch after the first

**Work packet:** WP-P0-001 (p0-005)
**Found:** 2026-08-02, during the first live WashBodega August promotion pack (Track F)
**Run:** `143e6229-cd55-4e10-b98b-290916589ae6`, workspace `81672f57-2086-40c7-b541-c27b998c262f`
**Fix:** migration `20260802020000_p0_dispatch_epoch_and_stranded_sweeper.sql`
**Regression suite:** `supabase/tests/database/00023_p0_dispatch_epoch_staggered_promotion.test.sql`

## 1. What happened

The pack started cleanly and settled nine of sixteen nodes: three copy nodes (wave 1), three masters
(wave 2), and three of the ten wave-3 nodes. Then it stopped. Seven nodes sat at `ready` with a
`created` attempt, and nothing moved for forty minutes.

The run tool reported `STATUS unknown` and exited, which is a separate reporting defect (see §6) -
it reads a field the response does not carry and treats the unknown value as terminal. The engine
state had to be read directly from the database.

## 2. Root cause

`app_private.advance_run_readiness` armed one outbox event per WAVE:

```sql
dedupe_key = 'run:' || p_run_id || ':dispatch:' || v_next_wave
...
on conflict (dedupe_key) do nothing;
```

Readiness inside a wave is **not** simultaneous. Each child is promoted when its own parents finish,
so wave 3 - nine adaptations plus one motion node, fed by three different masters - is promoted in
three separate batches:

| time (UTC) | event                                                      | result                    |
| ---------- | ---------------------------------------------------------- | ------------------------- |
| 01:04:13   | master-2 settles, promotes adaptation-2-1/2/3              | arms `...:dispatch:3`     |
| later      | master-1 settles, promotes adaptation-1-1/2/3              | key collides, **dropped** |
| later      | master-3 settles, promotes adaptation-3-1/2/3 and motion-1 | key collides, **dropped** |

Seven nodes were left dispatchable with nothing queued to dispatch them.

The comment above that insert claimed the collapsing key was "what makes calling this twice safe."
That was wrong on its own terms: replay safety comes from the `v_promoted = 0 then return` guard
higher in the function, which returns before reaching the insert because a replayed settlement
promotes nothing. The dedupe key was not protecting replays - it was destroying legitimate second
promotions.

A second flaw compounded it. `v_next_wave` is `min(dispatch_wave)` across everything still ready, so
while masters 2 and 3 were outstanding, the wave-3 promotions were stamped **wave 2**. The wave label
in the key neither identified the batch nor described what would dispatch. The dispatch gate ignores
it entirely and takes every `ready` node with a `created` attempt.

## 3. Why it was unrecoverable, not merely slow

`reap_dead_dispatch` rescues a run only when it holds a `dead` dispatch event. All three events here
reached `published` normally - the dispatcher ran, took the work it could see, and finished. Nothing
in the system had a path from "ready attempt with no event" back to progress.

Consequence: the run could never terminalize, so the reservation remainder was never released.
2,000,000 of the 4,550,000 reserved micros would have stayed reserved permanently.

## 4. Why no earlier gate caught it

Every proof to date used a shape where the bug is invisible:

- **$0.0004 copy proof** - three copy nodes, one wave, one promotion.
- **$0.075 approve/export proof** - one master and one adaptation. A single parent, so wave 2 had
  exactly one promotion batch.
- **Suite 00019** settles an entire wave in one `update`, then advances readiness once. That is the
  one shape the old key handled correctly.

The defect needs a wave with two or more parents finishing at different times. That is every
realistic pack and no test the repo had.

## 5. The fix

**Cause.** A per-run monotonic `runs.dispatch_epoch`, taken in the same statement that advances
`dispatch_wave`, is appended to the key: `run:<id>:dispatch:<wave>:<epoch>`. Distinct promotion
batches always produce distinct events; `dispatch:3:2` still reads as "wave 3, second batch" for
auditing. Replay safety is unchanged and now rests where it always actually rested - the promotion
count guard.

**Category.** New `public.arm_stranded_dispatch(p_limit)`, run first in the scheduled cycle. It arms
an event for any live run holding `ready` + `created` work with no `pending` or `leased` dispatch
event. This covers causes beyond the epoch bug (an event lost, a crash between promotion and insert),
and is what recovers runs already stranded by the old keying. Arming a redundant event is a no-op,
because the dispatch gate simply finds no attempts - which is what makes it safe to run every minute.

It runs **before** `dispatchPending` so rescued work moves in the same cycle, and before
`reapDeadDispatch` so a rescuable run is never reaped as finished.

`service_role` was granted execute explicitly, per the standing doctrine that the default-privileges
bootstrap revokes it from every new function.

## 6. Verification

- 24 pgTAP suites, 386 assertions, green locally.
- **The regression suite was proven to fail against the pre-fix function**: restoring
  `20260731020000`'s `advance_run_readiness` into the harness makes 5 of 14 assertions fail,
  including "a second promotion in the same wave arms its own event rather than colliding."
  A regression test never seen to fail proves nothing; this one was seen to fail.
- `pnpm verify` 14/14.
- Applied to staging and verified live: `dispatch_epoch` column present, key carries the epoch,
  `service_role` holds execute on the sweeper.

## 7. Left open

**The pack runner's status reporting is broken.** `washbodega-pack-run.ts --start` printed
`STATUS unknown` and exited immediately, twice, while the run was healthy and advancing. It cannot
read the run status from the response and treats the unparsed value as terminal. This is the same
class of defect Track G1 exists to close - success bodies come from reflection, with no response
contract to validate against - and it is why a stalled run went unnoticed for forty minutes. Not
fixed here; it belongs with G1.

**Local harness hardening.** `.scratch/local-pgtap.sh` now waits for the container's graphql
extension to finish installing before applying migrations. `pg_isready` returns true while the image
is still creating extensions, and a migration landing in that window fails with
`could not open relation with OID`.
