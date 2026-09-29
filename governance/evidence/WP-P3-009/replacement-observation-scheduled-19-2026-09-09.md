# Replacement observation — nineteenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T02:31:07.640Z**. Collection ran **02:32:27Z–02:37:49.7561232Z**, at HEAD
`72ee4ce72a651485104d063aef98f59a8a3d08c7`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0 and
preflight passed. Previously read authority documents remain unchanged; all 69
external graph input hashes matched. Current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`.

**Verified supplemental checkpoint with explicit telemetry limits.** Both
supported owner denials rendered, browser responses and retained Vercel records
confirmed both HTTP 403 paths, and all 27 tenant/money/machine tables remained
zero afterward. Cloudflare reads initially lacked authentication in their shell
processes, then succeeded after loading existing machine credentials. No new
login, grant or production configuration change was needed. No unauthorized
service/database drift was observed.

Required day one remains passed by
`replacement-observation-day-01-2026-09-09.md`; this checkpoint does not replace
or repeat its acceptance decision. Day two, closing, whole-window acceptance
and the separate actual owner traffic ruling remain pending.

## Database evidence

S1–S7 ran sequentially through the project-scoped Supabase connector against
only `jjgtlfblsfobdhmtngbz`. Every query returned tool success; no HTTP status
is exposed by that connector. S1 additionally recorded database time.

| Check          | Client UTC bounds | Result                                                                                                                             |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 02:32:27–02:32:28 | 1 user; 1 session; 13 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 02:32:29.343432Z |
| S2             | 02:32:28–02:32:30 | All 27 tenant/money/machine table counts zero                                                                                      |
| S3             | 02:32:30–02:32:32 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4             | 02:32:32–02:32:33 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00                                       |
| S5             | 02:32:33–02:32:34 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6             | 02:32:34–02:32:36 | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7             | 02:32:36–02:32:38 | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate | 02:32:38–02:32:39 | 13 total; 12 revoked; 1 active; 1 distinct session; database time 02:32:39.647651Z                                                 |

The S4 fields were signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. Its exact query was
`select public.get_platform_kill_switches() as kill_switches;`. No Management
API fallback, role or grant change occurred. Prior read-only Management API getter
denials remain historical evidence rather than being retroactively repaired.

After both browser denials, S2 at **02:36:34Z–02:36:36Z** again returned all 27
counts zero. The complete table enumeration is retained in the day-one report.
S1 at **02:36:36Z–02:36:38Z**, database time **02:36:37.712605Z**, returned
1 user, 1 session, **14 refresh-token rows**, 0 flow-state rows, 1 identity and
1 non-null password field. TokenAggregate at **02:36:38Z–02:36:39Z**, database
time **02:36:40.266232Z**, returned **14 total, 13 revoked, 1 active and 1 distinct
session**. Client bounds have whole-second precision and database timestamps use
the separate database clock.

Sign-in remained September 4 **21:19:38.051408Z**; session creation remained
**21:19:38.052003Z**. Latest touch advanced from September 9
**01:30:32.290930Z** to **02:34:46.585199Z** during the existing browser session's
normal refresh. The additional revoked token is not a second active session.
No password-reset completion or continuous database state between snapshots is
inferred.

## Endpoints, Auth and DNS

| UTC completion   | Check                               | Result                                                                                                                      |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 02:33:15.0081793 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request 393a6b57-8256-40bf-a721-f8acd5fa2318; client 483 ms |
| 02:33:15.2509884 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request d3b30eee-6c75-4177-b1d0-a84f17761c7f; client 117 ms                                       |
| 02:33:15.3764158 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 120 ms                                                               |
| 02:33:15.8088055 | Auth projection                     | disable_signup=true; mailer_autoconfirm=false                                                                               |
| 02:33:15.9235034 | api.mustbeviral.com A               | NXDOMAIN, status 3                                                                                                          |
| 02:33:15.9878667 | www.mustbeviral.com A               | 104.21.6.198 and 172.67.135.59                                                                                              |
| 02:33:16.0495483 | mustbeviral.com A                   | 104.21.6.198 and 172.67.135.59                                                                                              |

Client elapsed times are not Worker p95, SLO or capacity measurements. Hidden
proxied CNAME configuration is not inferred from these A answers.

## Browser coverage and containment

The retained owner tab was already on a rendered Continue page. A browser-tool
session reset to reload its API documentation remapped Chrome's provider ID from
4 to 2; fresh inventory still showed the same Studio tab and Chrome profile.
The old provider ID was unavailable after reset. Reconnecting with the currently
reported ID succeeded; no browser outage or new sign-in is inferred from that
local handle change.

The supported absent-canvas page first rendered its loading state and then
**“Canvas unavailable You do not have access to this canvas.”**, verified at
**02:35:26.124Z**. The supported zero-UUID canvas/revision quote page likewise
first showed calculation and then **“Quote unavailable You do not have permission
to quote this canvas.”**, verified at **02:36:18.584Z**. Loading states were not
treated as completed probes.

Network capture **02:34:44.609Z–02:36:18.642Z** observed **75 responses: 73 HTTP
200 and 2 HTTP 403**. There were **32 RSC responses and 0 observed RSC 503s**.
Ten loading failures were canceled `net::ERR_ABORTED` events. The returned page
had 85 events, baseline cursor 5, final cursor 463, `hasMore=false` and
**`truncated=true`**. Counts are observed records only, not an exhaustive network
history.

Both browser HTTP 403 paths were:

```text
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes
```

`Network.disable` was explicitly acknowledged at **02:36:18.703Z**. Continue
rendered successfully after the probes, and `markHandoff` was acknowledged at
**02:36:19.271Z**. The same owner session remains retained for later captures.
The remembered quote workflow step is browser-local navigation state, not a saved
project or quote. No fixture, run, new sign-in or closing sign-out occurred.

These supported permission denials follow the recovery procedure. They prove
containment before workspace/quote execution, not successful authorized canvas
access, an empty successful MCP context or direct execution of a generation-policy
branch.

## Cloudflare authentication recovery, Worker and R2

Initial Worker/R2 shell calls did not load the machine credential vault. Worker
returned no deployment and the wrapper failed while indexing that missing
result, exit 1, at **02:33:17.2431936Z**. All three initial R2 subcommands reported
that non-interactive authentication was unavailable, through
**02:33:21.4419673Z**. Their enclosing shell returned exit 0 despite the printed
failures; those timestamps are failed attempts, not successful R2 reads.

Loading the existing machine credentials followed by pinned `wrangler whoami`
succeeded at **02:35:58.0618568Z**, exit 0, with the expected configured account
present. No secret values or identity output were retained. The connector's
Worker lookup also returned the named Worker, but that alone did not establish
deployment, flags or storage state. Retrying both CLI sequences with existing
credentials loaded succeeded with exit 0 and the following actual results:

| UTC completion   | Check             | Result                                                                                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 02:37:15.9528980 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 02:37:18.6263546 | Worker gates      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 02:37:18.6263546 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 02:37:21.2567825 | Worker history    | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 02:37:16.1781957 | R2 information    | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 02:37:18.7376943 | R2 public access  | r2.dev disabled                                                                                                                  |
| 02:37:21.4841778 | R2 custom domains | None                                                                                                                             |

Pinned Wrangler was 4.110.0. No new credential, permission grant, deployment or
provider configuration was created or changed. Only existing credentials were
loaded into the read-command processes. Future command wrappers retain explicit
native-exit checks so a shell's final timestamp cannot mask a failed CLI read.

## Vercel evidence

Exact target: project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, production. REST at
**02:37:22.4842562Z** confirmed READY, null separate state field and unchanged
aliases `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. Listing at
**02:37:22.6105130Z** found no deployments since the September 8 03:18:11Z
anchor; pagination count 0 and next null.

Connector telemetry selected the anchor through September 9 **02:37:21Z**.
Runtime-error clusters: none returned for that range. Histogram: **HTTP 200: 484;
HTTP 403: 22**, with **3 distinct values but only 2 shown**, despite limit 100.
The omitted category/count remain UNKNOWN. The checkpoint-scoped grouped HTTP
403 query returned no rows, which is not proof of zero requests.

A separate unfiltered pinned Vercel CLI 55.0.0 query ran at
**02:37:45.4021573Z–02:37:49.7561232Z**, selecting
**02:32:27Z–02:37:45.3970022Z** for that exact deployment. It completed with
exit 0 and returned **41 records, 41 unique IDs**, below the 100-record limit:
39 HTTP 200 Studio pages and **one HTTP 403 info record for each exact canvas
and quote path above**. `responseStatusCode` supplied the statuses. These fresh
records corroborate both browser denials. The disagreement with the grouped
result is disclosed without inventing a cause or equating absent rows to zero.

Successful page renders, zero observed RSC 503s and no returned runtime-error
clusters satisfy the supported supplemental capture checks. Browser event
truncation and partial histogram coverage remain explicit.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting and governance checks
passed. Governance validated 37 registered documents, the active packet, 15
transition receipts, the cleanroom scan, current generated OpenAPI and 8 generated
documentation files. Packet and project-state files remained byte-identical after
handoff and formatting. No full build was repeated for this unchanged-code
supplemental checkpoint.

Publication remains held under the CI cost rules: existing push workflows lack
Markdown path filters and workflow paths are outside the active step. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`; its prior CI results
were not reread. No push, workflow dispatch, workflow edit or weakened check
occurred. CI for unpublished evidence is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No headers, cookies,
credentials, raw Auth/customer rows or sensitive query values were retained in
evidence. The original September 4–7 window remains NOT PROVEN. Day-one evidence
is preserved unchanged; no daily capture or overall acceptance was advanced by
this hourly checkpoint.

Next action: retain hourly supplemental coverage and collect required day two
September 10 **01:18:11Z–05:18:11Z**. Closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed; the separate actual owner
traffic ruling remains pending.
