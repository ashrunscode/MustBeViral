# Mobile brand header and keyboard recovery release

Run: codex-finish-20261002.

Opening a brand moved the main content by 79.5px at 375px, and doubled text squeezed the selected-brand control to 26px. The mobile rail also stayed open after Escape. PR #86 reserves the brand header while access resolves, lets the confirmed selector reflow, and restores focus when Escape closes the mobile rail. Pending identity and permissions stay hidden. Denial removes the loading slots and keeps recovery. Existing cursor pagination is now in the brand body.

## Source, review and checks

Base `57c61e83330b213457bca892f5b266fa155588d6`; reviewed head `dade2f48c01f6c5ee771f3ba25c1a8589e755e4c`; merged and deployed source `dd4279f0061c19249a5653f4279be00009ff2b26`. Merge actual exit 0; reviewed and merged trees identical. Exactly six application/test paths changed from the previous live source `a58328d4bdd604d6c1e8a53fd334b55f6a1781bd`, apart from documentation. No shared schema-facing runtime, dependency, migration or Worker changed. Independent C5 round 1: PASS, actual process exit 0, no findings; all isolated flags retained. See [the full verdict](merge-review-mobile-shell-2026-10-05.md). PR #85's evidence-only review is [copied separately](merge-review-internal-access-record-2026-10-05.md).

Author agent:verify, packet:verify, format and scope checks plus local migration pre-step returned actual exit 0 before the final one-line select max-width override. Five source hashes, dependencies and environment stayed identical. Evidence for those artifacts was reused under shared delivery policy and the owner's instruction to avoid redundant checks. The final CSS delta passed a separate optimized web build, six-path formatting/secret scan and two actual connected regressions. The mounted set passed 23 tests, including seven new unit regressions; two connected regressions were also added. Before-fix failures, intermediate geometry/text failures and setup failures remain retained externally. No threshold was lowered.

The fresh exact-head clone then passed ten checks with actual exit 0: frozen install, preflight, governance check/test, format, verify, local migration list/up/list and supabase:test. SQL: 61 files, 1,181 assertions; local: 75 versions through 20260929017000. Required preview suites plus booking/internal access: 88 passed, 1 prescribed operator-environment skip, actual exit 0. Both connected suites: 24 passed, actual exit 0, with real local Supabase Auth/Core and providers/queues off. Cleanup guards preserved 14 and 11 synthetic users; no forced deletion. These are local required checks, not CI. Node 24.18.0, pnpm 11.12.0, Supabase 2.109.1 and Playwright 1.61.1.

Earlier author connected setup failures occurred after building into a running dev server's nested .next directory; their source assertions did not execute, and secondary worker UV_HANDLE_CLOSING assertions are retained. Separating the optimized build and fresh harness roots resolved that interference. Fresh readiness wrappers also had a null-exit handling mistake and used the wrong Core health payload shape before tests started. The existing owned servers were reused after real HTTP readiness; no source/configuration was changed for those wrapper repairs. Final suites completed normally. Owned harness and optimized preview PID/creation-time checks and tree stops returned actual exit 0 with ports free and clean source.

## Native browser and design QA

Native Playwright MCP used real local synthetic authentication and no preview bypass. Four representative shell routes (chooser, studio overview, brand draft and empty assets) produced 56 current-source ready cells: required 375/768/1280/1920 light/dark, 1440 light/dark, reduced motion, forced colors, equivalent 200 percent layout and doubled text. All had one main/h1, no horizontal overflow or application console errors. Twenty-four actual axe runs had zero violations/incomplete; other cells explicitly did not run axe. All 32 distinct ready images were inspected; equal SHA256 values identify the duplicates. Four additional exact loading images were inspected, plus real unavailable recovery.

Delayed real local access responses, without substituted payloads, produced main displacement 0px at 375/767/768/1280/1920. The exact loading captures cover 375/768/1280/1920. Pending accessibility trees contain the existing loading status and no brand selector, brand name or role announcement. Mobile Escape collapses the rail and restores focus. A real unavailable/404 local resource recovered by keyboard to the chooser; it is not evidence of an actual operator403. The mocked FORBIDDEN unit branch and existing real connected denial suite retain their distinct levels.

An optimized real-auth production build returned actual exit 0 before these lab measurements at 375px:

| Route           | LCP ms |      CLS | Observed interaction maximum ms | Errors |
| --------------- | -----: | -------: | ------------------------------: | -----: |
| Chooser         |    320 | 0.024130 |                              16 |      0 |
| Studio overview |    144 | 0.016252 |                              16 |      0 |
| Brand draft     |    192 | 0.000024 |                              16 |      0 |
| Empty assets    |    128 | 0.000024 |                      Unmeasured |      0 |

Assets produced no EventTiming entry above the observer threshold; null is not zero. Field INP is unproven. The single-option selector exercise is not a real brand transition; existing connected journeys prove multi-brand access separately. No canvas-performance change is claimed.

A3 author scores for this bounded existing-screen repair:

| Route           | A11y /25 | Responsive /15 | Theme /10 | Motion /10 | Perf /20 | Craft /20 | Total |
| --------------- | -------: | -------------: | --------: | ---------: | -------: | --------: | ----: |
| Chooser         |       25 |             11 |        10 |         10 |       20 |        17 |    93 |
| Studio overview |       25 |             11 |        10 |         10 |       20 |        18 |    94 |
| Brand draft     |       25 |             11 |        10 |         10 |       20 |        20 |    96 |
| Empty assets    |       25 |             11 |        10 |         10 |       20 |        20 |    96 |

All four deduct one point for the inherited small skip-link target and three for the 15px mobile app body. Craft deducts three for sparse desktop chooser distribution; overview deducts one each for adjoining decision panels and the wrapped tablet Add-a-brand action. These craft findings remain actionable follow-up work. The paper/ink/Geist palette, flat panels and fixed light theme follow accepted brand authority; dark preference intentionally remains light. No running motion, transition-all or missing image geometry was observed. Actual doubled text is covered; 640x450 is equivalent layout reflow, not native OS browser zoom. The independent source review passed; it did not independently reproduce author-supplied browser evidence.

These four representative scores and connected regressions do not complete every route's final C11 inspection, primary-flows, or whole-platform acceptance. See [the browser proof index](browser-proof-2026-10-05/mobile-shell/README.md).

## Guarded release and live smoke

Operator: local Codex, under renewed A1–A11 and ADR-0009. Clean deploy clone, frozen install actual exit 0, exact merged source, template env-like files only. Fresh read-only migration metadata at 2026-10-05T23:13:56.728Z: main/local75 head20260929017000, staging50 head20260917223105, production39 head20260902154759. Staging web also uses production data. This six-path presentation/test diff adds no dependency on the missing remote schema; neither Worker required deployment.

| Target                     | New deployment                   | Recorded rollback target         | Start UTC                    | Finish UTC                   |
| -------------------------- | -------------------------------- | -------------------------------- | ---------------------------- | ---------------------------- |
| mustbeviral-web-staging    | dpl_5T4DD199RBa1m1LtU5YF95QRTMVk | dpl_9QguxAbLhT36J67FYaZZw6ofEiTz | 2026-10-05T23:17:49.9924646Z | 2026-10-05T23:19:36.4880072Z |
| mustbeviral-web-production | dpl_2wmv2ChXF5a5d4tPVWA32ixYsp4i | dpl_42vW5NbwXH7zPk8nDFkGGqVcnx2f | 2026-10-05T23:22:54.7870766Z | 2026-10-05T23:23:52.9947671Z |

Both deploy commands returned actual exit 0 using global Vercel59.16.0. Staging smoke passed before production started. Fresh listing/inspection confirmed READY and provider source metadata equal `dd4279f0061c19249a5653f4279be00009ff2b26` on both. All four production aliases moved without promotion or settings changes: apex, www, public Vercel alias and protected project/team alias. The protected alias was inspected only.

C8 passed on staging, apex and the public production alias. Each origin passed three HTTP smoke commands (origin/routes/health, exact S0 bytes/disclosure, extended22-route security headers), 32 native signed-out route/width cells, 16 explicit cached-policy cases and three media/performance cases. No form was submitted or remote database written. Fresh-context header checks were strict; cached response policy had separate direct protocol evidence. One native filename launch was rejected because the external helper path was outside configured roots, before checks began; its unchanged code was then passed through the supported code argument. No MCP configuration changed. A separate cached-helper filename typo was corrected before that probe started; earlier successful probes were not repeated.

| Origin                  | Home LCP ms | ES LCP ms | Advertising LCP ms | CLS | Console errors |
| ----------------------- | ----------: | --------: | -----------------: | --: | -------------: |
| Staging                 |         336 |       356 |                292 |   0 |              0 |
| Apex                    |         380 |       388 |                364 |   0 |              0 |
| Public production alias |         388 |       332 |                356 |   0 |              0 |

Home/ES poster was the measured LCP element; reserved geometry, external exact A8 disclosure, play/pause/pressed states and reduced-motion unmount/disabled announcement passed. ES remains poster-only; no new Spanish. Fifteen live captures contain nine distinct images: all six software captures and the three distinct home/ES/advertising captures were inspected. Layout smoke does not accept the unchanged old software film's tiny text/internal-label failure under D4. P-film/S1 attempts exhausted their permitted retry and were discarded; no failed new clip shipped or new credit spent here.

Unchanged S0 bytes reuse the shipping-day terms check at 2026-10-05T15:29:24.4670098Z in the earlier release record: [Higgsfield terms](https://higgsfield.ai/terms-of-use-agreement), July26 update, section4.4 output ownership/commercial-use clause. No new generation or legal approval. This production release restarts any future observation window; no continuous72-hour observation or owner traffic sign-off is claimed.

## Not crossed

No remote database/SQL write, production Auth query/sign-in, real-user creation, customer generation, collection, charge, run/quote/outbox event, provider/queue enablement, send/post, DNS/domain/new resource, extra setting change, vault/secret load/disclosure, deletion, history rewrite or protection/hook bypass. A4/A6 were not repeated. PR #1 and unrelated canonical work remain untouched. This documentation merge must not deploy.

## Owner queue, carried quality and next action

Primary-flows and release-smoke remain pending. Founder credentials and production schema lag are separate stops; their two stops do not satisfy release-smoke's single-stop alternative. Existing founder clearing sentence remains: Load bundle `<name>` for the one read-only founder@mustbeviral.com smoke on staging and production; I confirm this user exists. Names-only discovery cannot prove that an arbitrarily named founder bundle is absent. No production Auth query occurred.

The migration owner pack must resolve staging ordering/history collisions and pair a safe forward migration path with compatible Core before it is executable. A5 still forbids all remote database writes. Composer/content contract stays with row18; durable reject/send-back reason, project-to-brand mapping, positive operator permission/shared Core query and denial/revocation coverage remain carried. Real-media/rights, connected integrations, legal, fluent Spanish review and operational inputs retain their existing packs.

The pre-transition quality pass is unfinished. Chooser distribution, overview spacing/action wrapping and current inspection of the remaining route families are actionable. Dependency advisories include critical/high findings; dependency/runtime paths belong to the Render successor and require recorded applicability or fixes there. Historical vault-matched identity strings remain in three older public evidence documents; one is bound to immutable transition provenance. They were not silently redacted or exempted, and a full-repository clean secret scan is not claimed. Changed six-path scan passed; a forward privacy-redaction decision is still needed. No defect is parked for this bounded repair and no acceptance row was marked passed.

One next action: fix the studio chooser/overview craft findings and finish the current pre-transition quality pass, then carry unproven obligations into RENDER-001 under A2.

The first documentation handoff returned actual exit 1 because the lead moved/formatted its new evidence while the authority transaction was running; its snapshot guard rejected non-authority worktree drift. State and acceptance did not change. The failed receipt and log are retained externally. The repair runs evidence preparation before a second isolated handoff and leaves the repository steady until that command exits; no lock or transition guard is bypassed.

The stable retry completed with actual exit 0 from 2026-10-05T23:38:22.4482594Z to 2026-10-05T23:41:29.5846277Z. Its subsequent YAML Prettier and documentation generation both returned actual exit 0, finishing at 2026-10-05T23:41:35.4529610Z. Only mutable handoff/progress and generated projections changed; acceptance remains pending. The external machine receipt is `C:/dev/mbv-run/mobile-shell-record-retry-handoff-20261005.json`.
