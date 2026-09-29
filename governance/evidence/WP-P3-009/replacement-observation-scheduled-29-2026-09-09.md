# Replacement observation — twenty-ninth scheduled checkpoint

Trigger **2026-09-09T12:57:48.643Z**; collection **12:58:32Z–13:00:11Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, HEAD
`24a800f5d7b9fb60053f3fb56db5b09eef7c88e6`, one clean worktree.
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
| S1              | 12:58:44–12:58:46 | User 1; session 1; refresh tokens 15; flow state 0; identity 1; non-null password field 1. Database time 12:58:46.795042Z. |
| S2              | 12:58:46–12:58:48 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3              | 12:58:48–12:58:49 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4              | 12:58:49–12:58:51 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00.                              |
| S5              | 12:58:51–12:58:52 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6              | 12:58:52–12:58:53 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7              | 12:58:53–12:58:55 | Anonymous public-table grants 0.                                                                                           |
| Token aggregate | 12:58:55–12:58:56 | Total 15; revoked 14; active 1; distinct sessions 1. Database time 12:58:56.195133Z.                                       |

S4 was exactly `select public.get_platform_kill_switches() as kill_switches;`.
False fields: signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change was used.

Sign-in remained September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**, and latest touch September 9 **03:33:31.159993Z**.
Counts and timestamps match checkpoint 28. Revoked historical refresh tokens
are distinct from active tokens and do not imply additional sessions.
Password-reset completion and current browser usability are not inferred.
The complete S2 table enumeration remains in the day-one report.
No post-probe SQL was run or claimed because no browser probe ran.
Snapshots do not establish intervening database contents.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 12:59:02.3102601 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 2b89d19e-f34a-45dd-bab9-267dfeb604d2; client 550 ms. |
| 12:59:02.4683049 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request 690209ae-0b7d-4d0d-9584-2c2e796f623f; client 24 ms.                                 |
| 12:59:02.6018054 | Anonymous protected alias   | HTTP 302 to vercel.com; client 127 ms; redirect query omitted.                                                        |
| 12:59:03.2173929 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 12:59:03.4766516 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 12:59:03.5360915 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 12:59:03.5914464 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

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
| 12:59:06.3831389 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 12:59:09.8788678 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 12:59:09.8788678 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 12:59:13.1729231 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 12:59:21.8615588 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 12:59:24.2483451 | R2 public access  | r2.dev disabled.                                                                                                          |
| 12:59:26.6930660 | R2 domains        | None.                                                                                                                     |

Exact targets were `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No observed drift in deployment, versions,
gates, secret names or storage. No secret values were retained.

## Vercel

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed
**12:59:03.2217891Z**: READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
At **12:59:03.4730714Z**, listing returned no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**12:59:23Z**. No runtime-error clusters were returned. Status histogram returned
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
