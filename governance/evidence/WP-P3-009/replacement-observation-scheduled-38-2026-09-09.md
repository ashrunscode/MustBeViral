# Replacement observation — thirty-eighth scheduled checkpoint

Trigger **2026-09-09T22:39:15.914Z**; database/provider/browser collection
**2026-09-09T22:40:05.555Z–2026-09-09T22:41:57.237Z**.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`,
starting HEAD `3b5accd440541386875c024a3b72547c9fa9fe28`, one clean worktree.
Node 24.18.0 / pnpm 11.12.0 matched. Preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`.
Accepted authority remained unchanged; baseline and recovery procedures were reread.

**Supported supplemental checks verified.** Both owner-browser permission
denials passed first attempt with fresh HTTP 403 server corroboration.
No browser recovery was needed. Tenant/money counts stayed zero, all gates
remained disabled, and storage remained private. The known HTTP 400 grouping
was unchanged. Collection was under 30 minutes.

Day one remains passed by `replacement-observation-day-01-2026-09-09.md`.
Day two, closing, whole-window acceptance and the separate actual owner traffic
ruling remain pending. The external W0 review draft has not changed the active
packet; this checkpoint does not authorize its activation or implementation.

## Database

Approved S1–S7 SELECTs ran sequentially through the connector explicitly targeting
Supabase `jjgtlfblsfobdhmtngbz`. Each returned tool success; HTTP status is
not exposed. Client bounds and database timestamps use separate clocks.

| Check           | Client UTC bounds on September 9 | Result                                                                                                                     |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1              | 22:40:05.555–22:40:19.119        | User 1; session 1; refresh tokens 22; flow state 0; identity 1; non-null password field 1. Database time 22:40:18.669914Z. |
| S2              | 22:40:19.120–22:40:20.593        | All 27 tenant/money/machine tables zero.                                                                                   |
| S3              | 22:40:20.593–22:40:22.377        | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4              | 22:40:22.377–22:40:24.065        | Exact getter succeeded; four false switches; updated_at unchanged.                                                         |
| S5              | 22:40:24.065–22:40:26.924        | 31 public tables; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6              | 22:40:26.924–22:40:28.173        | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7              | 22:40:28.174–22:40:29.817        | Anonymous public-table grants 0.                                                                                           |
| Token aggregate | 22:40:29.817–22:40:31.449        | 22 total; 21 revoked; 1 active; 1 distinct session. Database time 22:40:31.773262Z.                                        |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
signups_enabled, charging_enabled, generation_enabled and provider_routes_enabled
were false; updated_at remained **2026-09-02T15:47:59.474991+00:00**.
No fallback or permission change.

Sign-in stayed September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**; initial latest touch was September 9
**21:39:53.547239Z**. After the browser probes:

- S2, client **22:41:44.456Z–22:41:52.163Z**: all 27 tables still zero.
- S1, client **22:41:52.164Z–22:41:55.879Z**, database
  **22:41:56.217603Z**: user/session/identity/password/flow counts unchanged;
  refresh tokens 23; latest touch **22:40:44.879812Z**.
- Token aggregate, client **22:41:55.879Z–22:41:57.236Z**, database
  **22:41:57.577138Z**: **23 total / 22 revoked / 1 active / 1 distinct session**.

This is consistent with normal refresh rotation for the original session.
No additional active session or password-reset completion is inferred.
Database times slightly exceeding client completion times are preserved without
merging the clocks. The full S2 enumeration is in day-one evidence; all 27 named
tables were queried again. Snapshots do not prove intervening contents.

## Owner browser and retained denials

Existing Chrome profile E tab **1193312250**, browser 2, rendered Continue.
Network.enable was acknowledged **22:40:43.034Z**, cursor 2255.
Canvas first showed loading, then final denial at **22:40:59.763Z**.
Quote first showed calculating, then final denial at **22:41:26.231Z**.
No loading state was counted as a successful denial.

| Supported Core proxy path                                         | Fresh retained server time | Rendered result                                                                |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 22:40:47.586Z              | HTTP 403; Canvas unavailable — You do not have access to this canvas.          |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 22:41:01.014Z              | HTTP 403; Quote unavailable — You do not have permission to quote this canvas. |

The event read returned 84 events through cursor 2694 with
`truncated=true` and `hasMore=false`. **75 observed responses: 73 HTTP 200
and two HTTP 403.** **32 were RSC responses; zero observed RSC responses were
HTTP 503.** Nine loading failures were canceled `net::ERR_ABORTED`.
These are partial counts; evicted events are unknown.

Network.disable was acknowledged **22:41:26.345Z**. Continue rendered the saved
Quote and confirmation step; handoff was acknowledged **22:41:26.875Z**.
No new tab, login, fixture, form save, provider run or closing sign-out.
The denials prove containment, not successful authorized canvas access or direct
execution of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion on September 9 | Check                       | Result                                                                                                                |
| ----------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 22:40:07.0095669              | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request f952b162-0b2d-47c1-9080-90c482bdd814; client 496 ms. |
| 22:40:07.2386833              | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request 671f0b3b-8eb2-42e4-b9e3-628460b68edb; client 120 ms.                                |
| 22:40:07.5715072              | Anonymous protected alias   | HTTP 302 to vercel.com; client 329 ms; redirect query omitted.                                                        |
| 22:40:10.2851894              | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 22:40:10.4593268              | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 22:40:10.6203379              | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 22:40:10.6991042              | mustbeviral.com A           | 104.21.6.198 and 172.67.135.59.                                                                                       |

Client durations do not establish Worker p95, SLO or capacity.
Hidden proxied CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All commands completed first attempt with checked native exit 0. R2 used existing
command-local `WRANGLER_SEND_METRICS=false`; no provider configuration change.

| UTC completion on September 9 | Check             | Result                                                                                                                    |
| ----------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 22:40:12.5495530              | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 22:40:15.4986568              | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 22:40:15.4986568              | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 22:40:18.8247824              | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 22:40:12.5093269              | R2 information    | 0 objects; 0 B.                                                                                                           |
| 22:40:15.4696564              | R2 public access  | r2.dev disabled.                                                                                                          |
| 22:40:18.6862520              | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, gate, secret-name or storage
drift observed. No secret values retained.

## Vercel and existing HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed **22:40:07.2093341Z**:
READY, separate state null, unchanged provider aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **22:40:07.5035820Z** found no deployment since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**22:41:44.456Z**. No runtime-error clusters returned. Histogram:
**HTTP 200: 934; HTTP 403: 43; HTTP 400: 9**; four distinct values, three
shown despite limit 100. Omitted category/count remain UNKNOWN.
HTTP 400 path grouping remained five API-key-path and four Skills-path records.

Pinned Vercel CLI 55.0.0 unfiltered logs ran
**22:41:45.0785865Z–22:41:50.2957911Z**, selecting
**22:39:15.914Z–22:41:45.0735283Z**. It returned **41 records / 41 unique IDs**,
below limit 100: 39 HTTP 200 and two HTTP 403. Each exact supported denial
record appeared once, level info. This retrieval did not hit the cap or contain
duplicate IDs; it does not establish exhaustive edge/browser coverage.

The existing HTTP 400 finding and checkpoint-31 notification remain preserved.
Checkpoint 32's nine-record CLI projection covered
**15:22:40.937Z–15:26:50.050Z**. It was not rerun because connector grouping was
unchanged; its historical timestamps are not newly verified CLI results.
The cause remains unproven. No additional navigation, source inspection or repair.

## Verification and disposition

Pinned preflight, agent handoff with the existing next action, report formatting,
and pnpm governance:check passed. Governance validated 37 registered documents,
15 transition receipts, 9,167 scanned files, current OpenAPI and eight generated
references. PROJECT_STATE.yaml and ACTIVE_WORK_PACKET.yaml remained byte-identical.
Only this checkpoint report is included in the local commit. No application code
changed; full builds and agent:verify were not repeated for this routine capture.

Published HEAD `966006beb9bc163019f6c04a564d820b577e1a6d` was freshly
verified using `git ls-remote`. Publication remains held under CI cost rules:
existing push workflows lack Markdown path filters and workflow paths are
outside the active step. No push, dispatch, workflow change or weakened check.
Prior CI results were not reread; unpublished evidence CI is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation. No credentials, headers,
cookies, raw Auth/customer rows or sensitive query values retained.
The original September 4–7 window remains NOT PROVEN. No successor activated.

Next action: preserve the existing finding while collecting required day two
September 10 **01:18:11Z–05:18:11Z**; closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
