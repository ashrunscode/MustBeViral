# Replacement observation — thirty-second scheduled checkpoint

Trigger **2026-09-09T16:37:39.395Z**; collection **16:38:35Z–16:50:07Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, starting HEAD
`b4d49008649bd897be4755dfe047f02b5076f69c`, one clean worktree, 20 local evidence
commits ahead of published HEAD. Node 24.18.0 / pnpm 11.12.0 matched.
Preflight passed for `WP-P3-009 / p3i-003-private-72-hour-observation`;
all 69 external graph input hashes matched. Previously read authority and
observation procedures remained unchanged.

**Supported supplemental checks verified after browser recovery.** Both
permitted canvas and quote denials rendered and were corroborated by fresh
HTTP 403 records. Tenant/money counts, provider gates and private storage
remained contained. The existing API-key/Skills HTTP 400 finding remains
unresolved; the refreshed projection includes one additional historical record,
with no extension of the previously reported timestamp range.

Day one remains passed by `replacement-observation-day-01-2026-09-09.md`.
Day two, closing, whole-window acceptance and the separate actual owner traffic
ruling remain pending. This supplemental capture does not advance acceptance
or a successor.

## Database

Approved S1–S7 SELECTs ran sequentially through the connector explicitly
targeting Supabase `jjgtlfblsfobdhmtngbz`. All returned tool success; HTTP
status is not exposed. Client and database timestamps are separate clocks.

| Check           | Client UTC bounds | Result                                                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1              | 16:41:07–16:41:09 | User 1; session 1; refresh tokens 16; flow state 0; identity 1; non-null password field 1. Database time 16:41:08.903134Z. |
| S2              | 16:41:09–16:41:10 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3              | 16:41:10–16:41:11 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4              | 16:41:11–16:41:12 | Exact getter succeeded; four switches false; updated_at 2026-09-02T15:47:59.474991+00:00.                                  |
| S5              | 16:41:12–16:41:13 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6              | 16:41:13–16:41:14 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7              | 16:41:14–16:41:16 | Anonymous public-table grants 0.                                                                                           |
| Token aggregate | 16:41:16–16:41:17 | Total 16; revoked 15; active 1; distinct sessions 1. Database time 16:41:17.323002Z.                                       |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
False fields: signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change.

Sign-in remained September 4 **21:19:38.051408Z** and session creation
**21:19:38.052003Z**. Initial latest touch was September 9
**15:19:42.525051Z**. After the browser probes:

- S2, client **16:49:45.370Z–16:49:47.151Z**: all 27 tables still zero.
- S1, client **16:49:47.151Z–16:49:48.801Z**, database time
  **16:49:48.925406Z**: user/session/identity/password/flow counts unchanged;
  refresh tokens 17; latest session touch **16:42:07.15219Z**.
- Token aggregate, client **16:49:48.801Z–16:49:50.190Z**, database time
  **16:49:50.339595Z**: **17 total / 16 revoked / 1 active / 1 distinct session**.

One additional revoked historical token with one active token and the original
session is consistent with normal rotation. No additional active session or
password-reset completion is inferred. Database times slightly exceed client
completion times in the last two reads; these clocks are not treated as one
precise timeline. The full S2 enumeration is in day-one evidence. Snapshots
do not establish intervening contents.

## Browser recovery and supported denials

The retained owner browser was Chrome profile E, browser 2, existing Studio
tab **1193312250**, initially on Continue. The prior binding's AX read and
the first tab rebind each timed out and reset the browser kernel. Fresh
inventory and a claim of the exact existing tab restored the Continue view.

Network.enable was first acknowledged **16:41:54.876Z**, cursor 8.
The canvas navigation timed out waiting for CDP Page.navigate; the next
snapshot timed out waiting for Runtime.enable. The first cleanup call's
result was unavailable after tool-output truncation, so it is not claimed as
an acknowledgement. A later idempotent Network.disable succeeded at
**16:47:37.779Z**, and the completed canvas denial was visible.

A fresh capture began with acknowledged Network.enable at
**16:47:49.273Z**, cursor 123. Earlier capture events were excluded.
An intentional canvas reload initially showed Loading, then completed as
**Canvas unavailable — You do not have access to this canvas.**
The supported quote URL then completed as **Quote unavailable — You do not
have permission to quote this canvas.**

| Supported Core proxy path                                         | Fresh retained server time | Result                                            |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 16:47:59.868Z              | HTTP 403; final rendered permission denial.       |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 16:48:13.338Z              | HTTP 403; final rendered quote permission denial. |

The fresh event read returned 87 events through cursor 547, with
`hasMore=false` and `truncated=true`. It contained **76 observed responses:
73 HTTP 200, two HTTP 403 and one HTTP 404**. The 404 path was
`/favicon.ico`. **32 observed responses were RSC; zero observed RSC
responses were HTTP 503**. Eleven loading failures were canceled
`net::ERR_ABORTED`. Truncation means these are partial observations; neither
missing events nor earlier stalled requests are assumed successful.

Network.disable was acknowledged **16:48:44.188Z**. Continue rendered with the
saved Quote and confirmation step, and handoff was acknowledged
**16:49:13.760Z**. No new tab, login, fixture, form save, provider run or closing
sign-out occurred. Supported denials prove containment; they do not establish
authorized canvas access or execution of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 16:47:23.6056212 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 1489410e-15d2-4929-b846-519cfb796b7b; client 740 ms. |
| 16:47:23.8928112 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request a7dab488-82d2-4ed2-95dd-3564aa690ee3; client 159 ms.                                |
| 16:47:24.0267770 | Anonymous protected alias   | HTTP 302 to vercel.com; client 128 ms; redirect query omitted.                                                        |
| 16:47:24.9102712 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 16:47:25.0367527 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 16:47:25.1356420 | www.mustbeviral.com A       | 104.21.6.198 and 172.67.135.59.                                                                                       |
| 16:47:25.2279453 | mustbeviral.com A           | 104.21.6.198 and 172.67.135.59.                                                                                       |

Client durations do not measure Worker p95, SLO or capacity. Hidden proxied
CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All provider commands completed on their first attempts with checked native
exit 0. R2 used the existing command-local `WRANGLER_SEND_METRICS=false`;
no provider recovery or configuration change.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 16:47:34.4226745 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 16:47:39.4975947 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 16:47:39.4975947 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 16:47:44.5021810 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 16:47:34.3565495 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 16:47:39.0193971 | R2 public access  | r2.dev disabled.                                                                                                          |
| 16:47:43.6712046 | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, version, gate, secret-name
or storage drift observed. No secret values retained.

## Vercel and preserved HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST completed
**16:47:23.3062329Z**: READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **16:47:23.4786952Z** found no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**16:48:56.495Z**. No runtime-error clusters were returned.
Histogram: **HTTP 200: 678; HTTP 403: 30; HTTP 400: 9**; four distinct values,
three shown despite limit 100. The omitted category/count remain UNKNOWN;
the observed favicon 404 does not prove it is that omitted category.

Pinned Vercel CLI 55.0.0 unfiltered logs, client
**16:49:34.9754566Z–16:49:41.3345928Z**, selected
**16:38:35Z–16:49:34.9703034Z** and returned **100 records / 50 unique IDs**,
hitting limit 100. Raw counts were 96 HTTP 200 and four HTTP 403. Both exact
fresh denial records above appeared twice with identical timestamps.
Duplicates are not extra requests; this capped read is not exhaustive.

The connector's HTTP 400 grouping now returned five API-key-path and four
Skills-path records. A separate pinned CLI 400 projection completed
**16:49:48.3507816Z**, selecting anchor through **16:49:35.6922113Z**:
**nine records / nine unique IDs**, all level info, below limit 100.
Five were `/api/core/v1/workspaces/campaign/api-keys`, four were
`/api/core/v1/workspaces/campaign/skills`. The timestamp range remains
**15:22:40.937Z–15:26:50.050Z**, entirely before checkpoint 31's trigger.
The added record is historical, not a demonstrated new incident during this
checkpoint. The reason the earlier projection returned eight remains unproven.

The checkpoint-31 finding and its notification remain preserved. Prior source
inspection established generic HTTP 400 catches and an IdentifierSchema that
accepts non-empty strings; UUID validation is not an established cause.
No new implementation inspection, navigation to those paths or repair occurred.
Precise response causes remain unresolved. No raw messages, response bodies,
request headers or owner data were retained.

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
headers, cookies, raw Auth/customer rows or sensitive query values were saved
in evidence. The original September 4–7 window remains NOT PROVEN.
Day-one evidence, overall pending acceptance and the separate owner traffic
ruling are unchanged; no successor was activated.

Next action: preserve the HTTP 400 finding while collecting required day two
September 10 **01:18:11Z–05:18:11Z**; closing remains September 11
**03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
