# Replacement observation — thirty-first scheduled checkpoint

Trigger **2026-09-09T15:36:07.959Z**; collection **15:36:55Z–15:46:54Z** on September 9.
Checkout `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, HEAD
`852497e4f6b288da49ceb445884fb0dd4806fa3f`, one clean worktree.
Node 24.18.0 / pnpm 11.12.0 matched. Preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`; all 69 external graph
input hashes matched. Previously read authority and observation procedures
remained unchanged.

**Supported supplemental checks verified:** the owner browser became available
again; both permitted canvas and quote denials rendered and were corroborated
by fresh HTTP 403 records. Provider gates, private storage and tenant/money counts
remained contained. A separate newly visible HTTP 400 finding on API-key and
Skills paths is recorded below for follow-up; its cause is unproven.

Day one remains passed by `replacement-observation-day-01-2026-09-09.md`.
Day two, closing, whole-window acceptance and the separate actual owner traffic
ruling remain pending. This capture does not advance acceptance or a successor.

## Database

Approved S1–S7 SELECTs ran sequentially through the connector explicitly targeting
Supabase `jjgtlfblsfobdhmtngbz`. All returned tool success; the connector
does not expose HTTP status. Bounds are client UTC whole seconds; database
timestamps use a separate clock.

| Check           | Client UTC bounds | Result                                                                                                                     |
| --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| S1              | 15:37:55–15:38:00 | User 1; session 1; refresh tokens 16; flow state 0; identity 1; non-null password field 1. Database time 15:38:00.913143Z. |
| S2              | 15:38:00–15:38:04 | All 27 tenant/money/machine tables zero.                                                                                   |
| S3              | 15:38:04–15:38:07 | Providers 4; price catalogs 2; model routes 5; route prices 8.                                                             |
| S4              | 15:38:07–15:38:11 | Exact getter succeeded; four switches false; updated_at 2026-09-02T15:47:59.474991+00:00.                                  |
| S5              | 15:38:11–15:38:14 | Public tables 31; RLS-disabled 0; not forced 0; zero-policy tables 2.                                                      |
| S6              | 15:38:14–15:38:17 | 20260902154759; 20260902000000; 20260831140000.                                                                            |
| S7              | 15:38:17–15:38:21 | Anonymous public-table grants 0.                                                                                           |
| Token aggregate | 15:38:21–15:38:24 | Total 16; revoked 15; active 1; distinct sessions 1. Database time 15:38:24.425696Z.                                       |

S4 was `select public.get_platform_kill_switches() as kill_switches;`.
False fields: signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change.

Sign-in remained September 4 **21:19:38.051408Z** and session creation
**21:19:38.052003Z**. Latest touch advanced to September 9
**15:19:42.525051Z**, before this checkpoint, with one additional revoked
historical refresh token. One active token and one original session remain;
this is consistent with normal rotation, not an additional active session.
Password-reset completion is not inferred.

After the quote probe, S2 at **15:41:15Z–15:41:17Z** again found all 27 tables
zero. S1 at **15:41:17Z–15:41:18Z** retained the same counts and timestamps
(database time **15:41:18.546521Z**). Token aggregate at
**15:41:18Z–15:41:19Z** retained **16 total / 15 revoked / 1 active / 1 session**
(database time **15:41:19.779593Z**). The full S2 table enumeration is in the
day-one report. Snapshots do not establish intervening contents.

## Browser recovery and supported denials

Chrome profile E returned as browser 2. The old retained tab ID no longer
existed; a fresh inventory identified the existing Studio tab **1193312250**,
already in the observation group on the blank Brief. It was claimed and showed
Signed in. No new tab, login, fixture, form save or provider run was created.

The first combined network/navigation call timed out and reset the browser
kernel. Reacquiring that same tab showed the completed absent-canvas denial.
The prior network cursor was lost and a recovery read returned no retained
responses; those requests are not included in the fresh counts. The documented
browser recovery and CDP instructions were reloaded.

Fresh Network.enable was acknowledged at **15:39:55.647Z**, cursor 13.
An intentional canvas reload restored measurement after the lost capture.
The loading state completed as **Canvas unavailable — You do not have access
to this canvas.** The supported quote URL then rendered **Quote unavailable —
You do not have permission to quote this canvas.**

| Supported Core proxy path                                         | Fresh retained server time | Result                                            |
| ----------------------------------------------------------------- | -------------------------- | ------------------------------------------------- |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000        | 15:40:04.674Z              | HTTP 403; final rendered permission denial.       |
| /api/core/v1/canvases/00000000-0000-4000-8000-000000000000/quotes | 15:40:27.896Z              | HTTP 403; final rendered quote permission denial. |

The restarted capture contained **75 observed responses: 73 HTTP 200 and 2
HTTP 403**. **32 were RSC responses; 0 observed RSC responses were 503**.
Eleven loading failures were canceled `net::ERR_ABORTED`, not observed HTTP
503s. The first event page was truncated; the second was not, and neither had
more pages. These counts are partial observations and exclude the lost initial
capture.

Network.disable was acknowledged **15:40:42.874Z**. The Continue page rendered
and the same tab was marked for handoff **15:40:49.872Z** for remaining
observation. No closing sign-out occurred. The supported denials establish
containment; they do not establish authorized canvas access or direct execution
of the generation-policy branch.

## Endpoints, Auth and DNS

| UTC completion   | Check                       | Result                                                                                                                |
| ---------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 15:41:26.7912270 | Core health                 | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; ok; request 2ab19a2a-6f4e-424b-8b6f-e00525b90dad; client 683 ms. |
| 15:41:27.0318595 | Unsigned zero-UUID artifact | HTTP 401 UNAUTHENTICATED; request 04e0812a-0f57-4564-bfbc-4492615855f8; client 133 ms.                                |
| 15:41:27.1465311 | Anonymous protected alias   | HTTP 302 to vercel.com; client 104 ms; redirect query omitted.                                                        |
| 15:41:29.4410736 | Auth flags                  | disable_signup=true; mailer_autoconfirm=false.                                                                        |
| 15:41:29.6419057 | api.mustbeviral.com A       | NXDOMAIN, status 3.                                                                                                   |
| 15:41:29.8235247 | www.mustbeviral.com A       | 172.67.135.59 and 104.21.6.198.                                                                                       |
| 15:41:30.0697663 | mustbeviral.com A           | 172.67.135.59 and 104.21.6.198.                                                                                       |

Client durations do not measure Worker p95, SLO or capacity. Hidden proxied
CNAME configuration is not inferred from A answers.

## Worker and R2

Pinned Wrangler 4.110.0 used existing credentials and exact scoped resources.
All provider commands completed on their first attempts with checked native
exit 0. R2 used the previously verified command-local
`WRANGLER_SEND_METRICS=false`; no provider recovery or configuration change.

| UTC completion   | Check             | Result                                                                                                                    |
| ---------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 15:41:34.6445999 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; b832cca9-3dea-46d2-8313-eba80854c1ca at 100%. |
| 15:41:38.1597895 | Deployed gates    | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false.                                                                        |
| 15:41:38.1597895 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY.                     |
| 15:41:41.7004534 | Worker history    | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained.                                                |
| 15:41:34.5192121 | R2 information    | 0 objects; 0 B.                                                                                                           |
| 15:41:37.9249384 | R2 public access  | r2.dev disabled.                                                                                                          |
| 15:41:41.2732241 | R2 domains        | None.                                                                                                                     |

Targets: `mustbeviral-v2-production-core` and
`mustbeviral-v2-production-media`. No deployment, version, gate, secret-name
or storage drift observed. No secret values retained.

## Vercel and additional HTTP 400 finding

Exact project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`. REST at **15:41:28.0137770Z**:
READY, separate state null, unchanged aliases
`mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`.
Listing at **15:41:28.1861254Z** found no deployments since the replacement
anchor; pagination count 0 and next null.

Connector telemetry selected September 8 **03:18:11Z** through September 9
**15:41:48Z**. No runtime-error clusters were returned. Histogram:
**HTTP 200: 627; HTTP 403: 26; HTTP 400: 6**; **four distinct values, three
shown**, despite limit 100. The omitted category/count remain UNKNOWN.
A fresh 403-by-path query for **15:39:55Z–15:41:48Z** returned no rows.

The unfiltered pinned Vercel CLI 55.0.0 read at
**15:43:08.0077117Z–15:43:15.4991652Z**, selecting
**15:38:20Z–15:43:08.0025926Z**, returned **100 records / 50 unique IDs**,
hitting limit 100. Raw counts were 96 HTTP 200 and 4 HTTP 403. Both exact
fresh denial records above appeared twice, with identical timestamps, and
corroborate the browser results. Duplicates are not extra requests and this
capped read is not exhaustive.

The newly visible 400 category was investigated without navigating additional
pages. Connector grouping returned four API-key-path and two Skills-path
records. A separate pinned CLI 400 projection completed
**15:43:52.0026188Z**, selecting anchor through **15:43:45.1525559Z**:
**8 records / 8 unique IDs**, all level info, below limit 100. Five were
`/api/core/v1/workspaces/campaign/api-keys`, three were
`/api/core/v1/workspaces/campaign/skills`. Their timestamps spanned
**15:22:40.937Z–15:26:50.050Z**, before this checkpoint's trigger. The two
projections differ and are preserved separately; no exact cause for that
difference is asserted.

Read-only inspection of `apps/core/src/routes/p1b.ts` showed both handlers
can return HTTP 400 from a generic catch. The shared IdentifierSchema in
`packages/contracts/src/commands.ts` accepts non-empty strings; this is
**not proven to be UUID validation**. No response bodies, raw messages or
owner data were retained. The precise cause and additional navigation behavior
remain a follow-up finding, not a claimed repair or a proven runtime outage.
Required supported denials passed and no tenant/provider/money rows appeared.

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
headers, cookies, raw Auth/customer rows or sensitive query values were saved
in evidence. The original September 4–7 window remains NOT PROVEN.
Day-one evidence, overall pending acceptance and the separate owner traffic
ruling are unchanged; no successor was activated.

Next action: preserve the HTTP 400 finding for follow-up while collecting
required day two September 10 **01:18:11Z–05:18:11Z**; closing remains September
11 **03:18:11Z–05:18:11Z**, never before 72 hours elapsed.
