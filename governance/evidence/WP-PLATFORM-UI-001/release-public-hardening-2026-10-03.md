# D3 public hardening release, October 3, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, step ui-008-release. The original adopted A1-A11 record and the stricter frozen procedure govern this release. Later disk-only grants are not adopted. D3 is now authorized production verified on the existing web projects. This is signed-out release evidence; primary-flows and release-smoke remain pending.

## Source, change and review

PR #74, base 526457e1ba38f612e829d2bb47fb9bb1d2a9465f, reviewed head 3beb428444d3226d1c2c52f99505d5c6faf31699. Normal merge c403b4c395b4c899f1b9562bbd66a50f972d0584 at 2026-10-03T23:08:44Z. Full tree equality with the reviewed head exited 0, and the author fast-forwarded cleanly. No branch was deleted. The final PR includes 327 paths, primarily observational evidence and URL-neutral route moves. public-hardening-implementation-2026-10-03.md describes the implementation and retained before/after regressions.

The release adds nonce-free CSP and security headers, removes X-Powered-By, redirects www to apex with 308 while preserving paths and queries, makes eight marketing documents static, retains verified home-session redirection and private Studio responses, raises public footer text to 16 px, links the login wordmark home, refreshes sitemap lastmod and bounds enlarged auth inputs. Static English/Spanish roots retain their literal document languages. No new visitor-facing Spanish, legal wording, media asset, schema, Worker, dependency or environment change ships.

The final signed-in CSP repair configures Zod's jitless mode before client validation. Three regressions failed against the parent and passed after repair; the 17-test focused suite passed. The earlier raw-script prototype failed lint and was replaced with Next Script's beforeInteractive scheduling. The final three runtime/test source hashes match the actual precommit production-browser observation at 21:24:40.095Z and the later exact reviewed tree. That observation is source-equivalent evidence, not a browser run performed at the later commit identity. The failed parent 48d74b8ca575233b88a370c6913c38139e344aa9 was never released.

The isolated C5 reviewer ran 22:56:45.8786480Z-23:07:22.9907152Z: actual process exit 0, VERDICT: PASS, no P1/P2/P3 findings. Model gpt-6.1-sol, effort xhigh, session 01a103fb-f55c-7ca3-98f9-9d4882a79f2f. It used the exact tracked-only detached clone and every required read-only/stripped-environment flag. It performed static review of supplied evidence, not validators or remote calls. merge-review-public-hardening-2026-10-03.md copies that completed round after merge. The earlier PR #73 research review is copied separately here; this record PR's own review will be copied by its successor documentation PR.

## Local and fresh verification

Proof receipts are under browser-proof-2026-10-03-hardening-release/. Author retry 7 ran 21:37-21:52 UTC, all seven commands exiting 0, including agent:verify. Later evidence-only changes received governance, packet, scope, formatting, staged-whitespace and secret-scan checks. The first staged excerpt check found excess EOF blank lines; normalization of new copies passed, with originals retained.

Fresh C:/dev/mbv-verify-3beb428 on local main and one worktree: 22:02:29.2454261Z-22:30:58.4355500Z, all eleven recorded commands exited 0. Frozen install, preflight, governance check/test, formatting and verify passed. Governance: 177 tests, zero skipped. Web: 451 unit tests and 31 integration tests; Core: 633 unit tests and two integration tests; collaboration: 83 tests; eighteen build tasks. Migration up/list and applied-file parity passed on the shared local lane, 75 versions through 20260929017000. supabase:test passed 61 files and 1181 assertions. Preview passed 57 tests with the one prescribed guarded staging skip; thresholds and goldens were unchanged. Canvas: 100 nodes 60.13 FPS against 55; 500 nodes 60.24 FPS against its unchanged 30 threshold, twelve DOM nodes and 24.5 ms selection. Five emitted diagnostic artifacts remain in that clone.

Exact-head connected local suites ran 22:33:56.6423399Z-22:41:38.8573881Z, all seventeen passed, actual exit 0. Product requests and assertions were unchanged; the outside cleanup guard retained eighteen synthetic users and sent no DELETE. Providers and queues were disabled. Owned harness PID 67680 was stopped only after identity verification; taskkill exited 0 and ports 3111/8789 were free. These are local fixtures, never a production or connected-staging claim.

The local browser package remains at browser-proof-2026-10-03-hardening/. Its 64 public cells, theme/accessibility/keyboard cases, repaired enlarged-auth cells and signed-in production CSP checks are described there. All 132 distinct final capture contents were inspected. The final real-session production-build proof covers four Studio widths, twenty actual local Core GETs, private no-store responses, verified home redirection and zero CSP/page exceptions. A separate retained development-session console check reports zero general console/page errors at four widths; its development cache result is not used as production-cache proof. Zoom tests are explicitly emulated, and INP is a trusted local lab sample, not field data.

Node 24.18.0, corepack pnpm 11.12.0, Supabase 2.109.1, Playwright 1.61.1, Wrangler 4.110.0, global Vercel 59.16.0, Codex 0.160.0. Resumed preflight uses PATH Node 24.21.0 with pinned pnpm. These are local required checks; GitHub Actions remains off.

## Schema, rollback and deploy

Clean C:/dev/mbv-deploy-c403b4c, local main and one worktree. Frozen install exited 0 at 23:10:13.8763523Z. Only the four allowed environment example files were present. Its full tree equals the reviewed head, exit 0, so C4 evidence stands for the merged tree. No environment pull, link, build override or new target.

Read-only Supabase metadata at 23:10:47Z, refreshed during resumed orientation: staging has 50 entries through 20260917223105; production has 39 through 20260902154759. Main/local have 75 through 20260929017000. Alternative staging timestamps do not establish semantic parity. Both web projects use production-backed data. The diff from live web source f97488dc220c6f1b6686f4c0642b2203baab156e introduces no new table, column, function, policy or RPC dependency; shared schema-facing runtime is unchanged and route moves are URL-neutral. No remote migration or database write occurred.

Fresh readiness checks recorded Ready rollback deployments, verified journal ownership and recent-release concurrency, exact C4/C5/source equivalence and schema compatibility before each operation. The documented global Vercel deploy commands ran from the merged root, with --prod --yes --scope ashrunscode-projects and the named --project. --json affected output format only. Each deploy, rollback and promotion received an immediate journal line.

| Target                     | Deployment                       | Rollback                         | Actual deploy interval UTC        | Exit |
| -------------------------- | -------------------------------- | -------------------------------- | --------------------------------- | ---: |
| mustbeviral-web-staging    | dpl_3AVxM3qfZ8XihpUuC4YSCsGEXRVA | dpl_vHurZJBF5kKQ9Jum6sTN6MhTFhDn | 23:11:11.9861176-23:12:06.8402489 |    0 |
| mustbeviral-web-production | dpl_39ZBwGjXdn9EtqDuStLd1moqFLx3 | dpl_HCxas3BjbcANLZoVVQh68q1EcHoL | 23:35:42.3972853-23:36:38.2231885 |    0 |

Provider metadata independently confirms Ready and c403b4c395b4c899f1b9562bbd66a50f972d0584 for both deployments. CLI inspect confirms both staging aliases and all four production aliases moved. The protected long production alias was inspected only. Production required no promotion or rollback. Operator: this local Codex lead. Final production verification ended at 23:52:46.1624615Z.

## Staging observation failure and correction

Initial staging HTTP/media/all 22 header checks passed. The first browser matrix at 23:14:59.539Z passed 24 cells and failed eight: only raw CSP-header presence on the second visit to the eight static pages in the same context. It had no application or policy violations. C7 rolled back only the owned staging deployment to its recorded rollback, actual exit 0 at 23:16:25.7321576Z, and verified the old alias. Production remained on the prior S0 deployment. The failed reports are retained and are never labelled PASS.

Direct cache diagnostics identified a wire HTTP 304 response omitting CSP while the browser's combined cached policy remained present and enforced. An initial benign-eval diagnostic used Playwright evaluate, whose DevTools operation permits eval by default; it is retained but does not prove policy. Corrected CDP probes explicitly set allowUnsafeEvalBlockedByCSP=false. The live all-page diagnostic passed sixteen cold/warm cells, with zero navigation errors before sixteen intentionally induced enforced-denial events. Those events are separate from ordinary zero-error acceptance.

A fresh readiness check allowed normal promotion of the retained reviewed staging artifact, actual exit 0 at 23:26:09.3520331Z; no rebuild or application source change. The strict C8 driver now uses one fresh signed-out context per width and retains every original header/application check. It passed all 32 cells at 23:29:26.611Z. Separate cached-policy coverage retains the repeated-visit case. Full chronology, failed diagnostics, rollback/promotion receipts and explanatory official references are retained in incident-staging-cached-policy.md. This was an observation-driver defect, not a missing enforced browser policy.

## Final live smoke and media

Full C8 HTTP passed on staging, apex and the public production Vercel alias: all public markers, correct SEO/generated-file origins, image MIME, redirects, genuine 404, private Studio redirect, cookie absence, approved-origin MCP 401 and healthy Core. Each final browser matrix passed 32 cells at 375/1280 in two fresh signed-out contexts: one main/h1, 28 px h1, literal language, correct deployment marker, active jitless configuration, CSP without nonce/eval permission, no powered header, no overflow and zero application/CSP errors. Two expected document-404 resource entries per matrix are counted separately. No form was submitted. Production cached-policy coverage also passed sixteen cold/warm cells with no navigation errors and sixteen separately counted intentional denials.

All 22 final security/media header paths pass. Five production www probes return cookie-free 308 to apex with paths and queries preserved, including JavaScript, MP4 and VTT. Media URLs preserve the unchanged approved hashes and MIME types.

| Origin / 375 px lab sample     | Home poster LCP ms | /es poster LCP ms | Advertising LCP ms | Maximum CLS | Console errors |
| ------------------------------ | -----------------: | ----------------: | -----------------: | ----------: | -------------: |
| staging                        |                376 |               420 |                356 |           0 |              0 |
| mustbeviral.com                |                420 |               448 |                412 |    0.000275 |              0 |
| public production Vercel alias |                416 |               348 |                472 |           0 |              0 |

Actual home Play/Pause, pressed states, poster restoration, reduced-motion unmount/disabled control/announcement, reserved frame geometry and exact external A8 disclosure passed. /es retains poster-only rendering, empty alt, lang es and English notes. These are unthrottled lab observations, not field percentiles. Fifteen final native captures are retained: all five staging originals were inspected; six production/alias S0 captures are byte-identical to those inspected originals; four software captures were directly inspected at original resolution. Software frame differences arise from the existing moving film, whose small type/internal label remain assigned to D4. Initial two failed-attempt captures remain separate.

The October 3 live Higgsfield terms check remains in the proof: published update July 26, 2026, section 4.4, https://higgsfield.ai/terms-of-use-agreement, no company ownership claim and no commercial-use restriction for Outputs. It is a descriptive rights basis, not legal approval. No generation or credit spend was required.

## Not crossed

No remote database/SQL write, Auth query or sign-in, real user creation, customer generation, signup collection, charge, run/quote/outbox event, provider/queue enablement, send, posting, DNS/domain/new-resource action, extra environment/Worker setting write, secret load/disclosure, deletion, history rewrite or protection/hook bypass. Canonical checkout and PR #1 are untouched. A4/A6 were not repeated. Core and collaboration remain on their previously recorded versions.

## Owner queue

Existing exact owner inputs remain at owner-pack-founder-smoke-2026-10-03.md, owner-pack-public-auth-origin-2026-10-03.md and the earlier release records. Founder bundle absence and production schema lag are separate stops; neither authenticated production acceptance nor the single-stop release-smoke clause is satisfied. D6's classified migration release pack and A10 connected-staging plan remain future authorized work, with no paid staging call. Legal disclosure date, home-session wording, production policy-note correction, source references and historical SQL-fixture scope remain in their prepared owner packs. No new clearing sentence is invented or widened here.

public-surfaces, regression-gates and browser-proof retain passed status with this evidence added. primary-flows and release-smoke remain pending. Their carried composer/review/project-brand obligations are unchanged.

The frozen-author agent:handoff ran 2026-10-03T23:59:43.0965006Z-2026-10-04T00:06:06.4028305Z, actual exit 0. The prescribed two-YAML Prettier step and docs:generate both exited 0 afterward. Only mutable next-action/evidence fields and generated status projections changed; the production policy note remains unchanged under its prepared owner pack. The command output and receipt are retained in the release proof. Subsequent docs gates and this record PR's independent review belong to its PR body and the next review-copy record.

## Parked

None for D3. Historical owner-scope and input findings retain their existing dispositions.

Next action: repair the in-scope receipt, responsive proof and operator-gate defects under L3f.
