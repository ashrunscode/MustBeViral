# Replacement observation — twentieth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T03:31:08.700Z**. Collection ran **03:32:05Z–03:35:11Z**, at HEAD
`bc556b302992292279f42b8d90aa80b395e9f19d`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0,
preflight and all 69 external graph input hashes passed. Previously read
authority documents remained unchanged. Current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`.

**Verified supplemental checkpoint with disclosed telemetry limits.** Both
supported owner denials rendered and both HTTP 403 paths were corroborated in
browser and retained Vercel records. All 27 tenant/money/machine tables remained
zero afterward. Available database, gates, endpoint, deployment, storage and DNS
reads showed no unauthorized drift. The original owner session refreshed normally.

Required day one remains passed by
`replacement-observation-day-01-2026-09-09.md`. This hourly checkpoint preserves
that capture and does not advance a daily or whole-window acceptance decision.
Day two, closing and the separate actual owner traffic ruling remain pending.

## Database evidence

The approved S1–S7 SELECTs ran sequentially through the project-scoped Supabase
connector against only `jjgtlfblsfobdhmtngbz`. Every call returned tool success;
the connector exposes no HTTP status. S1 additionally captured database time.

| Check          | Client UTC bounds | Result                                                                                                                             |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 03:32:33–03:32:35 | 1 user; 1 session; 14 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 03:32:35.798942Z |
| S2             | 03:32:35–03:32:36 | All 27 tenant/money/machine table counts zero                                                                                      |
| S3             | 03:32:36–03:32:38 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4             | 03:32:38–03:32:39 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00                                       |
| S5             | 03:32:39–03:32:41 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6             | 03:32:41–03:32:42 | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7             | 03:32:42–03:32:43 | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate | 03:32:43–03:32:45 | 14 total; 13 revoked; 1 active; 1 distinct session; database time 03:32:45.564952Z                                                 |

Exact S4 was `select public.get_platform_kill_switches() as kill_switches;`.
Its four false fields were signups_enabled, charging_enabled, generation_enabled
and provider_routes_enabled. No fallback, role or grant change was used. Earlier
Management API getter denials remain historical evidence.

After the two browser denials, S2 at **03:34:57Z–03:34:58Z** again returned all
27 table counts zero; the full enumeration remains in the day-one report. S1 at
**03:34:58Z–03:35:01Z**, database time **03:35:01.102789Z**, returned the same
Auth counts except **15 refresh-token rows**. TokenAggregate at
**03:35:01Z–03:35:02Z**, database time **03:35:02.742104Z**, returned **15 total,
14 revoked, 1 active and 1 distinct session**.

Sign-in remained September 4 **21:19:38.051408Z**, session creation remained
**21:19:38.052003Z**, and latest touch advanced from September 9
**02:34:46.585199Z** to **03:33:31.159993Z** during browser use. Normal retained
session refresh added one revoked historical token; it did not create a second
active session. Password-reset completion is not inferred. Client bounds have
whole-second precision and database timestamps use the separate database clock.

## Endpoints, Auth and DNS

| UTC completion   | Check                               | Result                                                                                                                      |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 03:32:47.0621666 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request ec259178-7101-4b26-99df-b7f5fe158b4b; client 675 ms |
| 03:32:47.3174817 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request 5dfa5e4f-663b-4eaf-aa16-f4ba73b73a21; client 76 ms                                        |
| 03:32:47.6022833 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 249 ms                                                               |
| 03:32:48.4447095 | Auth projection                     | disable_signup=true; mailer_autoconfirm=false                                                                               |
| 03:32:48.7161603 | api.mustbeviral.com A               | NXDOMAIN, status 3                                                                                                          |
| 03:32:48.8136825 | www.mustbeviral.com A               | 172.67.135.59 and 104.21.6.198                                                                                              |
| 03:32:48.9005603 | mustbeviral.com A                   | 104.21.6.198 and 172.67.135.59                                                                                              |

Client elapsed times are not Worker p95, SLO or capacity measurements. Proxied
hidden CNAME configuration is not inferred from A answers.

## Browser containment and coverage

The retained owner Chrome tab rendered Continue. Supported zero-UUID navigation
then rendered **“Canvas unavailable You do not have access to this canvas.”**,
verified at **03:33:36.670Z**, and **“Quote unavailable You do not have permission
to quote this canvas.”**, verified at **03:34:11.155Z**. Both were final denial
states, not loading placeholders. No browser reconnect, new login or probe retry
was needed.

Network capture **03:33:29.023Z–03:34:11.190Z** observed **77 responses: 75 HTTP
200 and 2 HTTP 403**, including **32 RSC responses and 0 observed RSC 503s**.
Seven loading failures were canceled `net::ERR_ABORTED` events. The first read
after baseline cursor 507 returned 37 events, cursor 722, `hasMore=false` and
**`truncated=true`**. The subsequent read from cursor 722 used the same method
filters and returned 47 events, cursor 972, `hasMore=false`, `truncated=false`.
These are observed records only; the earlier truncation prevents an exhaustive
network-coverage claim.

Both observed HTTP 403 paths were:

```text
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes
```

`Network.disable` was explicitly acknowledged at **03:34:11.220Z**. Continue
rendered successfully after the probes and `markHandoff` was acknowledged at
**03:34:24.133Z**, preserving the owner session for later captures. Its remembered
quote workflow step is browser-local navigation state, not a saved project or quote.

The denials follow `observation-recovery-procedure-2026-09-08.md` and prove
permission containment. They do not claim successful authorized canvas access,
an empty successful MCP context or direct execution of the generation-policy
branch. No fixture or run was created; closing sign-out remains deferred.

## Worker and R2

Existing machine credentials were loaded into the read-command processes before
the first attempts. Pinned Wrangler 4.110.0 completed all commands successfully;
the wrappers checked native exit codes. Both sequences ended with exit 0. No
authentication recovery, new login or permission grant was needed this checkpoint.

| UTC completion   | Check             | Result                                                                                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 03:33:01.9394376 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 03:33:12.5102461 | Worker gates      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 03:33:12.5102461 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 03:33:22.0506048 | Worker history    | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 03:33:02.0642338 | R2 information    | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 03:33:12.4854818 | R2 public access  | r2.dev disabled                                                                                                                  |
| 03:33:22.0560862 | R2 custom domains | None                                                                                                                             |

Worker target was `mustbeviral-v2-production-core`. No observed deployment,
version, secret-name, storage or gate drift; no secret values were retained.

## Vercel evidence

Exact target: project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, production. REST at
**03:35:05.0065259Z** confirmed READY, null separate state field and unchanged
aliases `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. Listing at
**03:35:05.2102040Z** found no deployments since September 8 03:18:11Z;
pagination count 0 and next null.

Connector telemetry selected the anchor through September 9 **03:35:02Z**.
No runtime-error clusters were returned. Histogram: **HTTP 200: 523; HTTP 403:
25**, explicitly **3 distinct values but only 2 shown**, despite requested limit 100. The omitted status/count remain UNKNOWN. This is partial runtime coverage.

A separate unfiltered pinned Vercel CLI 55.0.0 query ran at
**03:35:04.3509025Z–03:35:10.7728257Z**, selecting
**03:32:05Z–03:35:04.3407627Z** for that exact deployment. It completed with
exit 0 and returned **41 records, 41 unique IDs**, below the 100-record limit:
39 HTTP 200 Studio pages and **one HTTP 403 info record for each exact canvas
and quote path above**. Statuses came from `responseStatusCode`. These records
corroborate both fresh browser probes without a repeated grouped-denial query.

Successful renders, zero observed RSC 503s and no returned runtime-error clusters
satisfy the supported supplemental checks. Partial browser/runtime coverage does
not prove every edge request or database state between snapshots.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting and governance checks
passed. Governance validated 37 registered documents, the active packet, 15
transition receipts, the cleanroom scan, current generated OpenAPI and 8 generated
documentation files. Structured aggregate consistency checks passed. Packet and
project-state files remained byte-identical after handoff and formatting. No full
build was repeated for this unchanged-code supplemental checkpoint.

Publication remains held under the CI cost rules: existing push workflows lack
Markdown path filters and workflow paths are outside the active step. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`; prior CI results were
not reread. No push, workflow dispatch, workflow edit or weakened check occurred.
CI for unpublished evidence is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No credentials, headers,
cookies, raw Auth/customer rows or sensitive query values were saved in evidence.
The original September 4–7 window remains NOT PROVEN. Day-one evidence and all
remaining clock/owner requirements are unchanged; no successor was activated.

Next action: retain hourly supplemental coverage and collect required day two
September 10 **01:18:11Z–05:18:11Z**. Closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed; the separate actual owner
traffic ruling remains pending.
