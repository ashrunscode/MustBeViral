# Receipt and responsive workflow release, October 4, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, step ui-008-release. This bounded L3f repair is implemented, locally verified and released on the existing V2 web targets. Signed-out production smoke passes. Authenticated production acceptance is unproven; primary-flows and release-smoke remain pending. The owner's adopted A1-A11 record governs this run. Disk-only A12 is unadopted and no deletion occurred.

## Source, behavior and review

PR #76 has base 88804c80c814cfe2ee2b65182566b6f9d4358829 and exact reviewed head ee91bb6a170d4e6520a6e537807f8f29721a2c06. The normal merge is 8e0b43ac3a6120c304eec9bdd9b1915cc64a61b2 at 2026-10-04T09:53:30Z. Actual merge and author fast-forward exits are 0. Full tree equality between reviewed head and merge also exits 0, so the exact-head C4 results stand for the merged tree. The merge preserves the Run trailer and deletes no branch.

The receipt preserves an absent reservation as an unavailable quote rather than $0.00. Charged money uses verified integer capture/refund evidence, preserves a known zero and never substitutes an unrelated spend total. Its named receipt and ledger regions support keyboard scrolling, and read recovery announces status and focuses the recovered heading. Review waits for a verified receipt before rendering approval totals, drafts or export; loading and failure states keep a visible heading. Placement buttons expose pressed states, Safe zone is a separate checkbox, and the QA drawer restores focus. Canvas measures available width before choosing its drawer, keeps one outline mounted, contains the toolbar and quote bar, restores focus on Close/Escape, and leaves mobile mutations disabled with desktop continuation. Shared navigation has full 44-pixel targets.

The final preview repair rewrites four obsolete assertions as regressions for the bounded drawer, complete pointer target, separately named scroll regions, keyboard movement and resize focus. It removes no test, skip, threshold or golden. No schema, Core runtime, dependency, deployment configuration or new visitor-facing Spanish changes ship.

The isolated C5 process ran 2026-10-04T09:34:15.5515304Z to 09:50:59.1321314Z against ee91bb6a170d4e6520a6e537807f8f29721a2c06: actual exit 0, VERDICT: PASS, no findings. Model gpt-6.1-sol, effort xhigh, session 01a10643-9add-7e70-8a27-5788cba05361. Every prescribed stripped-environment, ephemeral, read-only and disabled-capability flag was retained. The reviewer assessed supplied evidence without executing validators or remote calls. [merge-review-receipt-responsive-2026-10-04.md](merge-review-receipt-responsive-2026-10-04.md) copies this completed round after merge. [merge-review-public-hardening-record-2026-10-04.md](merge-review-public-hardening-record-2026-10-04.md) copies PR #75's earlier documentation review. This record PR's own review belongs in its body and the next documentation PR.

## Local and fresh proof

The original [browser package](browser-proof-2026-10-04-receipt/README.md) records the actual before/after regressions, production-rendered local browser proof and preview failure history. Its then-pending C4/C5/release statements remain historical; this release record supplies their completed results. Original runtime hashes match the reviewed source; the later final-ui test repair is separately identified. The earlier whole-source fingerprint is not presented as the later commit's whole-tree fingerprint.

The new [release proof](browser-proof-2026-10-04-receipt-release/README.md) copies completed receipts, selected count excerpts, live captures and their manifests. In C:/dev/mbv-verify-ee91bb6, local main and one worktree, all eleven fresh C4 commands actually exited 0, from 08:48:10.4966120Z to 09:16:05.0312669Z. Frozen install, agent:preflight, governance:check, governance:test, format:check and verify passed. Governance has 177 passes and zero skips. Web has 480 unit and 31 integration tests; Core has 633 unit and two integration tests; collaboration has 83 tests; all eighteen build tasks passed. Local migration list/up/list and applied-file parity passed: 75 versions through 20260929017000. SQL passed 61 files and 1181 assertions. Preview passed 57 tests with the unchanged single prescribed guarded staging skip. Canvas measured 60.34 FPS at 100 nodes against 55, and 60.16 FPS at 500 nodes against the unchanged 30 threshold, twelve DOM nodes and 37.5 ms selection. Generated diagnostic artifacts remain preserved in the fresh clone.

The exact-head connected suites ran 09:20:25.0372147Z to 09:28:54.3000887Z: eighteen tests passed, actual exit 0. Providers and queues were disabled and all endpoints were local. The outside cleanup guard prevented only synthetic Auth cleanup DELETE requests; product requests and assertions stayed unchanged. Nineteen synthetic users were retained. Owned harness PID 15712 was stopped after executable, script and creation identity checks, actual exit 0 at 09:29:29.9618843Z; ports 3111 and 8789 were free. The later sixteen-source/test hash check confirms no source mutation. These journeys establish local acceptance only.

Source-equivalent browser scores are Receipt 90, Canvas 91 and Review 91, using existing tokens and primitives with zero serious or critical axe violations. A3 supplies visual approval together with the completed independent review. The package accounts for all 212 earlier capture names and 163 distinct contents, including four clearly labelled before-repair diagnostics. Accessibility trees, keyboard recovery, forced colors, reduced motion and enlargement evidence retain their precise scope. Enlargement is emulated; controlled failed-resource entries remain disclosed and console score bonuses were withheld. The original package does not complete the wider missing 768-pixel platform matrix.

Node 24.18.0, corepack pnpm 11.12.0, Supabase 2.109.1, Playwright 1.61.1, Wrangler 4.110.0, global Vercel 59.16.0 and Codex 0.160.0. Resumed orientation uses PATH Node 24.21.0 with pinned pnpm. Live browser Chromium is 154.0.4258.48. These are required local checks; GitHub Actions remains off.

## Schema, rollback and guarded deployment

Clean C:/dev/mbv-deploy-8e0b43a, local main and one worktree, frozen install actual exit 0 at 09:54:59.9642491Z. Only the four permitted environment example files were present. Its full tree equals the reviewed head. No environment pull, link or build override was used.

Read-only Supabase migration metadata at 09:54:27Z, refreshed in recorded C1 orientation 27, reports staging 50 entries through 20260917223105, production 39 through 20260902154759, and main/local 75 through 20260929017000. Alternative staging timestamps do not establish semantic parity. Both web projects use production-backed data. The complete sixteen-file application/test inventory and unchanged shared schema-facing runtime introduce no dependency on a missing table, column, function, policy or RPC. No remote migration or database write occurred.

Fresh readiness checks recorded Ready rollback deployments, journal ownership, concurrency, source equivalence, schema compatibility and the same reviewed runtime before each deploy. Read-only metadata was less than thirty minutes old for both deploys. The documented global Vercel commands used --prod --yes --scope ashrunscode-projects and each named --project; --json changed output format only. Each command received its immediate run-journal line.

| Target                     | Deployment                       | Fresh rollback target            | Actual interval UTC               | Exit |
| -------------------------- | -------------------------------- | -------------------------------- | --------------------------------- | ---: |
| mustbeviral-web-staging    | dpl_H71RFwKHgz52iTyYxSbaujskGJJn | dpl_3AVxM3qfZ8XihpUuC4YSCsGEXRVA | 09:56:38.0749926–09:57:39.6090269 |    0 |
| mustbeviral-web-production | dpl_8xnrLRBENEKYoWnGxsuHfLZPAfvM | dpl_39ZBwGjXdn9EtqDuStLd1moqFLx3 | 10:08:57.5407719–10:09:48.5590791 |    0 |

Provider metadata independently confirms Ready and source 8e0b43ac3a6120c304eec9bdd9b1915cc64a61b2. Both staging aliases and all four production aliases moved automatically; no promotion or rollback was needed. The protected long production alias was inspected only. Operator: this local Codex lead. Core remains at staging 9606b8bb-01fe-454a-99f6-8ec3c882f6e9 and production 3f62d101-8169-47f0-9c60-22311106b3a0, source 77892509133e2f58ba09cca300f4a615d254a376. Production collaboration remains at 42f6ed15-358c-4d73-8331-35ad15e0e97d. This release deployed no Worker.

## Signed-out live smoke

Staging, https://mustbeviral.com and the public production Vercel alias each passed the full C8 HTTP smoke, unchanged approved media hashes and all 22 security/media header checks, actual exits 0. Public markers, SEO/generated-file origins, image MIME, redirects, genuine 404, cookie absence, private Studio redirect, approved-origin MCP 401 and healthy Core passed. Five www probes returned cookie-free 308 with path and query preserved. No form was submitted.

Each origin passed 32 strict browser cells at 375 and 1280 in fresh signed-out contexts: one main and H1, at least 28-pixel H1, literal document language, correct deployment marker, jitless configuration, CSP without nonce/eval permission, no powered header, no horizontal overflow and zero ordinary application or CSP errors. The six expected document-404 resource entries across all origins are separate counts. Every origin also passed three media/accessibility cases and sixteen cold/warm cached-policy diagnostics. CDP explicitly sets allowUnsafeEvalBlockedByCSP=false, verified against the [current official protocol definition](https://raw.githubusercontent.com/ChromeDevTools/devtools-protocol/master/json/js_protocol.json) on October 4. Forty-eight deliberately induced enforced eval denials are counted separately and never used as zero-error acceptance.

| Origin, 375-pixel lab sample   | Home poster LCP ms | /es poster LCP ms | Advertising LCP ms | Maximum CLS | Ordinary errors |
| ------------------------------ | -----------------: | ----------------: | -----------------: | ----------: | --------------: |
| staging                        |                532 |               364 |                388 |           0 |               0 |
| mustbeviral.com                |                520 |               364 |                356 |           0 |               0 |
| public production Vercel alias |                364 |               392 |                344 |           0 |               0 |

Actual home Play/Pause, pressed states, poster restoration, reduced-motion unmount/disabled control/announcement, reserved geometry and exact external A8 disclosure passed. /es retains the poster-only route, empty alt, lang es and English notes. These are unthrottled lab observations, not field percentiles or real-device acceptance. Fifteen current capture names have nine distinct contents: all six software originals were inspected at original resolution; the other nine S0/legal captures match previously inspected originals by SHA-256. The unchanged software film's small type and internal label remain D4 work and are not accepted. Capture inspection receipts use their actual recording times; an initial approximate scalar is retained outside as a diagnostic and was corrected before this copy.

Final summary receipts were recorded at 10:07:38.1956459Z for staging, 10:26:53.5271676Z for production and 10:28:39.7010494Z for the public production alias. Each reports Pass, HttpPass and BrowserPass true. Browser observation timestamps remain separately recorded in their native reports.

The ship-day [Higgsfield terms](https://higgsfield.ai/terms-of-use-agreement) recheck at 07:39:37 UTC records the published July 26, 2026 update and section 4.4's ownership disclaimer and commercial-use permission. The approved S0 bytes and A8 disclosure are unchanged. This is the recorded descriptive rights basis, not legal approval. No generation or credit spend occurred.

## Not crossed

No remote database or SQL write, Auth query or sign-in, new real user, customer generation, signup collection, charge, run/quote/outbox event, provider/queue enablement, send, posting, DNS/domain/new-resource action, additional environment/Worker setting change, secret load/disclosure, deletion, history rewrite or hook/protection bypass. Canonical checkout and PR #1 are untouched. A4 and A6 were not repeated. The documentation merge for this release record must not deploy.

## Owner queue

The prepared founder input remains [owner-pack-founder-smoke-2026-10-03.md](owner-pack-founder-smoke-2026-10-03.md): Load bundle `<name>` for the one read-only founder@mustbeviral.com smoke on staging and production; I confirm that this user exists. Replace only the bundle-name placeholder through the owner's vault workflow. The new names-only orientation still finds no founder name. No production Auth identity was queried.

Production schema lag is a separate hard stop under A5/C7. D6's classified migration release pack and aggregate-hash clearing sentence, plus backup/PITR confirmation, remain future authorized work. A10's quoted connected-staging test plan stays behind it; no paid staging call occurred. Two stops do not satisfy the packet's single-stop release-smoke alternative. Existing prepared Auth-origin, production-policy-note, legal/source and historical SQL-fixture scope packs remain unchanged; this record adds no authority or clearing sentence for them.

public-surfaces, regression-gates and browser-proof retain passed status with this bounded release evidence added. primary-flows and release-smoke remain pending. The wider missing 768-pixel matrix, operator UI/Core gate trace, D4 films, composer contract, durable rejection reason, project-to-brand mapping, packet chain, quality passes, migration pack and observation remain open at their recorded levels. No packet finish or supersession is claimed here.

The frozen-author agent:handoff ran 10:52:12.7063956Z to 10:59:50.4236302Z, actual exit 0, without a blocker flag. The mandatory two-YAML Prettier and docs:generate steps both exited 0 afterward, ending at 10:59:54.4379086Z. Only mutable next-action/evidence fields and generated status projections changed; production policy notes remain unchanged under their prepared owner pack. Handoff receipts and output are copied into the release proof. The initial package-format precheck found 29 JSON copies needing normalization, actual exit 1; formatting repairs preserve parsed JSON values and original hashes. Subsequent documentation gates and this record PR's review belong in its PR body and the next review-copy record.

## Parked

None for this bounded receipt/responsive repair. The failed first fresh preview and first author artifact wrapper remain disclosed in the original diagnostic evidence; later actual passing runs resolve them. Historical owner-scope and input findings retain their existing dispositions.

Next action: capture the remaining 768-pixel platform browser cells under L3f.
