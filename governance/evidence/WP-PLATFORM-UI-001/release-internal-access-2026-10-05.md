# Operations access repair release

Run: codex-finish-20261002.

Ordinary workspace sessions previously mounted operations readers without a platform-operator grant. PR #84 closes those readers and subscriptions before rendering, shows the existing unavailable-state primitive, provides working keyboard recovery to the studio chooser, and caps its paragraphs at 70ch. Heading, breadcrumb and main landmark consistently say Operations. This repairs the exposed UI surface; it does not implement a positive operator console.

## Source, review and local checks

Base `66a3ba4e7db6f597ecaa51f7a616fcde6e0712d4`; reviewed head `5056ce27a06444ca66099a4e223c278c420e75e8`; merge/source `a58328d4bdd604d6c1e8a53fd334b55f6a1781bd`. Merge actual exit 0, expected two parents, clean source and tree equality actual exit 0. The exact-head checks stand for the identical merged tree. No Worker, shared schema-facing runtime, dependency or migration changed. The diff from previous live source `e661edbe0c60e1b47c40bea17bde9e5d9062a386` contains only the six reviewed application/test paths, besides documentation.

Independent rounds 1 and 2 returned PASS actual exit 0. Round 1's cheap P3 requested the 70ch cap; round 2 examined the complete seven-path diff and returned no findings. All mandated isolated read-only flags were retained. Full outputs are in [merge-review-internal-access-2026-10-05.md](merge-review-internal-access-2026-10-05.md). PR #83's previous evidence-only review is copied separately in this documentation change. This documentation PR has its own independent review and must not deploy.

The mounted reader and Operations landmark regressions failed before and passed after. Initial pixel-only reading-width probes passed because current text fit; they did not reproduce the missing cap. The explicit computed-cap assertion then failed before (actual exit 1) and all four widths passed after (actual exit 0). Diagnostic attempts remain retained outside; no validator was disabled.

Author migration list/up/list, agent:verify, packet:verify, format and scope checks all actual exit 0,18:52:34–19:02:39UTC, with six final source hashes unchanged. Fresh exact-head clone frozen install, preflight, governance check/test, format, verify, local migration list/up/list and supabase:test: ten actual exit 0 checks. SQL: 61 files, 1,181 assertions; local: 75 versions through 20260929017000. Web: 484 unit and 31 integration tests; Core: 633 unit tests; collaboration: 83; UI: 66; governance: 177. Required preview suites plus booking/internal access: 88 passed, 1 prescribed staging-operator skip, actual exit 0. Both connected suites: 22 passed, actual exit 0, providers and queues disabled. Existing cleanup guards preserved 12 and 11 synthetic users; no forced deletion. Owned C4 harness stopped actual exit 0; source clean. These are local required checks, not CI; Actions remains off. Node 24.18.0, pnpm 11.12.0, Supabase 2.109.1, Playwright 1.61.1.

## Native browser proof

Native Playwright MCP used an optimized build (actual exit 0), real local synthetic Auth and no preview bypass. Four required widths 375/768/1280/1920 in light/dark, 1440 light/dark, reduced motion, forced colors, equivalent 200 percent layout and doubled text produced 14 accepted cells. Every cell returned 200 with zero axe violations/incomplete/errors/operations requests/overflow, one main/h1 and finite prose caps. All 8 distinct captures were viewed; 6 duplicates match SHA256. Operations score 96/100: accessibility 25, responsive 11, theming 10, motion 10, performance 20, craft 20. Deductions are inherited 15 px body(-3) and 40.5 px skip link(-1); focus was visible. Existing tokens/primitives, score above 90, zero serious/critical axe violations and independent PASS satisfy A3 for this bounded unavailable route.

Five on-screen keyboard stops retained visible focus; Return Enter reached the real studio chooser. Lab keydown/keyup 16 ms, first input 8 ms with 0.5 ms delay. Normal 375 px LCP 176 ms / CLS 0; unthrottled lab, not field percentiles. Post-paint text enlargement induced diagnostic CLS 0.302739. Emulated 640 x 450 CSS pixels at DPR 2 represents 1280 x 900 at 200 percent; actual browser/OS zoom and fieldINP remain unproven. The fixed light theme remains readable under dark preference. The added fixture was safely deleted by the existing local guard(actual exit 0); both owned native processes stopped(actual exit 0), ports 3111/3115/8789 free.

Historical986e83e diagnostics are not current-head proof: secondary-output build failed with mixed generated LayoutProps; standard output passed with strict TypeScript intact. Initial CDP-only zoom clipped despite overflow=false and was rejected; corrected viewport emulation passed. Restricted-VM URL-constructor error was corrected using browser pathname evaluation. One initial bootstrap 403 on the local studio-invitations request is separately recorded as an unproven primary-flow defect; it does not occur in any operations cell. Its cause remains to investigate. No full-platform journey success is claimed.

## Guarded release

Operator: local Codex lead. Existing web projects only; Vercel 59.16.0. Clean short merged-source clone, one worktree, frozen install actual exit 0, only tracked example environment files. Fresh rollback identities and newest-deployment ownership were checked before each release; no competing recent deployment. No schema dependency was added.

| Target         | New deployment                   | Recorded rollback                | UTC interval                      | Actual exit |
| -------------- | -------------------------------- | -------------------------------- | --------------------------------- | ----------- |
| staging web    | dpl_9QguxAbLhT36J67FYaZZw6ofEiTz | dpl_BdxLvSpTLUgDeQcUe8cpbzRc8dHy | 19:51:57.8233459–19:52:52.1387962 | 0           |
| production web | dpl_42vW5NbwXH7zPk8nDFkGGqVcnx2f | dpl_yovUR1fbh1XsNMTUBrwoBHR9c2dC | 19:56:27.5548712–19:57:16.0442874 | 0           |

Both inspected Ready on source a58328d4bdd604d6c1e8a53fd334b55f6a1781bd. Both staging aliases and all four production aliases moved automatically; no promote or rollback needed. The protected long alias was inspected only. Core/collaboration versions retain their preceding release provenance; neither Worker deployed.

Read-only Supabase metadata at 19:51:26.770UTC: staging: 50 versions through 20260917223105; production: 39 through 20260902154759. Main/local: 75 through 20260929017000. Staging history differs from main, including alternate billing versions; it is not claimed as migration parity. No remote migration or SQL write. Database backlog still gates dependent code and signed-in production acceptance; this repair removes readers and adds no missing-schema dependency.

## Signed-out live smoke

Staging, mustbeviral.com and the public production Vercel alias each passed full C8 HTTP, media/hash and 22 header checks, three actual exit 0 commands. Each passed 32 strict native browser cells at 375/1280, three media/playback cases and 16 cold/warm enforced-policy cases. Current deployment markers, route statuses, one main/h1, approved heading sizes, literal languages, CSP without nonce/eval, jitless validation, no cookies/powered header/overflow/ordinary errors, expired-link recovery and real 404 passed. www 308, Studio login redirect, canonical/generated-file origins, Core health 200 and approved-originMCP 401 passed. Intentional eval denials and expected 404 resource errors are separate from ordinary errors. No form submitted.

| Origin,375 px unthrottled lab | Home poster LCP ms | Spanish poster LCP ms | Advertising LCP ms | Maximum CLS | Ordinary errors |
| ----------------------------- | -----------------: | --------------------: | -----------------: | ----------: | --------------: |
| staging                       |                348 |                   376 |                336 |           0 |               0 |
| apex production               |                496 |                   452 |                344 |           0 |               0 |
| public production alias       |                372 |                   384 |                340 |           0 |               0 |

Play/pause, pressed states, poster restoration, reduced-motion unmount/disabled control/announcement, reserved geometry and exact external A8 disclosure passed. Spanish stays poster-only with no new Spanish. Fifteen release captures contain nine distinct images: six software captures viewed directly; home/es/advertising match inspected staging originals. Eight distinct operations captures were also viewed. Native originals remain in the configured capture root; byte-identical outside copies and committed representatives retain SHA256 mappings. One shell attempt to persist a large already-completed browser result exceeded Windows command length; the retained result was saved by the file tool without rerunning the successful browser matrix.

The old software film still has tiny text/internal-label failure under D4 and is not accepted by layout smoke. New P-film/S1 attempts exhausted their one retry and were discarded, as recorded in [films-credits-2026-10-05.md](films-credits-2026-10-05.md); no failed clip shipped and no credit was spent by this release. The unchanged S0 bytes retain the shipping-day terms check at 2026-10-05T15:29:24.4670098Z in the preceding release: [Higgsfield terms](https://higgsfield.ai/terms-of-use-agreement), July 26 update, section 4.4 output ownership/commercial-use clause. No new generation or legal approval.

## Not crossed

No remote database/SQL write, Auth query/sign-in, real-user creation, customer generation, collection, charge, run/quote/outbox event, provider/queue enablement, send/post, DNS/domain/new resource, extra setting change, vault/secret load/disclosure, deletion, history rewrite or protection/hook bypass. PR #1 and unrelated canonical work remain untouched. A4/A6 are not repeated. This evidence-only merge never deploys.

## Owner queue, carried work and next action

Founder smoke remains gated: Load bundle `<name>` for the one read-only founder@mustbeviral.com smoke on staging and production; I confirm this user exists. The names-only check found no matching founder bundle name; it cannot prove absence of an arbitrarily named bundle. No production Auth query occurred. Production schema lag is a separate A5/C7 stop. A classified migration owner pack must first resolve staging history/ordering conflicts and identify a safe forward path; no unreviewed colliding batch is executable. Backup/PITR confirmation and A10's quoted connected-staging plan remain required. Two stops do not satisfy release-smoke's single-stop alternative.

Primary-flows and release-smoke remain pending. Database-owned operator permission/shared Core query and denial/revocation proof carry to W6.1; composer/content contract to row 18; durable reject/send-back reason and project-to-brand mapping remain carried. Existing Auth-origin, staging-isolation, legal, fluent-Spanish-review, real-media/rights, live integrations and operational owner inputs retain their prepared packs. No positive operator capability, full-platform finish, quality pass or observation is claimed. No defect is parked for this bounded repair.

Next action: complete the pre-transition quality pass and audited UI-to-render successor, carrying every unproven obligation; investigate the observed local invitations 403 as primary-flow work.
