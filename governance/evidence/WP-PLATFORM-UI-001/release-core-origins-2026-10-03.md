# Core public origin release, October 3, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001, specification revision 3, current step ui-008-release.
Authority is the original adopted A1–A11 record, merged through PR #65, and its
revision-3 amendment. Later disk-only grants were not adopted. This release
exercises only A6's two production Core origin additions and the existing
guarded release. No product acceptance row advances here.

## Source and required local checks

PR #69, base 00a599612bf4bcb42f68f020e2fa81b2776e65a4, independently reviewed
head d51d8f240248e4e4d8ea50a233697e16c4d59c32. Normal merge at
2026-10-03T09:11:43Z: 77892509133e2f58ba09cca300f4a615d254a376. The clean
author tree fast-forwarded to that merge; full tree equality exited 0.

Exactly three files changed: the production origin binding, its governance
configuration regression, and the runtime origin/authentication regression.
No handler, schema or UI implementation changed. The deep configuration
comparison permits only the two authorized production additions, preserving
the old origin and every staging setting, var, binding, flag, cron, route,
queue and reachability setting.

Node 24.18.0; corepack pnpm 11.12.0; Wrangler 4.110.0; Supabase CLI 2.109.1;
Playwright 1.61.1; Codex CLI 0.160.0. GitHub Actions remained off; these are
local checks.

- Author agent:verify, preflight, packet verification, formatting, scan and
  whitespace checks exited 0. The actual post-commit scope check admitted all
  three changed paths, exit 0. Full verification included 177 governance tests,
  633 Core unit tests and 61 database files / 1181 assertions.
- Fresh C:/dev/mbv-verify-d51d8f2, local main and one worktree: frozen install,
  preflight, governance check/test, formatting and verify each exited 0.
  Local migration up/list and the parity guard exited 0: all 75 file/applied
  versions match through 20260929017000. Migration files are unchanged from
  the previously verified local applied tree. supabase:test exited 0, all 1181
  assertions passed. Full fresh checks ran from 08:31:56Z through 08:53:24Z.
- Fresh C4 preview suite: 57 passed, one prescribed guarded deployed-staging
  case skipped, exit 0. The 100-node canvas measured 60.20 FPS against 55;
  the 500-node case measured 60.26 FPS against its unchanged 30 threshold.
  Connected platform/knowledge suites: all 17 passed in 7.1 minutes, exit 0,
  on the complete local harness with providers and queues off. Eighteen
  synthetic users were retained. The fresh clone retained five emitted test
  reports: two FPS JSON files and three screenshot PNGs. No author source,
  golden expectation or threshold changed.

## Earlier failures and evidence limits

Before the fix, the new configuration regression failed because the apex was
absent, exit 1. All three configuration tests and all 14 runtime cases passed
afterward, exit 0. The cases cover approved, unknown/malformed, missing-binding
and missing-Origin GET requests; they do not claim direct POST or
credential-bearing denial coverage.

The live apex proxy returned 403 FORBIDDEN at 07:36:12.611Z, structured probe
exit 1. An earlier uncaught-assert diagnostic returned -1073740791 and was
retained. The first full author run reported one ESLint error for the test's
URL global, exit 1. The explicit node:url import repaired that reported lint
failure; the full author retry exited 0. No failing run was erased.

The historical SQL 00043 assertion 52 failure remains unexplained. Current
passing runs do not repair it; no SQL file or migration was changed. The
narrow proposal remains pending in owner-pack-knowledge-fixture-2026-10-03.md.

The initial combined local harness command was rejected before execution with
only “blocked by policy”. No validator ran in that rejected command. The
segmented startup used a recorded owned PID and separate journey and cleanup
steps. PID 55968 matched the recorded source, executable, script and UTC
creation time, then taskkill stopped its owned process tree, exit 0; ports
3111/8789 were confirmed free. The first creation-time diagnostic failed
before cleanup because it stringified an already parsed UTC JSON date and
reinterpreted it as local time. Preserving the typed UTC value repaired the
diagnostic; no unrelated process was stopped.

## Deployment and smoke

New clean C:/dev/mbv-deploy-7789250, local main and one worktree, frozen
installation exit 0. Its four environment-like files were only the allowed
examples. No environment pull, build override or link. Its merged tree equals
the reviewed head, exit 0, so the exact-head C4 results cover the deployment.

Compared with recorded Core source 20b6e1e51420e0213fd4122201afe95e7173fce8,
Core runtime and migrations are unchanged. The package drift consists only of
the two local test-harness scripts; those are not Worker runtime imports.
No new table, column, function, policy or RPC dependency is introduced. The
remote schema backlog remains a separate acceptance stop. Read-only migration
lists at 08:15:23Z still showed 50 staging entries through 20260917223105 and
39 production entries through 20260902154759; local/main have 75 versions
through 20260929017000. No remote migration or SQL write occurred.

Pre-deploy reads at 09:13:04Z–09:13:21Z established fresh rollback versions:
staging 8c90ddc3-d5da-49ef-9d96-31e5ceda04c6 and production
d69e987c-90a6-43f5-ae45-a397c206ddf3. No recent competing deployment or
recorded out-of-band setting change was found. Names/types, non-secret values,
compatibility date/flags and the staging queue consumer matched. Only the
authorized production origin value differed. Staging retained its existing
enabled provider/queue configuration; no run, quote or outbox event was made.
Production provider runs and queues stayed disabled.

Both routine commands were `corepack pnpm exec wrangler deploy --config
apps/core/wrangler.jsonc --env <environment> --keep-vars`, from the clean merge
root. Raw CLI output stayed in memory because it displays variable values;
only identity receipts were persisted. Each return was immediately journaled
with UTC time, target, new version, full source, PR and exit. The rollback
target's live identity was checked again immediately before each deploy.

Staging: 09:14:10.9732375Z–09:14:19.0755743Z, exit 0, version
9606b8bb-01fe-454a-99f6-8ec3c882f6e9; deployment
ef9e2c2b-051f-4721-a054-7401fff096f6. At 09:16:16.439Z, all 12 configured
binding names and nine retained secret binding names/types matched, with no
value difference and matching runtime compatibility. Secret values were not
read or compared. At 09:16:17.258Z, direct staging health returned 200 ok;
its approved origin and missing-Origin probes returned 401 UNAUTHENTICATED,
and the unapproved origin returned 403 FORBIDDEN. No public cookie or ACAO
header was emitted. The unchanged MCP boundary is an origin gate for
same-origin proxy requests, not a CORS-header implementation.

Staging web's full signed-out C8 HTTP smoke passed at 09:16:22.519Z on its
unchanged dpl_HWP8wh8sDzBNDZQijK9uXittJiZf. The fresh signed-out browser
context passed all 28 route/width cells at 09:18:37.764Z: one main/h1, h1
28 px, no horizontal overflow, expected served deployment, zero console
errors and no submitted form. The initial browser diagnostic failed before
navigation because its sandbox has no URL global. Joining the fixed origin
and fixed route repaired that diagnostic; the successful retry is preserved.

Production: same source, 09:19:44.5580888Z–09:19:50.6328918Z, exit 0, version
3f62d101-8169-47f0-9c60-22311106b3a0; deployment
e6259a64-174e-4c75-b0f8-9cc0e3c16b30. Before it, the live staging version
still matched the directly verified release. At 09:21:07.236Z, all nine
configured binding names, five retained secret binding names/types and
runtime compatibility matched, with no remaining value difference.

At 09:21:09.231Z, direct production health was 200 ok. All three approved
origins returned 401 UNAUTHENTICATED on direct Core and on the apex public
proxy. Missing Origin still required authentication; unapproved Origin
returned 403 on both. No cookie or ACAO header was emitted. This supplies the
live failing-before/passing-after evidence for A6.

Full signed-out C8 HTTP smoke passed on apex at 09:21:13.240Z, www at
09:21:17.304Z and the public production Vercel alias at 09:21:21.233Z, all on
unchanged web deployment dpl_CHf1B4RTTcHMRVpAkSvjKQPuQx9b and source
658cd50cc48906262bf24ec08e84b7d768cce481. All 14 routes, canonical/social and
hreflang URLs, JSON-LD, PNG images, generated files, redirects, 404, health
and public-cookie checks passed. Browser proof at 09:22:25.913Z passed all
28 apex route/width cells, zero console errors and no form submission.

Final live reads at 09:24:20Z and 09:24:24Z confirmed the new staging and
production versions each active at 100 percent. No rollback was needed.
Web and collaboration were not deployed; no extra A4 environment write.

## Not crossed

No remote database write, Auth query or sign-in, real user creation, new
provider/queue enablement, run or quote, charge, signup collection, email,
posting, CRM action, DNS/domain change, new resource, new visitor-facing
Spanish, secret load/disclosure, deletion, force-push, history rewrite or
ruleset/hook bypass. PR #1 and the canonical checkout were untouched.

## Owner queue

The founder input, remote schema backlog, public Auth settings and pending
SQL-fixture scope proposal retain their recorded clearing inputs. Complete
migration, connected-staging and feature-enablement packs remain separate
required work; this record does not claim those packs or acceptance finished.

## Parked

None. The unexplained SQL failure remains an owner-scope item.

Next action: ship the approved S0 English wordless plate under D2.
