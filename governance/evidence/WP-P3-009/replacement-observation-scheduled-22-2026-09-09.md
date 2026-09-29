# Replacement observation — twenty-second scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T05:39:38.993Z**. Collection ran **05:40:37Z–05:41:52Z**, at HEAD
`b215c27b213c5e8a7ac271d45c8fab2d294015ab`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0,
preflight and all 69 external graph input hashes passed. Previously read
authority documents remained unchanged. Current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`.

**Partial supplemental checkpoint:** available database, endpoint, Auth, Worker,
R2, deployment and DNS reads showed no unauthorized drift. Chrome remained
unavailable, so fresh owner-browser probes and RSC counts are UNKNOWN. All
provider CLI sequences completed with exit 0 on their first attempts this turn.

The day-one window has closed with its required capture already passed in
`replacement-observation-day-01-2026-09-09.md`. This optional checkpoint preserves
that evidence. Day two, closing, whole-window acceptance and the separate actual
owner traffic ruling remain pending; no acceptance or successor was advanced.

## Database evidence

The approved S1–S7 SELECTs ran sequentially through the project-scoped Supabase
connector against only `jjgtlfblsfobdhmtngbz`. Every call returned tool success;
the connector exposes no HTTP status. S1 additionally captured database time.

| Check          | Client UTC bounds | Result                                                                                                                             |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 05:41:01–05:41:02 | 1 user; 1 session; 15 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 05:41:04.508482Z |
| S2             | 05:41:02–05:41:04 | All 27 tenant/money/machine table counts zero                                                                                      |
| S3             | 05:41:04–05:41:05 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4             | 05:41:05–05:41:06 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00                                       |
| S5             | 05:41:06–05:41:07 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6             | 05:41:07–05:41:08 | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7             | 05:41:08–05:41:10 | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate | 05:41:10–05:41:11 | 15 total; 14 revoked; 1 active; 1 distinct session; database time 05:41:12.977794Z                                                 |

S4 was exactly `select public.get_platform_kill_switches() as kill_switches;`.
Its false fields were signups_enabled, charging_enabled, generation_enabled and
provider_routes_enabled. No fallback or permission change was used. Earlier
Management API getter denials remain historical evidence.

Sign-in remained September 4 **21:19:38.051408Z**, session creation remained
**21:19:38.052003Z**, and latest touch remained September 9
**03:33:31.159993Z**. All counts match checkpoint 21. Historical revoked tokens
are not additional active sessions; password-reset completion is not inferred.
The complete S2 table enumeration remains in the day-one report. No post-denial
read is claimed, because no browser denial ran in this checkpoint.

Client bounds have whole-second precision and database timestamps use a separate
clock. Snapshot counts do not prove intervening database contents or current
browser usability.

## Endpoints, Auth and DNS

| UTC completion   | Check                               | Result                                                                                                                      |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 05:41:12.2704520 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request 4fd103c3-eadf-47cc-9e90-e292cccbc33e; client 474 ms |
| 05:41:12.4592836 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request a0d749ee-e939-4425-964a-163381a94a05; client 35 ms                                        |
| 05:41:12.6357191 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 166 ms                                                               |
| 05:41:13.4680101 | Auth projection                     | disable_signup=true; mailer_autoconfirm=false                                                                               |
| 05:41:13.6093719 | api.mustbeviral.com A               | NXDOMAIN, status 3                                                                                                          |
| 05:41:13.6804556 | www.mustbeviral.com A               | 104.21.6.198 and 172.67.135.59                                                                                              |
| 05:41:13.7449976 | mustbeviral.com A                   | 104.21.6.198 and 172.67.135.59                                                                                              |

Client elapsed times are not Worker p95, SLO or capacity measurements. Hidden
proxied CNAME configuration is not inferred from these A answers.

## Browser coverage

Both the initial and later browser inventories exposed only the Codex in-app
browser. The existing owner Chrome provider remained unavailable. No substitute
session or in-app browser was used. No supported canvas/quote navigation, fresh
render, browser network capture, Network.enable, new login or fresh handoff ran.
Fresh denial statuses and RSC-503 counts remain UNKNOWN, not zero. Prior browser
captures remain historical evidence. No closing sign-out was attempted.

Required day one and its resolved browser-attention request remain unchanged.
There is no new immediate owner action for this optional checkpoint; browser
availability will be retried before day two.

## Worker and R2

Existing machine credentials were loaded into the read-command processes and
scoped to the configured Cloudflare account and exact production resources.
Pinned Wrangler 4.110.0 completed all commands with checked native exit codes;
both sequences ended with exit 0. R2 used the command-local
`WRANGLER_SEND_METRICS=false` option already verified in the pinned CLI during
checkpoint 21. No repository or production configuration changed, and no command
interruption or authentication recovery was needed this checkpoint.

| UTC completion   | Check             | Result                                                                                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 05:41:16.7125189 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 05:41:21.7372605 | Worker gates      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 05:41:21.7372605 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 05:41:27.4331086 | Worker history    | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 05:41:16.4836411 | R2 information    | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 05:41:21.2477356 | R2 public access  | r2.dev disabled                                                                                                                  |
| 05:41:26.9153020 | R2 custom domains | None                                                                                                                             |

Worker target was `mustbeviral-v2-production-core`. No observed deployment,
version, gate, secret-name or storage drift. No secret values were retained.

## Vercel evidence

Exact target: project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, production. REST at
**05:41:12.4797859Z** confirmed READY, null separate state field and unchanged
aliases `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. Listing at
**05:41:12.6404922Z** found no deployments since September 8 03:18:11Z;
pagination count 0 and next null.

Connector telemetry selected the anchor through September 9 **05:41:21Z**.
No runtime-error clusters were returned. Histogram: **HTTP 200: 523; HTTP 403:
26**, explicitly **3 distinct values but only 2 shown**, despite limit 100.
The omitted status/count remain UNKNOWN. These historical aggregate records do
not replace missing fresh browser probes, and do not establish exhaustive
runtime or edge coverage.

## Verification and disposition

Preflight, the same-next-action handoff, formatting and `pnpm governance:check`
passed. Documentation authority, active packet, transition receipts, cleanroom
scan, generated OpenAPI and all eight generated documentation files were valid.
After handoff and formatting, both authority YAML files remained byte-identical
to HEAD. No full build was repeated for this unchanged-code supplemental checkpoint.

Publication remains held under the CI cost rules: existing push workflows lack
Markdown path filters and workflow paths are outside the active step. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`; prior CI results were
not reread. No push, workflow dispatch, workflow edit or weakened check occurred.
CI for unpublished evidence is not run.

No deployment, DNS, sending, signup, customer/provider activity, payment,
permission or production configuration mutation occurred. No credentials, headers,
cookies, raw Auth/customer rows or sensitive query values were saved in evidence.
The original September 4–7 window remains NOT PROVEN. Required day-one evidence
and all remaining clock/owner requirements are unchanged. No successor was activated.

Next action: retry owner-browser availability during supplemental coverage and
collect required day two September 10 **01:18:11Z–05:18:11Z**. Closing remains
September 11 **03:18:11Z–05:18:11Z**, never before 72 hours elapsed; the separate
actual owner traffic ruling remains pending.
