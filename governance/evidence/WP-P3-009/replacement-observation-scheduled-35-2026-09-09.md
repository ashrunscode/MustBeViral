# Replacement observation — thirty-fifth scheduled checkpoint

Trigger **2026-09-09T19:37:42.812Z**; collection
**19:37:51.049Z–19:40:46.068Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`,
starting HEAD `2a8f6f290fdd0924a65c68a1b03f02269ddef6ed`, one clean worktree.
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
| S1             | 19:38:28.824–19:38:33.733 | User 1; session 1; refresh tokens 19; flow state 0; identity 1; non-null password field 1. Database time 19:38:33.871373Z. |
| S2             | 19:38:33.733–19:38:37.239 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3             | 19:38:37.239–19:38:38.866 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4             | 19:38:38.866–19:38:40.897 | Exact getter succeeded; all four switches false; baseline updated_at unchanged.                                            |
| S5             | 19:38:40.897–19:38:42.553 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6             | 19:38:42.553–19:38:44.977 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7             | 19:38:44.977–19:38:46.414 | Anonymous public-table grants 0.                                                                                           |
| TokenAggregate | 19:38:46.414–19:38:48.213 | Total 19; revoked 18; active 1; distinct sessions 1. Database time 19:38:48.458753Z.                                       |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
signups_enabled, charging_enabled, generation_enabled and provider_routes_enabled
were false; updated_at remained **2026-09-02T15:47:59.474991+00:00**.
No fallback or permission change.

Sign-in stayed September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**; initial latest touch was September 9
**18:39:50.000909Z**. After the browser probes:

- S2, client **19:40:27.518Z–19:40:29.192Z**: all 27 tables still zero.
- S1, client **19:40:29.192Z–19:40:31.084Z**, database
  **19:40:31.330495Z**: user/session/identity/password/flow counts unchanged;
  refresh tokens 20; latest touch **19:39:24.760463Z**.
- Token aggregate, client **19:40:31.084Z–19:40:32.970Z**, database
  **19:40:33.127813Z**: **20 total / 19 revoked / 1 active / 1 distinct session**.

This is consistent with normal refresh rotation for the same original session.
No additional active session or password-reset completion is inferred.
Database times slightly exceeding client completion times are preserved without
merging the clocks. The full S2 enumeration is in day-one evidence. Snapshots
do not prove intervening contents.

## Owner browser and retained denials

The existing Chrome profile E tab **1193312250**, browser 2, rendered Continue.
Network.enable was acknowledged **19:39:16.333Z**, cursor 912. Both supported
paths rendered final permission denials on their first attempts.

| Supported Core proxy path                                         | Fresh retained server time | Rendered result                                                                |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 19:39:27.123Z              | HTTP 403; Canvas unavailable — You do not have access to this canvas.          |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 19:39:36.224Z              | HTTP 403; Quote unavailable — You do not have permission to quote this canvas. |

The event read returned 87 events through cursor 1326 with
`truncated=true` and `hasMore=false`. **75 observed responses: 73 HTTP 200
and two HTTP 403.** **32 were RSC responses; zero observed RSC responses were
HTTP 503.** Twelve loading failures were canceled `net::ERR_ABORTED`.
These are partial counts; evicted events are unknown.

Network.disable was acknowledged **19:39:50.873Z**. Continue rendered with the
saved Quote and confirmation step, and handoff was acknowledged
**19:40:00.879Z**. No new tab, login, fixture, form save, provider run or closing
sign-out occurred. The denials establish containment, not successful authorized
canvas access or execution of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 19:38:59.4558266 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 9b8c2a3c-ee8f-405b-b7c4-af3296453569; client 497 ms. |
| 19:38:59.6122749 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request a3fcc733-d8ad-45f3-a05d-d69e9e61ad48; client 71 ms.                                 |
| 19:38:59.7576796 | Anonymous protected alias   | HTTP 302 to vercel.com; client 138 ms; redirect query omitted.                                                        |
| 19:39:01.2295493 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 19:39:01.3090303 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 19:39:01.3665729 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 19:39:01.4352874 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

Client durations do not establish Worker p95, SLO or capacity. Hidden proxied
CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All commands completed first attempt with checked native exit 0. R2 used existing
command-local `WRANGLER_SEND_METRICS=false`; no provider configuration change.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 19:39:02.1792000 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 19:39:04.6927429 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 19:39:04.6927429 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 19:39:07.2070711 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 19:39:02.8814647 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 19:39:05.6526576 | R2 public access  | r2.dev disabled.                                                                                                          |
| 19:39:07.9397438 | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, version, gate, secret-name
or storage drift observed. No secret values retained.

## Vercel and existing HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed **19:39:01.7367628Z**:
READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **19:39:02.2024831Z** found no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**19:40:19.902Z**. No runtime-error clusters returned. Histogram:
**HTTP 200: 817; HTTP 403: 37; HTTP 400: 9**; four distinct values, three
shown despite limit 100. The omitted category/count remain UNKNOWN.
HTTP 400 path grouping remained five API-key-path and four Skills-path records.

Pinned Vercel CLI 55.0.0 unfiltered logs ran
**19:40:20.5648095Z–19:40:24.1323553Z**, selecting
**19:37:42.812Z–19:40:20.5615114Z**. It returned **41 records / 41 unique IDs**,
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
