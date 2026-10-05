# Studio hierarchy and booking release, October 5, 2026

Run: codex-finish-20261002

The bounded studio refinement is implemented, locally verified, independently reviewed and released on both existing V2 web targets. Signed-out live release checks pass. The active packet remains WP-PLATFORM-UI-001, specification revision 4, step ui-008-release. primary-flows and release-smoke remain pending; this record does not complete the platform. Adopted and renewed A1–A11 governs this run; A12 remains unadopted.

## Source and customer behavior

PR #80 has reviewed head 9949124ea4097040fb7b036f36835a42949d3b75 and base be62077ad86d28e7675232893a23740e7ec4af35. Its normal merge is e661edbe0c60e1b47c40bea17bde9e5d9062a386, merged at 2026-10-05T16:17:00Z. Merge, fetch, author fast-forward and full-tree equality each exited 0. Parents are the recorded base and head. The clean deploy clone C:/dev/mbv-deploy-e661edb has local main, one worktree, the exact merged tree and only permitted environment examples. Frozen installation exited 0. Equal reviewed and merged trees preserve the final C4 evidence.

On phones, the headline, booking actions and exact prices precede the native-aspect studio poster. Desktop places the poster alongside them. The owner's newer October 5 supplied directive supports studio headings of 40 px on phones and 56 px on desktop, and the revised normal English booking interaction. Product headings retain 28 px. English booking explains the exact $700 offer and five inclusions before a real telephone handoff, says nothing is booked or charged on the page, traps keyboard focus, and restores it on Escape or Close. Close has a 48 px minimum target. Real telephone hrefs remain the progressive fallback. Spanish retains its existing strings, telephone flow, poster-only media and English disclosure.

The independent price-overflow finding has a failing-then-passing regression: at 375 px, doubling every computed text size, including `.pub-price`, overflowed the fixed hero tiles on home and Spanish. Wrapping tiles with a minimum content width retain the complete $3,500 numeral at 56 px, without horizontal overflow. Test repairs open the customer canvas drawer before hit testing and wait for settlement and native End scrolling before ArrowUp; thresholds, skips and application behavior are preserved. No goldens change. [studio-refinement-2026-10-05.md](studio-refinement-2026-10-05.md) preserves the original implementation measurements and diagnostic failures.

Ten application/test paths change. No Core, collaboration, authentication, schema, dependency, cloud setting, legal wording, visitor-facing Spanish or media-byte change occurs. No form, collection, reservation, charge or provider request is added.

## Checks and independent review

The complete author agent:verify, including the optimized build and 1,181 SQL tests, exited 0. Source checksums from its application state match the final clean commit. Final packet, scope and formatting checks exited 0. In fresh C:/dev/mbv-verify-9949124, all nine core commands exited 0: frozen install, preflight, governance check/test, format check, full verify, local migration up/list and supabase:test. Governance has 177 passes. Web has 483 unit and 31 integration tests; shared UI has 66 tests. The optimized build passes. Database: 61 files, 1,181 assertions and exact local 75-file migration parity through 20260929017000.

The six required preview suites plus studio-booking passed 84 tests with the one prescribed staging-operator skip, exit 0. Both connected suites passed 22 tests, exit 0, with local Supabase/Miniflare endpoints, fake providers and queues disabled. Cleanup refused deletion of 12 and 11 synthetic users; no deletion was forced. The owned harness was stopped, exit 0, and ports 3111/8789 are free. Source remained clean. Canvas measured 60.32 FPS at 100 nodes against 55 and 60.28 FPS at 500 nodes against 30; twelve DOM nodes and 21.6 ms selection. Generated diagnostic screenshots and performance samples were preserved outside the clone; committed baselines were restored.

Core gates used host Node 24.21.0 and repository-managed Node 24.18.0; browser and release commands explicitly used Node 24.18.0. pnpm 11.12.0, Playwright 1.61.1, Supabase 2.109.1, Vercel 59.16.0 and Codex 0.160.0. GitHub Actions remains off; these are required local checks.

[merge-review-studio-refinement-2026-10-05.md](merge-review-studio-refinement-2026-10-05.md) copies all three C5 outputs verbatim after merge: c746f23 passed source review; 92cbda7 failed the genuine P2 price-overflow finding; 9949124 passed with no P1, P2 or P3 finding. Final review ran 2026-10-05T16:09:30.5022130Z–16:15:46.8590002Z, actual process exit 0, isolated read-only gpt-6.1-sol at xhigh, session 01a10cd3-d9a5-7532-9417-903c848ab13a. Every prescribed flag was retained. Local route scores of 96 cover only home, Spanish and studio pricing; incomplete axe results and excluded hydration diagnostics remain disclosed. This release changes existing public pages. It creates no new signed-in screen under A3 and claims no whole-platform acceptance. PR #79's documentation reviews are copied separately after its merge. This record PR's own review stays in its body and the next documentation PR.

## Compatibility and deployments

Fresh read-only metadata before staging observed 50 staging migrations through 20260917223105 and 39 production migrations through 20260902154759. Production was refreshed immediately before its deploy and remained at that head. Main/local has 75 through 20260929017000. Alternate staging timestamps do not establish semantic parity. Both web projects read production-backed data. The served diff is exactly the ten reviewed paths; shared database-facing runtime and build dependencies are unchanged, introducing no dependency on a missing table, column, RPC, function or policy. No migration or remote database write occurred.

Each target's Ready live deployment and source were re-read before deployment, with no recent unjournaled competing release. Rollback material was recorded first. The documented Vercel commands ran from the clean merged root with the named existing project, `--prod --yes --scope ashrunscode-projects`; `--json` changed output only. Each actual exit immediately received its journal entry.

| Target                     | New deployment                   | Fresh rollback target            | Actual interval UTC               | Exit |
| -------------------------- | -------------------------------- | -------------------------------- | --------------------------------- | ---: |
| mustbeviral-web-staging    | dpl_BdxLvSpTLUgDeQcUe8cpbzRc8dHy | dpl_65MhAN2LySepfp8c3KyE9KcutwhB | 16:18:10.1827789–16:19:04.8922678 |    0 |
| mustbeviral-web-production | dpl_yovUR1fbh1XsNMTUBrwoBHR9c2dC | dpl_5Rr9CQfFu83Nv4SbMUge8qAcB3a8 | 16:27:03.4207161–16:27:53.5440056 |    0 |

Provider inspection confirms Ready, source e661edbe0c60e1b47c40bea17bde9e5d9062a386, both staging aliases and all four production aliases moved automatically. No promotion or rollback was needed. The protected long production alias was inspected only. No Worker deployed. Worker identifiers in the preceding release retain their historical provenance.

## Signed-out live proof

Staging, mustbeviral.com and the public production Vercel alias each passed the complete C8 HTTP checks, approved media hashes and all 22 security/media header checks, actual exits 0. Metadata and generated-file origins, image MIME, expired-link recovery, genuine 404, cookie absence, Studio sign-in redirect, approved-origin MCP 401 UNAUTHENTICATED and Core health passed. www returned cookie-free 308 with path and query preserved. No form was submitted.

Each origin passed 32 strict browser cells at 375 and 1280: current deployment identity, one main/H1, exact scoped heading size, literal language, jitless validation, CSP without nonce or eval permission, no powered header, no overflow and no ordinary application or policy errors. Each also passed three media cases, sixteen cold/warm policy cases, eight booking cases at 375/768/1280/1920, and three all-text price-enlargement cases. Deliberate enforced eval denials and expected document-404 resource entries remain separate from ordinary errors.

| Origin, 375 px unthrottled lab sample | Home poster LCP ms | Spanish poster LCP ms | Advertising LCP ms | Maximum CLS | Ordinary errors |
| ------------------------------------- | -----------------: | --------------------: | -----------------: | ----------: | --------------: |
| staging                               |                316 |                   320 |                344 |           0 |               0 |
| mustbeviral.com                       |                472 |                   456 |                332 |           0 |               0 |
| public production Vercel alias        |                364 |                   332 |                316 |           0 |               0 |

Play/Pause, pressed states, poster restoration, reduced-motion unmount/disabled control/announcement, reserved geometry and the exact external A8 disclosure passed. Spanish has no video/control/track, uses empty poster alt and English notes. These are unthrottled lab samples, not field percentiles. Fifteen native captures have nine distinct contents: all nine originals were inspected; the six remaining S0/legal captures match inspected staging originals by SHA-256. Exact owned MCP output was moved out of the canonical checkout without changing hashes. Its outside-root filename-input refusal happened before any browser execution; subsequent inline snippets used only browser APIs and the configured native capture root. No file-access workaround or server filesystem API was used.

The unchanged software film retains its known tiny type/internal-label failure under D4 and is not accepted by these layout checks. All new P-film/S1 attempts exhausted their one retry and were discarded; failed clips were never shipped. [films-credits-2026-10-05.md](films-credits-2026-10-05.md) records quotes, terminal decisions and the final 2,452.76-credit balance. No credits were spent by this release.

The shipping-day [Higgsfield terms](https://higgsfield.ai/terms-of-use-agreement) were re-read at 2026-10-05T15:29:24.4670098Z. The published July 26 update and section 4.4 retain the company's output-ownership disclaimer and commercial-use permission. This records A8's descriptive rights basis, not legal approval. Approved S0 bytes and disclosure remain unchanged.

## Not crossed

No remote database/SQL write, Auth query or sign-in, real-user creation, customer generation, signup collection, charging, run/quote/outbox event, provider/queue enablement, send, posting, DNS/domain/new resource action, additional environment or Worker setting change, secret load/disclosure, deletion, history rewrite or hook/protection bypass. PR #1 and unrelated canonical work are untouched. A4/A6 are not repeated. This documentation merge must not deploy.

## Owner queue and remaining work

The existing prepared founder-smoke input remains: Load bundle `<name>` for the one read-only founder@mustbeviral.com smoke on staging and production; I confirm this user exists. No founder bundle was present in the last names-only check, and no production Auth query occurred. Production schema lag is a separate A5/C7 stop; the classified D6 release pack, aggregate-hash sentence and backup/PITR confirmation remain work to finish. A10's quoted connected-staging test plan remains behind that gate. Two stops do not satisfy release-smoke's single-stop alternative.

Existing Auth-origin, staging-isolation, legal, Spanish-fluent-review and operational owner packs retain their dispositions. primary-flows and release-smoke remain pending. Operator UI/Core gating, composer/content contract, durable rejection reason, project-to-brand mapping, packet succession, quality passes, the complete migration pack and observation remain open. No packet finish or supersession is claimed. The new film stop decisions do not accept the old software film. No defect is parked for this bounded studio refinement.

## Governed handoff

The governed handoff ran 2026-10-05T16:38:23.0402110Z–16:40:38.6327219Z, actual exit 0, without a blocker flag. The required two-YAML Prettier and docs:generate commands exited 0, ending at 16:42:09.0966453Z. The serializer removed an existing authority comment; it was restored before normalization, preserving the independently merged amendment. The normalized handoff has no semantic or byte change because its next action was already correct. This documentation change adds mutable release-evidence references only; acceptance statuses and authority remain unchanged.

Next action: verify the operator gate on /studio/internal in the UI and Core under L3f.
