# Replacement observation — thirtieth scheduled checkpoint

Trigger **2026-09-09T14:35:08.671Z**; collection **14:35:56Z–14:37:40Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, HEAD
`a3419fc428e1aa2d495be2ac06f2b8ba37a79ad2`, one clean worktree.
Pinned Node 24.18.0 and pnpm 11.12.0 matched. Preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`; all 69 external graph
input hashes matched and previously read authority documents remained unchanged.

**Partial supplemental checkpoint:** available provider and database reads
remained stable. Owner Chrome remained unavailable, so fresh browser denials,
render outcomes and RSC counts are UNKNOWN. Day one already passed within its
required window in `replacement-observation-day-01-2026-09-09.md`; that
acceptance and the remaining required captures are unchanged.

## Database

The approved S1–S7 SELECTs ran sequentially through the connector explicitly
targeting Supabase project `jjgtlfblsfobdhmtngbz`. Every call returned tool
success; HTTP status is not exposed. Client UTC bounds are whole seconds and
database timestamps use a separate clock.

| Check           | Client UTC bounds | Result                                                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1              | 14:36:11–14:36:12 | User 1; session 1; refresh tokens 15; flow state 0; identity 1; non-null password field 1. Database time 14:36:12.852999Z. |
| S2              | 14:36:12–14:36:14 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3              | 14:36:14–14:36:16 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4              | 14:36:16–14:36:18 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00.                              |
| S5              | 14:36:18–14:36:20 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6              | 14:36:20–14:36:21 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7              | 14:36:21–14:36:22 | Anonymous public-table grants 0.                                                                                           |
| Token aggregate | 14:36:22–14:36:24 | Total 15; revoked 14; active 1; distinct sessions 1. Database time 14:36:24.034201Z.                                       |

S4 was exactly `select public.get_platform_kill_switches() as kill_switches;`.
False fields: signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change was used.

Sign-in remained September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**, and latest touch September 9 **03:33:31.159993Z**.
Counts and timestamps match checkpoint 29. Revoked historical refresh tokens
are distinct from active tokens and do not imply additional sessions.
Password-reset completion and current browser usability are not inferred.
The complete S2 table enumeration remains in the day-one report.
No post-probe SQL was run or claimed because no browser probe ran.
Snapshots do not establish intervening database contents.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 14:36:31.3361366 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 504c1897-fc35-432e-91df-d69c11c9fd4b; client 768 ms. |
| 14:36:31.4777182 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request c814d690-bf89-440c-9188-85c0e9167fe9; client 37 ms.                                 |
| 14:36:31.7342574 | Anonymous protected alias   | HTTP 302 to vercel.com; client 251 ms; redirect query omitted.                                                        |
| 14:36:32.3815649 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 14:36:32.5352430 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 14:36:32.6239889 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 14:36:32.7942569 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

Client durations are not Worker p95, SLO or capacity measurements. Hidden
proxied CNAME configuration is not inferred from A answers.

## Browser coverage

Both initial and later inventories exposed only the Codex in-app browser.
The existing owner Chrome provider remained unavailable. No substitute session,
supported canvas/quote navigation, rendered-page check, Network.enable, new login
or fresh handoff ran. Fresh denial statuses and RSC-503 counts are UNKNOWN.
Historical successful browser evidence is preserved and is not presented as fresh.
The resolved day-one browser-attention request remains resolved; no immediate
owner action is required for this optional capture. No closing sign-out occurred.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All commands completed on their first attempts with checked native exit 0.
R2 used command-local `WRANGLER_SEND_METRICS=false`, already verified in the
pinned CLI at checkpoint 21. No interruption, credential recovery or production
configuration change was needed this turn.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 14:36:34.6866523 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 14:36:38.5213303 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 14:36:38.5213303 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 14:36:41.8217661 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 14:36:36.4433471 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 14:36:39.8881838 | R2 public access  | r2.dev disabled.                                                                                                          |
| 14:36:43.5193791 | R2 domains        | None.                                                                                                                     |

Exact targets were `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No observed drift in deployment, versions,
gates, secret names or storage. No secret values were retained.

## Vercel

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed
**14:36:31.2720334Z**: READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
At **14:36:31.5408670Z**, listing returned no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**14:36:50Z**. No runtime-error clusters were returned. Status histogram returned
**HTTP 200: 523; HTTP 403: 26**, explicitly **three distinct values, two shown**
despite limit 100. The omitted category/count remain UNKNOWN. These aggregate
records neither replace fresh browser denials nor establish exhaustive runtime
or edge coverage.

## Verification and disposition

Preflight, the same-next-action handoff, formatting and `pnpm governance:check`
passed. Documentation authority, active packet, transition receipts, cleanroom
scan, generated OpenAPI and all eight generated documentation files were valid.
After handoff and formatting, both authority YAML files remained byte-identical
to HEAD. No full build was repeated for this unchanged-code supplemental checkpoint.

Publication remains held under CI cost rules: existing push workflows lack
Markdown path filters and workflow paths are outside the active step. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`, freshly verified using
`git ls-remote`. Prior CI results were not reread.
No push, workflow dispatch, workflow change or weakened check occurred.
CI for unpublished evidence is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No credentials,
headers, cookies, raw Auth/customer rows or sensitive query values were saved.
The original September 4–7 window remains NOT PROVEN. Day-one evidence is
unchanged; day two, closing, whole-window acceptance and the separate actual
owner traffic ruling remain pending. No successor was activated.

Next action: retry owner-browser availability during supplemental coverage and
collect required day two September 10 **01:18:11Z–05:18:11Z**; closing remains
September 11 **03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
