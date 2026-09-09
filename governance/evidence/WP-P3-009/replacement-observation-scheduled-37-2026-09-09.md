# Replacement observation — thirty-seventh scheduled checkpoint

Trigger **2026-09-09T21:38:14.937Z**; collection
**21:38:24.150Z–21:41:10.012Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`,
starting HEAD `d981cfe8dbe768c29e6caf731c4deae19605848e`, one clean worktree.
Node 24.18.0 / pnpm 11.12.0 matched. Preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`. All 69 external graph input
hashes matched. Previously read authority remained unchanged; the active packet
and baseline/recovery procedures were reread.

**Supported supplemental checks verified.** Both owner-browser permission
denials passed on the first attempt, with fresh HTTP 403 server corroboration.
No browser recovery was needed. Tenant/money counts, disabled gates and private
storage remained contained. The known HTTP 400 grouping was unchanged.

Day one remains passed by `replacement-observation-day-01-2026-09-09.md`.
Day two, closing, whole-window acceptance and the separate actual owner traffic
ruling remain pending. No acceptance or successor was advanced.

## Database

Approved S1–S7 SELECTs ran sequentially through the connector explicitly targeting
Supabase `jjgtlfblsfobdhmtngbz`. All returned tool success; HTTP status is
not exposed. Client bounds and database timestamps use separate clocks.

| Check          | Client UTC bounds         | Result                                                                                                                     |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1             | 21:39:02.091–21:39:03.389 | User 1; session 1; refresh tokens 21; flow state 0; identity 1; non-null password field 1. Database time 21:39:03.705674Z. |
| S2             | 21:39:03.389–21:39:04.754 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3             | 21:39:04.754–21:39:06.086 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4             | 21:39:06.086–21:39:07.167 | Exact getter succeeded; all four switches false; baseline updated_at unchanged.                                            |
| S5             | 21:39:07.167–21:39:08.200 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6             | 21:39:08.200–21:39:09.313 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7             | 21:39:09.313–21:39:10.544 | Anonymous public-table grants 0.                                                                                           |
| TokenAggregate | 21:39:10.544–21:39:11.728 | Total 21; revoked 20; active 1; distinct sessions 1. Database time 21:39:12.032622Z.                                       |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
signups_enabled, charging_enabled, generation_enabled and provider_routes_enabled
were false; updated_at remained **2026-09-02T15:47:59.474991+00:00**.
No fallback or permission change.

Sign-in stayed September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**; initial latest touch was September 9
**20:39:25.032027Z**. After the browser probes:

- S2, client **21:40:54.493Z–21:40:55.630Z**: all 27 tables still zero.
- S1, client **21:40:55.630Z–21:40:56.936Z**, database
  **21:40:57.224109Z**: user/session/identity/password/flow counts unchanged;
  refresh tokens 22; latest touch **21:39:53.547239Z**.
- Token aggregate, client **21:40:56.936Z–21:40:58.756Z**, database
  **21:40:59.071Z**: **22 total / 21 revoked / 1 active / 1 distinct session**.

This is consistent with normal refresh rotation for the same original session.
No additional active session or password-reset completion is inferred.
Database times slightly exceeding client completion times are preserved without
merging the clocks. The full S2 enumeration is in day-one evidence. Snapshots
do not prove intervening contents.

## Owner browser and retained denials

The existing Chrome profile E tab **1193312250**, browser 2, rendered Continue.
Network.enable was acknowledged **21:39:42.705Z**, cursor 1794. Both supported
paths rendered final permission denials on their first attempts.

| Supported Core proxy path                                         | Fresh retained server time | Rendered result                                                                |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 21:39:55.900Z              | HTTP 403; Canvas unavailable — You do not have access to this canvas.          |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 21:40:04.352Z              | HTTP 403; Quote unavailable — You do not have permission to quote this canvas. |

The event read returned 83 events through cursor 2224 with
`truncated=true` and `hasMore=false`. **75 observed responses: 73 HTTP 200
and two HTTP 403.** **32 were RSC responses; zero observed RSC responses were
HTTP 503.** Eight loading failures were canceled `net::ERR_ABORTED`.
These are partial counts; evicted events are unknown.

Network.disable was acknowledged **21:40:18.788Z**. Continue rendered with the
saved Quote and confirmation step, and handoff was acknowledged
**21:40:25.248Z**. No new tab, login, fixture, form save, provider run or closing
sign-out occurred. The denials establish containment, not successful authorized
canvas access or execution of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 21:39:25.2367510 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 3bef8430-c2f1-4222-89fd-d00a945fe551; client 469 ms. |
| 21:39:25.3722090 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request be719e69-23c0-4d36-9004-c1172ae99acb; client 60 ms.                                 |
| 21:39:25.6394487 | Anonymous protected alias   | HTTP 302 to vercel.com; client 262 ms; redirect query omitted.                                                        |
| 21:39:26.0944285 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 21:39:26.1738095 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 21:39:26.2721215 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 21:39:26.4050783 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

Client durations do not establish Worker p95, SLO or capacity. Hidden proxied
CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All commands completed first attempt with checked native exit 0. R2 used existing
command-local `WRANGLER_SEND_METRICS=false`; no provider configuration change.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 21:39:35.6093890 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 21:39:38.4745115 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 21:39:38.4745115 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 21:39:40.8467667 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 21:39:35.5803289 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 21:39:38.3728105 | R2 public access  | r2.dev disabled.                                                                                                          |
| 21:39:40.8672293 | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, version, gate, secret-name
or storage drift observed. No secret values retained.

## Vercel and existing HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed **21:39:25.3185891Z**:
READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **21:39:25.4439449Z** found no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**21:40:46.366Z**. No runtime-error clusters returned. Histogram:
**HTTP 200: 895; HTTP 403: 41; HTTP 400: 9**; four distinct values, three
shown despite limit 100. The omitted category/count remain UNKNOWN.
HTTP 400 path grouping remained five API-key-path and four Skills-path records.

Pinned Vercel CLI 55.0.0 unfiltered logs ran
**21:40:47.4497116Z–21:40:53.2604649Z**, selecting
**21:38:14.937Z–21:40:47.4416894Z**. It returned **41 records / 41 unique IDs**,
below limit 100: 39 HTTP 200 and two HTTP 403. Each exact supported denial
record above appeared once, level info. This retrieval did not hit the cap or
contain duplicate IDs; it still does not establish exhaustive edge/browser
coverage or explain earlier duplicate projections.

The existing HTTP 400 finding and checkpoint-31 notification remain preserved.
The prior nine-record CLI projection in checkpoint 32 covered
**15:22:40.937Z–15:26:50.050Z**. It was not rerun because the connector grouping
remained unchanged; its exact historical timestamps are not newly verified CLI
results. The cause remains unproven. No additional page navigation, source
inspection or repair occurred.

## Verification and disposition

Preflight, the same-next-action handoff, formatting and `pnpm governance:check`
passed. Documentation authority, active packet, transition receipts, cleanroom
scan, generated OpenAPI and all eight generated documentation files were valid.
After handoff and formatting, both authority YAML files remained byte-identical
to HEAD. No full build was repeated for this unchanged-code supplemental checkpoint.

Published HEAD `966006beb9bc163019f6c04a564d820b577e1a6d` was freshly
verified using `git ls-remote`. Publication remains held under CI cost rules:
existing push workflows lack Markdown path filters and workflow paths are
outside the active step. No push, workflow dispatch, workflow change or weakened
check occurred. Prior CI results were not reread; unpublished evidence CI is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No credentials,
headers, cookies, raw Auth/customer rows or sensitive query values were retained.
The original September 4–7 window remains NOT PROVEN. No successor was activated.

Next action: preserve the existing finding while collecting required day two
September 10 **01:18:11Z–05:18:11Z**; closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
