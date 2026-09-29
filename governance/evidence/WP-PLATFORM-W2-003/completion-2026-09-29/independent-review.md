# W2-003 independent product-source review

Verdict: **FAIL — three source findings require repair and an exact-head follow-up review.** This is not packet acceptance, merge readiness, deployment approval, or a Wave 2 exit claim.

Reviewed on 2026-09-29 by the independent `/root/h1_review` agent, read-only against `C:\dev\mbv-g12`:

- Base: `1834368d618418162f578f709881d828b0ea1752` (verified ancestor of the reviewed head).
- Head: `d187e319c97a16fba75b3ecfc4e42f737647d5b6`.
- Tree: `aaa32ccb54e17ba0069bb63dc573ea0aab21818a`.
- Local branch: `main`; exactly one registered worktree; tracked and untracked working state clean before and after review.
- `git diff --check` passed. No DB, browser, build, provider, paid-service, or full-test command was run by this reviewer. Root's reported focused passes and pending full checks are not independently certified here.

## Findings

### R1 — P2: The advertised 40-row CSV exceeds the machine assertion limit

Primary location: `packages/domain/src/representative-extract.ts:246` (CSV branch through line 267). The branch appends missing-kind placeholders to all explicit rows. Forty offerings yield 45 assertions, as the new domain test itself expects. The unchanged `public.record_brand_extraction` in `supabase/migrations/20260929002000_platform_knowledge_review_controls.sql:145-146` rejects more than 40. Core currently sends the entire extraction array. A valid advertised 40-row upload therefore captures its source but fails to persist its typed catalog.

Preserve all explicit rows and the database bound; omit only synthetic absent-kind placeholders at the CSV machine boundary, since SQL creates those itself. Verify the complete Core-to-SQL flow with 40 records, all explicit keys/provenance retained, and safe retry. The author independently reported the same issue and is preparing this repair; it is not present at the reviewed head.

### R2 — P2: Explicit unknown CSV rows are silently discarded or superseded

Primary location: `packages/domain/src/representative-extract.ts:249-255`, integrated with `supabase/migrations/20260929002000_platform_knowledge_review_controls.sql:200-211`.

The new CSV path represents an explicitly empty cell as a keyed unknown assertion. The existing machine recorder treats unknowns as kind-level placeholders: it skips an unknown if any assertion of that kind exists, and a subsequent known assertion can supersede any initial nonmanual unknown of that kind without matching its field key. For `offering,sku_a,Product A` followed by `offering,sku_b,`, sku_b is dropped. Reversing the rows makes sku_a supersede sku_b. Multiple unknown product keys also collapse. This violates the new documented instruction to leave unknown values empty and the packet requirement to persist catalog assertions with provenance.

Distinguish explicit CSV records from generated missing-kind placeholders both when admitting unknowns and when selecting an automatically superseded placeholder. Preserve explicit unknown identities and evidence. Add connected tests for both row orders, multiple same-kind unknown keys, and a later known observation with a different key. Keep duplicate replay, the 50-current-assertion atomic bound, and manual-correction preservation intact.

### R3 — P2: Disappearing claims are invisible to the recapture comparison

Primary location: `supabase/migrations/20260929010000_platform_knowledge_changes.sql:22-23` (classification at lines 37-42).

The new comparison derives its current side solely from `current_assertions`. When a previously approved website claim disappears from a new capture of the same URL without a replacement claim of that kind, machine extraction preserves the old observation and skips the missing-kind placeholder. The old fact therefore remains `unchanged`; if no recognized claims remain, the new panel can report no changed findings despite changed source bytes. The new SQL comparison tests cover changed values and additional equal evidence, but not disappearance. This misses the packet's required reviewable source/recapture difference and can hide removal of a still-unexpired offer.

Expose that a formerly supported claim is absent from the latest completed extraction of its source as explicit review evidence, with old/new source identity and capture provenance. Do not automatically rewrite approved facts or assume that absence proves falsity. Add a same-URL recapture regression that removes a prior claim, preserves the old approval bytes, and presents an actionable difference for human resolution. Keep incomplete/failed extraction distinguishable from a completed extraction with no matching claim.

## Other reviewed controls

- The new public lifecycle query checks the current caller and constrained workspace/brand/version relationship. The commands recheck current write permission under the existing workspace lock before replay or mutation and require the exact draft version/hash for expiry and contradiction review.
- The new review table uses forced RLS, denies direct application mutation, and appends immutable review evidence. Review commands retain original assertion history and do not approve a brand.
- New approval/pin triggers check the actual database clock, including after lock delays. Existing approved snapshots and acknowledged historical idempotent replays are preserved. New expired pins fail closed.
- The copied source-capture recorder and input validator are byte-equivalent to their prior definitions after the deliberate CSV media-type expansion; no existing permission/lease predicate was lost in those replacements.
- UI changes use the existing scoped query/mutation hooks and clear the comparison after writes; new review forms are tied to the draft hash. Authorization failures join the existing denial flow. Focused UI test coverage is limited to timestamp comparison; connected browser evidence still needs the required final review.
- Active packet specification remains revision 3. Only its mutable started state and matching project/generated state changed; acceptance remains pending and remote effects remain read-only. Historical receipts and earlier acceptance were not changed.
- The prepared W3-001 successor remains a bounded render-feasibility packet with no customer renderer enablement, no new infrastructure or DB migrations, real-media/hosted evidence requirements, cumulative budget accounting, and approval-required remote effects. Rollback documentation retains additive data and expiry guards rather than weakening them.

A new source head requires review of its repair delta. Required clean-clone gates and final connected desktop/mobile evidence must pass before packet acceptance or merge readiness is asserted.

## Exact-head repair review — 030fb80

Verdict: **FAIL — R1 and R2 are repaired; R3 still has a capture-deduplication defect.** The original review above is retained unchanged.

Independently inspected `C:\dev\mbv-g13`, local `main`, clean tracked/untracked state and exactly one worktree:

- Full review base: `1834368d618418162f578f709881d828b0ea1752`, verified ancestor.
- Previously reviewed head / repair-diff base: `d187e319c97a16fba75b3ecfc4e42f737647d5b6`.
- Repaired head: `030fb80eb8a7d46f6eec70a2c4182c79269bef9d`.
- Tree: `9f0799fbd75b81c9db6ae294a5b72f93a28d68d2`.
- Repair scope: 13 files; `git diff --check` passed. No shared tests, DB/browser/build jobs, provider actions, or repository edits were performed by this reviewer. Reported SQL/browser successes remain author evidence; final full checks and connected browser acceptance are pending.

### R1 resolved at this head

`apps/core/src/composition/brand-extraction.ts:30-36` now sends only the explicit CSV records while Postgres adds missing-kind placeholders. The filter retains unknown CSV rows as well as known rows. The repair contains Core transport, database boundary, and connected 40-row regressions; none weakens the 40-input-record or 50-current-assertion limit.

### R2 resolved at this head

`supabase/migrations/20260929013000_platform_catalog_unknown_records.sql` admits explicit CSV unknown records and excludes them from automatic placeholder supersession. Its input validation, actor/permission checks, locks, duplicate-history test, insert, draft bump, and completion logic are otherwise preserved. SQL00051 covers both row orders, multiple blank keys, later different-key input, replay, and the 40-row boundary. The connected test covers both brands and reload.

### R3 remains blocking — P2: Latest-source selection ignores later duplicate captures

Location: `supabase/migrations/20260929014000_platform_recapture_missing_claims.sql:5-12`.

The helper chooses the latest immutable source row by `brand_sources.created_at` and uses the source's original URL/job filename. Existing capture completion deliberately deduplicates identical bytes across the brand: `20260929012000_platform_catalog_import.sql:154-162` records a later successful capture as a `duplicate` job referencing the older source rather than creating another source row.

Reproduction from the reviewed control flow: capture/extract A with a claim, capture/extract B without it at the same URL or filename, then recapture the original bytes A. The final capture succeeds and references the original A source, but the helper still selects the later-created B source. It incorrectly keeps the claim marked missing and blocks a new approval even though the latest successful capture supports it. A second URL/filename whose bytes deduplicate to a source first captured elsewhere also loses its capture occurrence identity in this helper. The new tests exercise only fresh unique source hashes, so they do not detect this.

Select the latest successful matching capture occurrence, including duplicate jobs, with evidence that its canonical bytes completed extraction. Preserve URL/filename occurrence identity independently of canonical byte deduplication. An arbitrary replay of extraction against an older source must not reorder captures. Verify A-to-B-to-A recapture and shared bytes across different URLs/filenames, alongside incomplete capture, empty successful extraction, immutable approvals, and resolved-warning suppression.

The rest of the R3 repair correctly separates capture from successful extraction, exposes old/new source references, routes missing claims through current-permission exact-hash review, blocks new unreviewed approvals, and retains historical snapshots. Those controls should remain intact while correcting occurrence selection. Active packet acceptance, external-effect limits, and the prepared successor were not changed by these two repair commits.

## Exact-head occurrence repair review — 38429c2

Verdict: **FAIL — capture ordering is repaired; the new occurrence evidence is not yet bound to the exact review identity.** Earlier findings and verdicts above remain historical records.

Independently inspected clean single-worktree `C:\dev\mbv-g13`, local `main`:

- Full base: `1834368d618418162f578f709881d828b0ea1752`, verified ancestor.
- Repair-diff base: `030fb80eb8a7d46f6eec70a2c4182c79269bef9d`.
- Head: `38429c2bdd3524d1031ff0a8c15a5719d964846a`.
- Tree: `84c8a456298ace78448b06faf0de7c6f848a7224`.
- Ten repair files inspected; `git diff --check` passed. The reviewer ran no tests, DB/browser/build commands, or external effects. Full clean-clone checks and full browser rerun are still pending; author-reported focused results are not promoted to independent execution evidence.

### Occurrence ordering and history repair confirmed

Migration 16000 now derives identity from successful capture jobs, including duplicate captures, and keeps separate URL/filename occurrences when bytes share one canonical source. Only sources with successful extraction evidence participate. An extraction replay does not change capture ordering. Newly completed captures, extraction evidence, and approvals receive private monotonic sequence metadata; the migration does not backfill or alter historical timestamps or approved snapshots. Existing current-permission checks, forced RLS, direct-write denial, source identity protection, and immutable approval/audit controls remain intact. Public record serializers whitelist fields and do not accidentally add private ordering fields to strict existing wire records.

The summary remains bounded to one row per source in the approved snapshot (at most 50); multiple changed origins are counted explicitly. SQL00053 exercises real machine capture deduplication, A-to-B-to-A, both URL and filename identities, failed/incomplete captures, empty extraction, extraction replay, review, approval, preserved snapshot bytes, and backward timestamp ordering. The browser test retains the original content assertions while replacing unstable last-item selection with the exact source identity.

### Remaining blocker — P2: Duplicate recapture changes evidence without invalidating a stale exact-hash review

Primary location: `supabase/migrations/20260929016000_platform_capture_occurrences.sql:18-21`, with occurrence selection at lines 78-86.

Capture completion assigns an occurrence sequence but does not advance the knowledge draft or contribute that sequence to `knowledge_draft_hash`. The existing duplicate-capture branch in migration 12000:154-162 changes only the job. When the canonical source already has a current extracted assertion, `extract_brand_knowledge` in migration 02000:436-454 returns `extract_pending=false`, so Core does not run machine extraction or bump the draft either. The hash still covers only draft identity/version, candidates, assertions, proposals, and questions.

Consequently a newly completed cached recapture can change the displayed replacement source and missing-claim evidence while both expected_version and draft_hash remain identical. For example, prepare a conflict review when cached B is the latest source, then let another client recapture cached C at that same origin. Give B and C their own retained current nonmatching assertions so extraction is correctly skipped. The stale B review can now resolve against C because the command sees the same draft identity and a still-missing target claim. The decision is no longer bound to the exact evidence the operator reviewed.

Include available capture-occurrence evidence in the current review identity, or transactionally advance draft identity when a relevant completed occurrence changes it. Preserve old approval hashes/snapshots and idempotent replay semantics. Add a regression proving both B and C avoid extraction reruns, the occurrence transition changes the review identity, and the previously prepared version/hash is refused with REVISION_CONFLICT before any manual replacement, review record, or approval can be written. Preserve current-permission rechecks under the workspace lock.

## Exact-head review-identity repair — d6de38f

Verdict: **PASS for product-source review. R1, R2, R3 and the subsequent occurrence-review-identity finding are resolved at this head. No blocking source finding remains from this review.** This is not final merge readiness or packet acceptance; the final clean-clone gates and full desktop/mobile browser run remain pending. Earlier FAIL verdicts above describe their own exact historical heads and are retained unchanged.

Independently confirmed in `C:\dev\mbv-g13`:

- Full product base: `1834368d618418162f578f709881d828b0ea1752`, verified ancestor.
- Incremental review base: `38429c2bdd3524d1031ff0a8c15a5719d964846a`.
- Reviewed head: `d6de38f3103e4306b4f76abcebb56dd3bbdf27aa`.
- Reviewed tree: `1057f52a9e054ae40aad55a049677e1a893d9e2b`.
- Local branch `main`, one worktree, clean tracked/untracked state before and after review; `git diff --check` passed.

The three-file delta adds migration 17000, its focused SQL regression, and the matching API authority explanation. The migration preserves every prior draft-hash input exactly and adds a private watermark for available capture evidence. The aggregate is constrained to the exact workspace and brand, successful website/document jobs, a matching owned canonical source, and successful extraction audit evidence. Its value advances when a new cached capture completes or previously unextracted captured bytes first become available. Extraction retries use the first extraction sequence; approval events do not enter the aggregate. Thus their sequence allocation does not manufacture a later capture order. Existing stored approval hashes/snapshots are not rewritten.

SQL00053 now constructs A, B and C with retained current machine assertions, verifies `extract_pending=false` for the cached B/C requests, verifies unchanged draft version but changed hash after the occurrence transition, refuses both the stale lifecycle review and stale approval with REVISION_CONFLICT, checks that no decision or current-claim mutation occurred, and permits the refreshed exact-hash decision. Existing permission checks, workspace locking, service-only extraction, immutable history, and bounded comparison shape remain unchanged. The preceding R1/R2 regressions and capture-occurrence ordering repair remain in the reviewed ancestry.

No repository authority, active-packet specification, external-effect permission, acceptance status, or prepared successor changed in this delta. The reviewer performed source and test inspection only, with no DB/browser/build/test/process/provider mutation. The author reports 65 focused assertions passing; those executions were not independently observed here. Superseded earlier full runs are not counted as passing final gates. Final acceptance requires the completed exact-head gate receipts and connected desktop/mobile evidence, followed by any required review of subsequent acceptance/transition commits.
