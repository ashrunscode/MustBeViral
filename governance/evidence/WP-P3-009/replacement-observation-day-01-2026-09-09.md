# Replacement observation — day one / scheduled checkpoint 18

## Capture window and disposition

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T01:29:05.987Z**. Collection ran **01:29:25Z–01:43:14Z**, within
the required day-one window **01:18:11Z–05:18:11Z**. Collection HEAD was
`31869778ae47e5080fc9002d485708911387aee5`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0,
preflight and all 69 external graph input hashes were verified before capture.
The active step remains `WP-P3-009 / p3i-003-private-72-hour-observation`.

**Day-one capture passed under the supported recovery procedure.** The existing
owner browser recovered; both supported permission denials rendered, browser
HTTP 403 responses were observed and matching paths were corroborated in retained
Vercel records. All 27 tenant/money/machine tables remained zero after the probes.
Available database, deployment, gates, storage and DNS evidence showed no
unauthorized drift. Telemetry coverage limits below remain explicit.

This is one required daily capture, not completed 72-hour acceptance. The
replacement anchor remains September 8 **03:18:11Z**; earliest closing capture is
September 11 **03:18:11Z**. The original September 4–7 window remains NOT PROVEN.
Day two, closing, the separate owner traffic ruling and overall acceptance remain
pending. No successor was activated.

## S1 auth

The exact execution-spec S1–S7 queries ran sequentially through the restored
project-scoped Supabase connector against only `jjgtlfblsfobdhmtngbz`. Every
query returned tool success; the connector exposes no HTTP status. S1 also
captured database time. No Management API fallback or permission change was used.

S1 client bounds **01:31:47Z–01:31:52Z**, database time
**01:31:49.941290Z**: 1 user, 1 session, 13 refresh-token rows, 0 flow-state rows,
1 identity and 1 non-null password field. Sign-in remained September 4
21:19:38.051408Z; session creation remained 21:19:38.052003Z. Latest session
touch was September 9 **01:30:32.290930Z**.

TokenAggregate at **01:32:00Z–01:32:01Z**, database time 01:32:01.654063Z,
returned **13 total, 12 revoked, 1 active and 1 distinct session**. Relative to
checkpoint 17, the one additional revoked historical token and updated touch
are consistent with the retained session refreshing when Chrome returned. The
active token/session counts and original sign-in did not change. Password-reset
completion is not inferred from the non-null password field.

After the first two browser probes, S1 at **01:36:20Z–01:36:22Z**, database time
**01:36:22.894494Z**, returned the same counts and timestamps. TokenAggregate at
**01:36:22Z–01:36:23Z**, database time **01:36:24.087383Z**, again returned
13 total, 12 revoked, 1 active and 1 distinct session. Client bounds have
whole-second precision; database timestamps use the separate database clock and
can lie fractionally beyond those client clock bounds.

## S2 zero rows (27)

S2 at **01:31:52Z–01:31:53Z** returned zero for every table below. The same
enumeration was zero at **01:36:19Z–01:36:20Z** after the initial canvas and
quote denials, and at **01:41:52Z–01:41:54Z** after the quote retry.

| Table                      | Rows in each read |
| -------------------------- | ----------------: |
| api_keys                   |                 0 |
| artifact_lineage           |                 0 |
| artifacts                  |                 0 |
| attempts                   |                 0 |
| audit_events               |                 0 |
| brand_kits                 |                 0 |
| briefs                     |                 0 |
| canvas_revisions           |                 0 |
| canvases                   |                 0 |
| cost_reservations          |                 0 |
| idempotency_records        |                 0 |
| ledger_transactions        |                 0 |
| oauth_access_tokens        |                 0 |
| oauth_clients              |                 0 |
| outbox_events              |                 0 |
| projects                   |                 0 |
| provider_jobs              |                 0 |
| provider_webhook_events    |                 0 |
| quotes                     |                 0 |
| run_nodes                  |                 0 |
| runs                       |                 0 |
| skill_versions             |                 0 |
| skills                     |                 0 |
| stripe_webhook_events      |                 0 |
| workspace_billing_profiles |                 0 |
| workspace_memberships      |                 0 |
| workspaces                 |                 0 |

## S3 catalogs (4)

At **01:31:53Z–01:31:54Z**: provider_registrations 4;
price_catalog_versions 2; model_routes 5; model_route_prices 8. No count drift.

## S4 kill switches

At **01:31:54Z–01:31:56Z**, exact
`select public.get_platform_kill_switches() as kill_switches;` succeeded:

| Field                   | Value                            |
| ----------------------- | -------------------------------- |
| signups_enabled         | false                            |
| charging_enabled        | false                            |
| generation_enabled      | false                            |
| provider_routes_enabled | false                            |
| updated_at              | 2026-09-02T15:47:59.474991+00:00 |

The timestamp is the unchanged production baseline. Earlier Management API
`read_only=true` getter denials remain historical evidence; this successful
connector read neither changes permissions nor retroactively repairs older gaps.

## Config gates

Auth projection at **01:31:13.8346694Z** returned `disable_signup=true` and
`mailer_autoconfirm=false`. The deployed Worker projection at
**01:31:30.6161594Z** returned `PROVIDER_RUNS_ENABLED=false` and
`QUEUES_ENABLED=false`. Anonymous protected-alias access still received HTTP 302
to `vercel.com` at **01:31:12.6349423Z**, consistent with the retained SSO
challenge. Only the redirect hostname was retained.

## S5 RLS structure

At **01:31:56Z–01:31:57Z**: 31 public tables; 0 RLS-disabled; 0 not forced;
2 with no policies. The unchanged zero-policy count is not a new permissions grant.

## S6 migration head

At **01:31:57Z–01:31:58Z**: newest versions `20260902154759`,
`20260902000000`, `20260831140000`, unchanged.

## S7 anonymous grants

At **01:31:58Z–01:32:00Z**: 0 anonymous public-table grants.

## Core health

At **01:31:12.1120825Z**: HTTP 200; service `mustbeviral-core`; generation
`viralgraph-cleanroom-v2`; status `ok`; request
`092845ea-8eba-4ddc-9e7e-e1fe275dac3e`; client elapsed 932 ms.

## Containment probes and retained browser

The unsigned zero-UUID artifact-content request at **01:31:12.4756435Z** returned
HTTP **401 UNAUTHENTICATED**, request
`07b8d3c7-1454-493c-bc25-5bfa588031b0`, client elapsed 211 ms. The anonymous
alias challenge above took 154 ms. These client times are not Worker p95, SLO
or capacity measurements.

Connected Chrome returned as provider 4 with the existing owner session. Initial
tab creation reported a navigation timeout after about 13.8 seconds, but a later
tab listing showed Studio Continue loaded; selecting that tab succeeded.
No new sign-in or credential extraction was needed. This resolves the browser
attention request recorded in checkpoint 16; it does not repair earlier captures.

The existing owner tab rendered the supported recovery URLs on
`mustbeviral-web-production-ashrunscode-projects.vercel.app`:

- Canvas, verified by **01:33:36.092Z**: “Canvas unavailable You do not have
  access to this canvas.”
- Quote, verified by **01:34:18.552Z**: “Quote unavailable You do not have
  permission to quote this canvas.”
- A single normal quote-page navigation retry, verified at **01:41:26.518Z**,
  rendered the same quote denial. It was used while server corroboration was
  incomplete; the subsequent S2 read remained entirely zero.

During **01:33:04.232Z–01:34:18.928Z**, browser network capture observed 76
responses: **74 HTTP 200 and 2 HTTP 403**. Both 403 paths were:

```text
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000
/api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes
```

There were **32 RSC responses and 0 observed RSC 503s**. Three loading failures
were canceled `net::ERR_ABORTED` events. The returned event page contained 79
events, `hasMore=false`, `truncated=false`, baseline cursor 25 and final cursor 483. These counts describe the bounded initial capture; the later quote retry
and return navigation were outside that capture.

`Network.disable` was explicitly acknowledged at **01:34:37.157Z**. The tab
returned to a successfully rendered Continue page, and handoff was acknowledged
at **01:35:17.791Z**. After the retry it again rendered Continue and handoff was
acknowledged at **01:41:34.490Z**. Its remembered “Quote and confirmation” step
is browser-local navigation state, not a saved database project or quote. The
existing owner session remains retained for the later required captures.

The implemented permission denials follow
`observation-recovery-procedure-2026-09-08.md`. They prove containment before
tenant/quote execution; they do not claim successful authorized canvas access,
an empty successful MCP context, or direct execution of a generation-policy
refusal branch. No fixture or run was created.

## R2

For `mustbeviral-v2-production-media`, information completed at
**01:31:25.8281820Z**: **0 objects, 0 B**. Public-access read completed at
**01:31:33.0438714Z**: r2.dev disabled. Custom-domain read completed at
**01:31:38.1569068Z**: none. Pinned Wrangler 4.110.0 completed with exit 0.

## Worker

For `mustbeviral-v2-production-core`, deployment read completed at
**01:31:22.8045674Z**: `ee26c70e-9be5-4406-a5af-ceec2897f42a`, created
September 2 16:36:09.785687Z, version
`b832cca9-3dea-46d2-8313-eba80854c1ca` at 100%. Version/gates and secret-name
projection completed at **01:31:30.6161594Z**. Four secret names only:
`ARTIFACT_ACCESS_SIGNING_KEY`, `CONFIRMATION_SIGNING_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.

History at **01:31:37.6895432Z** contained 8 versions, including containment
`45077c66-f31e-4c30-8396-9300b8e27fe0`. No observed version/name drift.
Pinned Wrangler completed with exit 0. No secret values were retained.

## Vercel

Exact target: project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, production. REST metadata at
**01:36:14.3318114Z** confirmed READY, null separate state field, and unchanged
aliases `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. Deployment listing
at **01:36:14.5489785Z** found none since September 8 03:18:11Z; pagination
count 0 and next null.

Connector reads within **01:36:12Z–01:36:19Z** selected the anchor through
September 9 **01:36:12Z**. Runtime-error clusters: **none returned** for that
range. Status histogram: **HTTP 200: 423; HTTP 403: 19**. The response explicitly
reported **3 distinct values, only 2 shown**, despite limit 100. The omitted
status and count remain UNKNOWN; this is partial coverage, not an exhaustive
zero-error/edge-availability assertion.

The initial checkpoint-scoped HTTP 403 grouped query and bounded retries returned
only the canvas path (count 1). A pinned Vercel CLI 55.0.0 status-filtered query
at **01:40:59.1133483Z–01:41:03.4455931Z**, selecting **01:29:25Z–01:40:59.1083140Z**,
also returned that single canvas record, exit 0. A quote-text-filtered connector
query returned no rows. These results did not by themselves corroborate the quote.

A separate **unfiltered** CLI read at **01:42:46.0912196Z–01:42:50.8533339Z**,
selecting **01:29:25Z–01:42:46.0873011Z** for the same exact deployment,
returned 100 records, 50 unique IDs, exit 0. After deduplicating by ID and using
`responseStatusCode`, **two retained HTTP 403 info records had the exact quote
path above**. The remaining 48 unique records were HTTP 200 Studio pages. This
corroborates the initial quote and its one retry. Together with the fresh canvas
record it satisfies both server-path checks. The sample reached its limit;
absence from either filtered result is not equated to zero requests, and no
unverified explanation for the filtering discrepancy is asserted.

The successful renders, zero observed RSC 503s and empty returned runtime-error
clusters satisfy the supported capture threshold. They do not prove that every
edge request or intervening database state was observed.

## DNS

At **01:31:14.2063253Z**, `api.mustbeviral.com` returned NXDOMAIN (status 3).
At **01:31:14.3663920Z** and **01:31:14.4674658Z**, `www.mustbeviral.com` and
the apex returned A answers 104.21.6.198 and 172.67.135.59. No observed drift.
Hidden proxied CNAME configuration is not inferred.

## Deviations, verification and not done

Collection took less than 30 minutes. The browser navigation retry, retained
session refresh, server-log filtering discrepancy and truncated runtime coverage
are recorded above. The sequential S1–S7 reads followed the supported recovery
procedure; independent provider reads have their actual timestamps recorded.
Earlier partial checkpoints and the original unproven window remain unchanged.

Pinned preflight, same-next-action handoff, formatting and governance checks
passed. Governance validated 37 registered documents, the active packet, 15
transition receipts, the cleanroom scan, current generated OpenAPI and 8 generated
documentation files. The three S2 reads, active-token/session counts and disabled
switches also passed a structured aggregate cross-check. The packet and project
state remain byte-identical after handoff and formatting; daily progress is
recorded here and in the external observation tracker without advancing the
packet. No full build was repeated for this unchanged-code checkpoint.

Publication remains held under the CI cost rules: existing branch push workflows
lack Markdown path filters, and workflow paths are outside this step. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`; its prior CI results
were not reread. No push, workflow dispatch, workflow edit or weakened check was
performed. CI for the unpublished evidence commit is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No headers, cookies,
credentials, query values or raw Auth/customer records were saved. Closing
sign-out is deferred to the required closing capture.

Next action: collect day two September 10 **01:18:11Z–05:18:11Z**, retaining the
owner session and hourly supplemental coverage. Closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed; the actual owner traffic
ruling remains a separate pending requirement.
