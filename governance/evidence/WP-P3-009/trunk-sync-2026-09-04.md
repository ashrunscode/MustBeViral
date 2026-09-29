# Trunk sync with origin, Cursor automation stop, PR #3 closure — 2026-09-04

Owner decision recorded 2026-09-04 (ship-plan decision #19): stop the Cursor daily agent, sync the
local trunk with origin and push it once, close PR #3.

## State before

- Local `codex/viralgraph-cleanroom` in `C:\dev\MustBeViral` was **88 commits ahead** of
  `origin/codex/viralgraph-cleanroom` and **4 behind**. Every local packet commit since `5dc74e0`
  (2026-08-30), covering WP-P1A through WP-P3-009, had never been pushed.
- The 4 remote-only commits (`f51031a`, `1f05045`, `1deaf0b`, `cd6613b`) were authored by
  `Cursor Agent <cursoragent@cursor.com>` at ~14:00 UTC on 2026-08-31, 09-01, 09-02 and 09-04. They
  added eight files under `governance/evidence/WP-P0-001/` (`recruiting-inbox-check-*.md`,
  `agent-handoff-*.md`) and appended their paths to `docs/delivery/ACTIVE_WORK_PACKET.yaml`, which on
  the remote still described `WP-P0-001` as in progress.
- A verified bundle backup was taken first: `C:\Users\ernij\Backups\mustbeviral-2026-09-04.bundle`
  (`git bundle verify` ok).

## Why a merge, not a rebase

`governance/scripts/validate-transition-receipts.mjs` requires every receipt's `predecessor_head` to
exist **and** be an ancestor of HEAD. A rebase rewrites the 88 local commits, so all 15 receipts
written after 2026-08-30 would fail `transition:check`, which is part of `governance:check`. A
scratch-clone dry run confirmed: rebase → receipts broken; `git merge --no-ff` → 15/15 receipts still
valid, one conflict.

## What was done

1. `git merge --no-ff origin/codex/viralgraph-cleanroom` into local. Single conflict in
   `docs/delivery/ACTIVE_WORK_PACKET.yaml`, resolved by keeping the local WP-P3-009 packet (the
   remote edits belonged to the long-closed WP-P0-001 packet). The eight Cursor evidence files are
   kept as history. Merge commit `17911b5`.
2. Local gates before push: `pnpm governance:check` green, `pnpm format:check` green.
3. `git push origin codex/viralgraph-cleanroom` (non-force, fast-forward on origin):
   `cd6613b..17911b5`.
4. PR #3 (`codex/wp-p3-008-production-foundation` → `main`, 100 commits, all ancestors of the trunk)
   closed as superseded with a comment. Cursor draft PRs #2 (trunk → `main`) and #4
   (`cursor/agent-operational-guidelines-0ead` → trunk) were left open for the owner.
5. Cursor Cloud automation **"MustBeViral P0 loop"** (id `dd2ed993-a27f-11f1-b532-320a589b8025`,
   trigger every day 09:00 CDT, model `cursor-grok-4.6-high-fast`, tools Open Pull Request +
   Memories, repository `ashrunscode/MustBeViral`) toggled **Inactive** and saved at
   `cursor.com/automations`; the list view confirmed `Inactive` after a reload. Its instructions
   directed it to work only inside the active packet's allowed paths and open pull requests, but its
   runs committed straight onto the trunk because it checked out `codex/viralgraph-cleanroom` and
   pushed it. The other automation ("Untitled") was already inactive.

## CI results on the push (`17911b5`)

- Governance run `33917724104`: **failure**, job `governance`, step "Validate push committed diff
  scope": 97 findings, every one `changed path is outside base packet WP-P0-001`. Expected once:
  `validate-diff-scope.mjs` reads the packet at the merge base (`github.event.before` =
  `cd6613b`, whose packet is WP-P0-001), so an 88-commit catch-up push cannot pass. No other check
  failed in that job. Later pushes are validated against `17911b5` (packet WP-P3-009).
- Quality run `33917724059`: job `quality` (`pnpm verify`) **success**; job `database-pgtap`
  **failure**, step "Run pgTAP database suite" — see the finding below.
- The same two results appear on the pull-request event for the Cursor draft PR #2
  (`33917727163`, `33917727165`).

## New finding — pgTAP suite fails in CI on the trunk

This push was the first time CI ever ran the pgTAP job on the P1–P3 chain. Three of 38 files fail:

| File                                                                          | Failure              | First error                                                                                                                      |
| ----------------------------------------------------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/tests/database/00029_p1a_stripe_wallet_settlement.test.sql`         | planned 8, ran 5     | line 140: `operator does not exist: uuid = text`                                                                                 |
| `supabase/tests/database/00032_p1b_oauth_scope_and_revocation.test.sql`       | 4/14 subtests failed | line 223: `permission denied for table oauth_access_tokens` (hint: `GRANT INSERT ON public.oauth_access_tokens TO service_role`) |
| `supabase/tests/database/00034_p2_collaboration_checkpoint_revision.test.sql` | 6/6 failed           | line 119: `FORBIDDEN` raised by `public.apply_canvas_revision`                                                                   |

All three tests were last changed on 2026-08-31 (`712dc4e`, `87c5ea0`, `1ad6e0c`). The migrations
added afterwards are `5975de2` (2026-08-31 21:19), `3110c7a` (2026-09-02, "force production RLS on
all application tables") and `e26e7c9` (2026-09-02). WP-P3-007's evidence states the full local
pgTAP suite could not be run at that time because another local Supabase project owned port 54322,
so the hardening migration was never proved against these three tests. The failures are consistent
with force-RLS and grant changes made by `3110c7a`; root cause is to be confirmed by running the
suite locally on an isolated port.

Consequence: the trunk's database contract is not fully proven. The ship plan records this as owner
decision #20 (which packet repairs the three tests: a dedicated small packet after WP-P3-010 is the
recommendation, before any new migration in WP-P4-003). No production mutation was made; nothing in
this note changes the WP-P3-009 objective.

## Verification commands

```text
git status --short --branch              # "## codex/viralgraph-cleanroom...origin/codex/viralgraph-cleanroom" (no ahead/behind)
git log -1 --format=%h origin/codex/viralgraph-cleanroom   # 17911b5
gh pr view 3 --json state                # CLOSED
gh run view 33917724104 --json jobs      # governance: failure (diff scope only)
gh run view 33917724059 --json jobs      # quality: success; database-pgtap: failure
```
