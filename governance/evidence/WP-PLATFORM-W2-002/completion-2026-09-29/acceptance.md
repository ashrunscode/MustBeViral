# W2-002 recovery acceptance — 2026-09-29

This evidence closes W2.2–W2.4 only: representative extraction, evidence-backed proposals,
targeted questions, exact-hash approval and immutable brand-version pins. W2.5, the remaining
full-platform roadmap and public release remain open. The prepared successor is
`governance/evidence/WP-PLATFORM-W2-002/successor-WP-PLATFORM-W2-003.yaml` (specification 3).

## Source and environment

- Tested and independently reviewed source: `7cbead99df4fadce4b6cb8739ca159b134fa0707`.
- Tree: `a15e171802a3936ca41efd93ffb0e3e9963119ab`.
- PR base: `87b2e14cce4ddd5f41aafe621321c88bea38164f` (reviewed H5 merge).
- Frozen W2 review base: `f49bd5b22fd839ec900b270cb4a0063b6735d059`. It exists but is not an
  ancestor; reviewers compared endpoints and separately verified PR-base ancestry.
- Review fingerprint: `8ff8a4bea849f8462f802807e7669ce74b85e9af68d22a080b4deb70c536b884`,
  SHA-256 of frozen base, LF, head, LF, tree, LF.
- Fresh independent verification clone: `C:\dev\mbv-g10`, clean local `main`, frozen dependencies,
  Node 24.18.0 and pnpm 11.12.0. Its web build uses the committed example configuration copied to
  the ignored `apps/web/.env.local`; no customer or provider credentials are in these artifacts.
- Browser execution checkout: `C:\dev\mbv-a`, same product source and dependencies, local `main`.
  The only subsequent uncommitted change at browser completion was the review-spend receipt.
- Owned local Supabase runtime: `C:\dev\mbv-db`; project/container labels both identify
  `mustbeviral`, API 56321 and database 56322. Windows excluded ports prevented the usual database
  port. The harness derives the owned runtime's ports and validates its loopback issuer. Other
  projects' containers, canonical linked worktrees and shared database contents were preserved.
- Connected browsers used `MBV_PLATFORM_CONNECTED=1`, `MBV_PLAYWRIGHT_EXTERNAL=1` and
  `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3111`; Core was on 8789. Only explicit synthetic source
  hosts replace outbound capture HTTP. Core commands, Postgres permissions/persistence and private
  local artifact storage are exercised. No live crawl, paid inference, provider run or remote
  publication is claimed.

## Acceptance mapping

| Packet criterion                          | Implementation and proof                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Representative extraction quality         | HTML/plaintext/Markdown sources persist typed offerings, locations, facts, offers, visual candidates and language with source, capture time, excerpt and method. Unknowns remain unknown, source injection never grants authority, and website images stay non-reusable. Fixtures include WashBodega, UnPile, Harbor Press and Riverside Coffee. Domain, SQL, fixture and connected journeys pass. |
| Labeled voice/audience/positioning        | Proposals retain status, confidence and all evidence keys. The UI exposes every matching current assertion and its provenance. Corrections preserve the server-held evidence, append revisions, reject stale versions and recheck permission on replay. Missing evidence remains unknown. Relevant assertion changes invalidate dependent proposals.                                               |
| Owner-approved immutable versions         | Exact-hash commands approve an immutable snapshot; campaign pin reads retain its assertions, proposals and expiry after later corrections. Current known expiry or conflicting observations block approval. Corrections allow operators to resolve conflicts explicitly. Manual/no-website input reaches the same approval path. Direct writes, forged IDs and revoked access are denied.          |
| Two-brand journeys, no production effects | All 26 desktop/mobile connected cases pass, including W1 workspace/invitation/billing regressions and W2 capture, corrections, questions, approval, pins, delayed responses, revocation, keyboard, zoom and accessibility. A delegated editor now captures and extracts before revocation. WashBodega and UnPile identity stays separate.                                                          |

## Current checks

The [verification receipt](verification-receipt.json) records exact commands, start/end times,
actual exits and SHA-256 hashes of the retained external logs. Every command exited 0.

| Check                                                                                         | Current result                                                                                                          |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Frozen install and `pnpm agent:preflight`                                                     | Passed in the independent clone                                                                                         |
| `pnpm agent:verify`                                                                           | Passed; runs the packet database, governance, design and full `pnpm verify` gates                                       |
| `pnpm supabase:test`                                                                          | 55 files, 1,002 assertions passed                                                                                       |
| `pnpm governance:check`, `governance:test`, `format:check`, `lint:governance`, `design:check` | Passed; 173 governance tests                                                                                            |
| `pnpm verify`                                                                                 | Formatting, governance, security, task graph, lint, strict types, unit/integration tests and all affected builds passed |
| Representative package unit counts                                                            | Domain 61, contracts 139, web 255, Core 605, collaboration Worker 83 passed                                             |
| Contract/web/Core integration suites                                                          | 4 / 21 / 2 cases passed                                                                                                 |
| Knowledge fixture probe                                                                       | Passed, including stalled-body cancellation                                                                             |
| Knowledge connected probe                                                                     | 8 cases passed                                                                                                          |
| Diff-scope check against H5                                                                   | Passed                                                                                                                  |
| Connected browser files                                                                       | 26 passed, 0 failed/skipped/retried; 13 desktop and 13 mobile                                                           |

The [browser receipt](browser-receipt.json) lists all cases and artifact hashes. The two brand
findings accessibility captures, review-control captures and forced-color screenshots for each
viewport are preserved here. All six attached axe results contain zero violations. The populated
review-control journey asserts document and card width bounds, and the author visually inspected
both current review-control screenshots. Human operator usability research and live provider
acceptance are separate, still-open roadmap obligations.

## Independent source review

[Codex gpt-6-astra/high](codex-review.json) and [Claude opus/high](claude-review.json) both returned
PASS for the same source, frozen base and recomputed fingerprint above. Each used a separate native
CLI session and read-only permissions. Neither executed tests or authorized deployment; their
scope and limitations remain in the verbatim result strings. Prior unchanged-source coverage was
checked before reuse, and both independently traced the final actor authorization repair.

These are native CLI source reviews, not successful Dispatch jobs. Historical September 15
Dispatch cancellation/detection failures remain unchanged and are not relabeled. No Dispatch
setting, hook, security control, required reviewer or acceptance criterion was removed.

The author repaired every blocking finding from the recovery review cycles:

- At `777384d`, review identified actor revocation, silent observation replacement, stale proposal
  dependencies and evidence-bound failures. The next committed repair retained independent source
  observations, manual corrections and immutable approvals and added denial/overflow coverage.
- At `55c9571`, review identified question history overflow, invalid/nonfinite expiry, lost expiry
  precision, missing expiry controls and missing proposal evidence/correction. Additive migrations,
  strict shared expiry parsing, bounded current-question projection and existing-screen controls
  fixed these; historical rows remain stored and hash-bound.
- At `c81bcc2`, review found the remaining ambient-identity dependency for delegated editors and
  whitespace-separated expiry truncation. The final migration preserves all grant predicates but
  uses the initiating actor. SQL tests run with an actually subjectless service role. Complete
  expiry expressions are preserved when valid and marked disputed otherwise.

## Failed attempts retained and resolved

- An earlier fresh-clone build failed because the example environment was placed at repository
  root. Moving the same committed example to the web application's ignored local environment
  allowed the focused build, and the final fresh-clone full gate passed.
- Full verification at `c81bcc2` failed one Core parity case because the new command lacked a
  `proposal_id` test sample. Commit `41bcd82` repaired that fixture; all 77 parity cases and the
  final 605 Core cases pass.
- New expiry tests first failed 10 cases; all 19 now pass. The subjectless-actor SQL regression
  first failed six of 27 assertions. An initial test setup attempted to mutate immutable grant
  identity, and a later assertion incorrectly counted unknown placeholders as one row. Those
  fixtures were corrected without weakening any grant control; all 27 and the full 1,002 now pass.
- The expanded editor browser case first failed to obtain a captured document with the old
  helper. Both focused desktop/mobile cases and the final full run pass with the additive repair.
- Earlier new UI cases found safe-error mapping, stale selection, minimum target size and clipped
  cards. The code and regressions were repaired; the final connected/axe/width checks pass.

Raw failure and successful rerun logs remain under
`C:\dev\backups\MustBeViral\release-recovery-20260928`; no failed attempt is counted as passing.

## Migration, rollback and release limits

The local owned database received these additive H6 migrations in order:
`20260929000000`, `20260929001000`, `20260929002000`, `20260929002100`, `20260929003000`.
Existing committed migrations and persistent data were not reset or rewritten. The generated
database projection includes the actor-bound completion signature; the final private-helper
migration adds no public schema surface.

The old three-argument extraction-completion RPC deliberately fails closed. Future application
rollback must retain the actor-aware completion call (`55c9571` or later), or explicitly keep
extraction unavailable; an older caller is not schema-compatible for this operation. Future
remote rollout must name this migration range and compatible Core source in its guarded release
packet. No staging or production migration, deployment, feature enablement or rollback occurred
in H6. Canonical ignored environment files and the unreleased Claude checkout remain preserved.

GitHub Actions remains disabled. The separately documented branch-protection request remains
pending; this record does not claim the proposed settings exist. Google/social approvals,
commercial economics, legal review, human acceptance, 72 continuous private-production hours and
the fresh owner traffic ruling are not satisfied by this local packet.

Synthetic cleanup attempts were blocked by durable audit references for some test users, so those
synthetic users were retained. No customer identity, media, token, signed URL or raw environment
value is included in this evidence.

## Cumulative development budget

The existing [spend ledger](../development-spend-2026-09-28.yaml) retains the single $100 ceiling.
Native Claude review valuations total 41,443,313 integer USD micros, conservatively reserved; no
separate incremental cash charge is proven. Remaining unreserved budget is 58,556,687 micros.
No provider generation, social publishing, ad spend or deployment spending occurred. Existing
application daily limits are unrelated to this cumulative budget.

Next action after evidence and transition review: merge the H6 recovery through its normal PR,
then execute the ready W2-003 packet. This record does not claim the project complete.
