# Replacement observation — thirty-third scheduled checkpoint

Trigger **2026-09-09T17:37:40.912Z**; collection
**17:38:02.713Z–17:43:48Z** on September 9. Checkout
`C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, starting HEAD
`78f489419b93f4ab030d355f16849266e3757332`, one clean worktree.
Node 24.18.0 / pnpm 11.12.0 matched. Preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`.
All 69 external graph input hashes matched. Previously read authority remained
unchanged; the active packet and baseline/recovery procedures were reread.

**Supported supplemental checks verified after browser recovery.** Canvas and
quote permission denials rendered with fresh server HTTP 403 corroboration.
Tenant/money counts, provider gates and private storage stayed contained.
The known HTTP 400 grouping was unchanged. No new service incident or owner
action was established.

Day one remains passed by `replacement-observation-day-01-2026-09-09.md`.
Day two, closing, whole-window acceptance and the separate actual owner traffic
ruling remain pending. This supplemental capture advances no acceptance or successor.

## Database

Approved S1–S7 SELECTs ran sequentially through the connector explicitly targeting
Supabase `jjgtlfblsfobdhmtngbz`. All returned tool success; HTTP status is
not exposed. Client and database timestamps use separate clocks.

| Check          | Client UTC bounds         | Result                                                                                                                     |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1             | 17:38:39.278–17:38:40.414 | User 1; session 1; refresh tokens 17; flow state 0; identity 1; non-null password field 1. Database time 17:38:40.566316Z. |
| S2             | 17:38:40.414–17:38:41.812 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3             | 17:38:41.812–17:38:42.847 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4             | 17:38:42.847–17:38:43.909 | Exact getter succeeded; four switches false; updated_at 2026-09-02T15:47:59.474991+00:00.                                  |
| S5             | 17:38:43.909–17:38:44.975 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6             | 17:38:44.975–17:38:46.112 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7             | 17:38:46.112–17:38:47.119 | Anonymous public-table grants 0.                                                                                           |
| TokenAggregate | 17:38:47.119–17:38:48.251 | Total 17; revoked 16; active 1; distinct sessions 1. Database time 17:38:48.404915Z.                                       |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
False fields: signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change.

Sign-in stayed September 4 **21:19:38.051408Z**, session creation
**21:19:38.052003Z**; initial latest touch was September 9
**16:42:07.15219Z**. Post-probe reads:

- S2, client **17:43:37.144Z–17:43:38.955Z**: all 27 tables still zero.
- S1, client **17:43:38.955Z–17:43:40.282Z**, database
  **17:43:40.401851Z**: user/session/identity/password/flow counts unchanged;
  refresh tokens 18; latest touch **17:41:44.942913Z**.
- Token aggregate, client **17:43:40.282Z–17:43:42.321Z**, database
  **17:43:41.671057Z**: **18 total / 17 revoked / 1 active / 1 distinct session**.

One additional revoked token with the same original session and one active token
is consistent with normal refresh rotation. No additional active session or
password-reset completion is inferred. Some database timestamps slightly exceed
client completion times; the clocks are not merged into a precise timeline.
The full S2 enumeration is preserved in day-one evidence. Snapshots do not prove
intervening contents.

## Browser recovery and supported denials

The existing owner Chrome profile E tab **1193312250**, browser 2, initially
rendered Continue. Initial Network.enable was acknowledged
**17:39:22.842Z**, cursor 573. The canvas navigation timed out after 20 seconds
and reset the kernel. A tab rebind also timed out and reset it. Fresh inventory
found the same tab on the canvas URL; a claim/snapshot attempt timed out and
reset the kernel again. None of these timeouts is treated as a rendered outcome
or server failure.

Documented recovery reacquired the same browser and tab's CDP capability.
Network.disable was acknowledged **17:42:12.903Z**, followed by the visible
completed canvas denial. A fresh capture began **17:42:26.695Z**, cursor 7,
and an intentional reload verified the final canvas denial. The supported
quote URL then rendered its final permission denial.

| Supported Core proxy path                                         | Fresh retained server time | Result                                                                         |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------ |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 17:42:28.991Z              | HTTP 403; Canvas unavailable — You do not have access to this canvas.          |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 17:42:48.241Z              | HTTP 403; Quote unavailable — You do not have permission to quote this canvas. |

The fresh event page contained 76 events through cursor 428:
`truncated=true`, `hasMore=false`. **75 observed responses: 73 HTTP 200
and two HTTP 403.** **32 were RSC responses; zero observed RSC responses
were HTTP 503.** One loading failure was canceled `net::ERR_ABORTED`.
These are partial counts; the initial pre-reset capture is excluded and
evicted events are unknown.

Final Network.disable was acknowledged **17:43:03.610Z**. Continue rendered
with the saved Quote and confirmation step, and handoff was acknowledged
**17:43:10.376Z**. No new tab, login, fixture, form save, provider run or closing
sign-out occurred. Supported denials prove containment, not successful authorized
canvas access or execution of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 17:38:58.8433096 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request f194e237-3f23-4751-b5b5-de012d1748d7; client 945 ms. |
| 17:38:59.1750329 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request 73b2f7cd-90b8-4abc-af9d-fd9659825bc5; client 232 ms.                                |
| 17:38:59.3305384 | Anonymous protected alias   | HTTP 302 to vercel.com; client 123 ms; redirect query omitted.                                                        |
| 17:39:00.1604245 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 17:39:00.4999676 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 17:39:00.7802937 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 17:39:00.9694182 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

Client durations do not measure Worker p95, SLO or capacity. Hidden proxied
CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All commands completed on their first attempts with checked native exit 0.
R2 used existing command-local `WRANGLER_SEND_METRICS=false`; no provider
configuration change.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 17:39:14.1048494 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 17:39:17.9675678 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 17:39:17.9675678 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 17:39:47.5277115 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 17:39:14.0424722 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 17:39:17.4721647 | R2 public access  | r2.dev disabled.                                                                                                          |
| 17:39:41.6250143 | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, version, gate, secret-name
or storage drift observed. Secret values were not retained.

## Vercel and preserved HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed
**17:38:58.4414532Z**: READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **17:38:58.6022549Z** found no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**17:40:26.022Z**, before the recovered probes. No runtime-error clusters were
returned. Histogram: **HTTP 200: 684; HTTP 403: 31; HTTP 400: 9**; four
distinct values, three shown despite limit 100. The omitted category/count
remain UNKNOWN. The HTTP 400 path grouping remains five API-key-path and four
Skills-path records, unchanged from checkpoint 32.

After the recovered probes, pinned Vercel CLI 55.0.0 unfiltered logs ran
**17:43:27.4789105Z–17:43:37.0798829Z**, selecting
**17:37:40.912Z–17:43:27.4663507Z**. It returned **100 records / 50 unique IDs**,
hitting limit 100: 96 HTTP 200 and four HTTP 403 raw records.
Both fresh denial records above appeared twice with identical timestamps.
Duplicates are not extra requests, and this capped read is not exhaustive.

The existing API-key/Skills HTTP 400 finding and checkpoint-31 notification
remain preserved. Checkpoint 32's nine-record CLI projection, entirely within
**15:22:40.937Z–15:26:50.050Z**, was not rerun because the current connector
grouping was unchanged. Those exact historical timestamps/counts remain
checkpoint-32 evidence, not newly verified CLI results. The cause remains
unproven; no response body, new implementation inspection or repair was attempted.

## Verification and disposition

Preflight, the same-next-action handoff, formatting and `pnpm governance:check`
passed. Documentation authority, active packet, transition receipts, cleanroom
scan, generated OpenAPI and all eight generated documentation files were valid.
After handoff and formatting, both authority YAML files remained byte-identical
to HEAD. No full build was repeated for this unchanged-code supplemental checkpoint.

Publication remains held under CI cost rules: existing push workflows lack
Markdown path filters and workflow paths are outside the active step.
Published HEAD is `966006beb9bc163019f6c04a564d820b577e1a6d`;
this was freshly verified using `git ls-remote` before the final local commit.
Prior CI results were not reread. No push, workflow dispatch, workflow change
or weakened check occurred. CI for unpublished evidence is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No credentials,
headers, cookies, raw Auth/customer rows or sensitive query values were retained.
The original September 4–7 window remains NOT PROVEN. No successor was activated.

Next action: preserve the existing finding while collecting required day two
September 10 **01:18:11Z–05:18:11Z**; closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
