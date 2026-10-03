# S0 studio hero release, October 3, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, step ui-008-release. Authority is the original adopted A1-A11 record and its merged revision-3 amendment. Later disk-only grants were not adopted. This release implements D2 and A8/A11, after D1 and A6. It changes only the existing web projects; Core and collaboration are unchanged.

## Source and verification

PR #71, base c0b39c989a68b6be05f00eff883e288eb5e68cc0, reviewed head 56abd4b9c100f98a1ea06835c7aeee2a32acd511. Normal merge f97488dc220c6f1b6686f4c0642b2203baab156e at 2026-10-03T12:27:19Z. Full tree equality with the reviewed head exited 0. The author fast-forwarded to the merge with a clean tree.

The 74 changed files contain 13 implementation/test/asset/brand paths and 61 evidence paths. Only the approved MP4 and JPEG ship, at content-versioned /films URLs. Their bytes, hashes, format and source package are recorded in s0-implementation-2026-10-03.md. Both receive immutable one-year caching. /es is poster-only with empty alt and English notes; no new Spanish or caption track. Visible description, exact A8 disclosure and external keyboard controls accompany the English plate. No typed master, mezzanine, manifest or optional WebM ships.

Author agent:verify exited 0 at 11:32:39Z, including all repository and 1181 database assertions. The runtime/test/config tree is unchanged from that check; later proof-only table/diagnostic/EOF corrections received fresh formatting and whitespace checks. New focused regressions first failed against the old implementation; all 31 passed after the repairs. Staged scan was clean; committed scope admitted all 74 paths. The first copied-excerpt whitespace check failed for trailing blank lines; normalized new copies passed, with originals retained outside Git.

Fresh C:/dev/mbv-verify-56abd4b on local main and one worktree: frozen install, preflight, governance check/test, formatting and verify all exited 0, 11:44:45Z-12:09:05Z. All 177 governance tests passed. Local migration up/list and parity guard passed, all 75 versions through 20260929017000, applied migration files unchanged. supabase:test passed 61 files and 1181 assertions. Preview: 57 passed, one prescribed guarded deployed-staging skip; 100-node canvas 59.94 FPS against 55, 500-node 60.18 FPS against its unchanged 30 threshold. Four emitted preview reports/screenshots remain only in that clone; no golden or threshold changed.

Connected local suites, 12:10:25Z-12:17:10Z: all 17 passed in 6.7 minutes, exit 0; providers and queues disabled. Eighteen synthetic users were retained. Owned harness PID 68800 matched recorded creation time, executable and script before cleanup at 12:17:24Z; taskkill exited 0 and ports 3111/8789 were free. The first readiness helper hit a sharing violation while reading an actively written log; Get-Content corrected it before testing. No repository validator crashed.

Node 24.18.0; corepack pnpm 11.12.0; Supabase 2.109.1; Playwright 1.61.1; Wrangler 4.110.0; global Vercel 59.16.0; Codex 0.160.0. These are local checks; GitHub Actions stays off. The exact independent review round is copied separately after merge.

The first evidence handoff reported exit 1: non-authority worktree content changed during the authority transition. The author had clarified the live-proof README while that command was validating its fingerprint. The guard rejected the race and restored the old next action. This was a reported consistency failure, not a crashed validator or live incident. The original failed output is retained under the live proof.

agent:recover reported no interrupted authority transition exists, exit 1: the failed transaction had already rolled back. It changed no authority file. After the prescribed preflight passed, the frozen-tree handoff retry and its formatting/generated-projection steps exited 0 at 2026-10-03T13:17:01.6051845Z. The next action is now Reverify official research sources under L2. The retry output is retained beside the failed output.

## Schema, rollback and deployment

Clean fresh C:/dev/mbv-deploy-f97488d, local main / one worktree, frozen install exit 0; only the four allowed environment example files. Its tree equals the reviewed head, exit 0, so C4 stands for the merged source. No environment pull, build override or link. Fresh pre-deploy reads established staging rollback dpl_HWP8wh8sDzBNDZQijK9uXittJiZf and production rollback dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b. The newest deployments were journaled, Ready on source 658cd50cc48906262bf24ec08e84b7d768cce481, with no recent competing release. Source/schema and rollback identity were checked again immediately before each deploy.

The documented routine Vercel deploy commands ran from the clean merged root for the two named projects, with --prod --yes --scope ashrunscode-projects and --project; --json provided the deployment identity for the immediate journal entry and changed only output format. Raw CLI output stayed in memory. No environment or project setting changed.

Staging: 12:30:00.9227293Z-12:30:45.5586004Z, exit 0, dpl_vHurZJBF5kKQ9Jum6sTN6MhTFhDn. Provider metadata independently reports f97488dc220c6f1b6686f4c0642b2203baab156e / Ready. CLI inspect confirmed both staging aliases moved. Production used the same commit after staging HTTP/browser/media proof: 12:41:05.8481843Z-12:41:47.1448670Z, exit 0, dpl_HCxas3BjbcANLZoVVQh68q1EcHoL. Provider metadata reports the same source / Ready. CLI inspect confirmed all four aliases moved, including the protected long alias; that alias was inspected only. No promotion or rollback was needed. Release verification ended at 12:44:27.737Z. Operator: this local Codex lead.

Fresh read-only Supabase metadata recorded at 2026-10-03T11:58:18.5580000Z: staging 50 entries through 20260917223105, production 39 through 20260902154759. Main/local have 75 through 20260929017000. Alternative staging timestamps do not prove semantic parity. The diff from recorded live web source 658cd50cc48906262bf24ec08e84b7d768cce481 changes no schema-facing runtime or migration. Its only app-route file change is globals.css; intervening Core drift is the already released origin var and its regression. This release introduces no new table, column, function, policy or RPC dependency. No remote database write occurred.

## Live smoke and browser proof

Proof is retained at browser-proof-2026-10-03-s0-release/. Staging media HTTP passed at 12:32:54.898Z; full C8 HTTP at 12:32:59.440Z. Live bytes/hashes, MIME types, immutable caching, cookie absence, exact disclosures, poster preloads, no initial video/track and approved-origin MCP 401 passed. All fourteen public routes, SEO origins, generated files, PNG images, redirects, 404 and Core health passed. The fresh 28-cell signed-out browser matrix at 12:34:30.196Z passed one main/h1, 28 px h1, no overflow and zero console errors, with no form submission.

Live 375 px media proof at 12:37:08.762Z: home poster IMG LCP 408 ms, /es poster IMG LCP 404 ms, advertising 336 ms; CLS 0, zero console errors on each. Reserved frame aspect is 1920 / 1080. Actual Play/Pause, pressed states, no native overlay/track, poster restoration and reduced-motion unmount/disabled control/live announcement passed. /es has document lang es, empty poster alt, no control/video/track, and English notes.

Production media and full HTTP passed on apex, www and the public production Vercel alias. Each served dpl_HCxas3BjbcANLZoVVQh68q1EcHoL. The 28-cell apex browser matrix passed at 12:43:49.294Z, zero console errors and no form submission. Live 375 px media proof at 12:44:27.737Z: home poster IMG LCP 568 ms, /es poster IMG LCP 540 ms, advertising 384 ms; CLS 0 and zero console errors. Real playback/pause/reduced-motion and Spanish poster-only checks passed. All six staging/production captures are retained; each production capture is byte-identical to its inspected staging counterpart, with the SHA-256 comparison retained.

This release's direct poster-LCP evidence, D1 origin release and A6 origin fix close public-surfaces. They do not prove authenticated production flows. A preliminary resumed health diagnostic reused the reserved PowerShell HOME name and emitted a nonterminating read-only-variable error; a task-specific name and fail-closed error handling produced the successful 200 / current deployment / healthy Core observation at 11:57:40Z. A JavaScript wrapper syntax error occurred before the first live media helper invocation, then the syntax-corrected invocation passed; no application request or validator ran in that rejected wrapper. All actual live smoke requests passed.

The local S0 proof remains in browser-proof-2026-10-03-s0: 45 captures, nine observational JSON files, five regression excerpts; all 35 unique screenshot contents inspected. Its design scores are 96/96/97, with existing 15 px footer/body text carried to D3. Emulated desktop zoom is distinguished from native zoom; requested dark preference uses the intentional fixed paper theme. Synthetic media failure is distinguished from live health. The initial touch calculation's border-box error is retained alongside corrected actual 44 px hit tests. Live samples are unthrottled lab observations, not field percentiles.

A8 ship-day rights basis: October 3 live check of https://higgsfield.ai/terms-of-use-agreement, published update July 26, 2026, section 4.4. It still states no company ownership claim for Inputs/Outputs and no restriction on commercial use of Outputs. This is descriptive basis evidence, not legal review. No generation, upload or credit spend was required for the existing approved S0 package.

## Not crossed

No remote migration/SQL write or Auth query/sign-in, no real user creation, customer generation, signup collection, charge, run/quote/outbox event, provider/queue enablement, contact send, social post, DNS/domain/new-resource action, extra environment/Worker setting write, secret load/disclosure, deletion, history rewrite or ruleset/hook bypass. The canonical checkout and PR #1 were untouched. Workers, collaboration and the existing software film were not deployed or changed.

## Owner queue

Founder bundle input and remote schema lag remain separate authenticated-smoke stops with their existing clearing inputs. Public Auth settings, legal/Spanish review and the historical SQL-fixture scope proposal retain their recorded inputs. D6's complete classified migration pack, connected-staging plan and remaining enablement packs are still required; this record does not claim them complete. primary-flows and release-smoke stay pending. The advertising page's frozen October 2 last-changed/as-of dates now lag its October 3 S0 paragraph update. A8 prohibits other legal wording changes; owner-pack-legal-disclosure-date-2026-10-03.md prepares this minor date correction. Its exact clearing sentence is: Update only the /advertising last-changed and as-of dates to 2026-10-03 to reflect the S0 disclosure release; keep the film's October 2 generation date and all other legal wording unchanged.

## Parked

None for S0. The unexplained historical SQL fixture failure remains unrepaired and in the owner-scope queue.

Next action: reverify official research sources under L2, then continue D3.
