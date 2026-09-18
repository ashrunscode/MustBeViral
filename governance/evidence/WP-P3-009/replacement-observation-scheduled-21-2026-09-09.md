# Replacement observation — twenty-first scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T04:39:08.082Z**. Collection began **04:39:58Z** and completed after
the final R2 read at **04:48:20.2741260Z**, at HEAD
`ab06e0534ec16842694331ce4cae734dbc060be0`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0,
preflight and all 69 external graph input hashes passed. Previously read
authority documents remained unchanged. Current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`.

**Partial supplemental checkpoint:** database, endpoint, Auth, Worker, R2,
deployment and DNS reads showed no unauthorized drift. The owner Chrome provider
was unavailable, so fresh browser denials, RSC counts and handoff are UNKNOWN.
The R2 sequence completed on retry after the original CLI process stalled.
These collection limitations do not establish a production incident.

Required day one remains passed by
`replacement-observation-day-01-2026-09-09.md`; its evidence is unchanged.
This optional hourly checkpoint does not pass another daily capture or invalidate
the earlier required capture. Day two, closing, whole-window acceptance and the
separate actual owner traffic ruling remain pending.

## Database evidence

Transient tool-session bindings and stored command helpers were no longer
available. The seven approved SELECTs were recovered from the unchanged external
WP-P3-009 execution spec, whose graph input hash matched before capture. No SQL
was sent by the failed helper lookup. S1–S7 then ran sequentially through the
project-scoped Supabase connector against only `jjgtlfblsfobdhmtngbz`.
Every call returned tool success; that connector exposes no HTTP status. S1 also
captured database time.

| Check          | Client UTC bounds | Result                                                                                                                             |
| -------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 04:41:36–04:41:38 | 1 user; 1 session; 15 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 04:41:39.647970Z |
| S2             | 04:41:38–04:41:40 | All 27 tenant/money/machine table counts zero                                                                                      |
| S3             | 04:41:40–04:41:48 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4             | 04:41:48–04:41:50 | Exact getter succeeded; all four switches false; updated_at 2026-09-02T15:47:59.474991+00:00                                       |
| S5             | 04:41:50–04:41:51 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6             | 04:41:51–04:41:52 | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7             | 04:41:52–04:41:54 | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate | 04:41:54–04:41:55 | 15 total; 14 revoked; 1 active; 1 distinct session; database time 04:41:57.378068Z                                                 |

Exact S4 was `select public.get_platform_kill_switches() as kill_switches;`.
Its four false fields were signups_enabled, charging_enabled, generation_enabled
and provider_routes_enabled. No Management API fallback or permission change was
used. Earlier Management API getter denials remain historical evidence.

Consistency reads later returned unchanged results: S2 at
**04:44:21Z–04:44:22Z** was zero in all 27 tables; S1 at
**04:44:22Z–04:44:24Z**, database time **04:44:25.595917Z**, had the same Auth
counts; TokenAggregate at **04:44:24Z–04:44:26Z**, database time
**04:44:27.111041Z**, remained **15 total, 14 revoked, 1 active, 1 distinct
session**. These were consistency reads, not post-denial checks, because no
browser denial ran in this checkpoint. The complete S2 enumeration remains in
the day-one report.

Sign-in remained September 4 **21:19:38.051408Z**, session creation remained
**21:19:38.052003Z**, and latest touch remained September 9
**03:33:31.159993Z**. Historical revoked tokens are not additional active sessions.
Password-reset completion and intervening database state are not inferred.
Client bounds have whole-second precision and database timestamps use the
separate database clock.

## Endpoints, Auth and DNS

| UTC completion   | Check                               | Result                                                                                                                      |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 04:43:20.7767088 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request a2225d5c-fccf-41e7-9fb2-8ce4d6c47783; client 919 ms |
| 04:43:21.0376354 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request 354fd5ba-26bb-4b0b-b4ce-ec84ed62dfe5; client 168 ms                                       |
| 04:43:22.2784009 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 1234 ms                                                              |
| 04:43:31.0517572 | Auth projection                     | disable_signup=true; mailer_autoconfirm=false                                                                               |
| 04:43:31.9165969 | api.mustbeviral.com A               | NXDOMAIN, status 3                                                                                                          |
| 04:43:32.8569475 | www.mustbeviral.com A               | 172.67.135.59 and 104.21.6.198                                                                                              |
| 04:43:40.4421712 | mustbeviral.com A                   | 172.67.135.59 and 104.21.6.198                                                                                              |

Client times are not Worker p95, SLO or capacity measurements. Hidden proxied
CNAME configuration is not inferred from A answers.

## Browser coverage

The previous JavaScript browser binding was absent after tool-session
reinitialization. A fresh lookup of the retained tab through the previously known
Chrome provider ID reported that provider unavailable. Both the initial and later
browser inventories exposed only the Codex in-app browser; Chrome was absent.
The in-app browser was not substituted for the owner session.

No supported canvas/quote navigation, fresh render, browser network capture,
Network.enable, new sign-in, credential extraction or fresh handoff occurred.
Fresh denial statuses and RSC-503 counts therefore remain UNKNOWN, not zero.
Prior browser evidence is historical and is not presented as this checkpoint's
coverage. The database still shows the original live session, but it does not
prove current browser usability. No closing sign-out was attempted.

The day-one capture and the checkpoint-16 attention request's day-one resolution
remain recorded. This optional checkpoint creates no immediate owner action;
browser availability will be retried before the next required capture.

## Worker and R2

Existing machine credentials were loaded into the read-command processes, scoped
to the configured Cloudflare account and exact production resources. Pinned
Wrangler was 4.110.0. Native exit statuses were checked. Worker reads completed
with exit 0:

| UTC completion   | Check             | Result                                                                                                                           |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 04:43:53.6770074 | Worker deployment | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 04:44:00.4939887 | Worker gates      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 04:44:00.4939887 | Secret names only | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 04:44:07.4837476 | Worker history    | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |

Worker target was `mustbeviral-v2-production-core`. No observed version,
deployment, gate or secret-name drift; no secret values were retained.

The original R2 sequence printed **0 objects, 0 B** for
`mustbeviral-v2-production-media` but did not complete its first CLI command after
several minutes. That owned shell session was interrupted and exited 1; it is
not counted as a completed sequence. A retry loaded the same existing credentials
and used command-local `WRANGLER_SEND_METRICS=false`, a boolean option verified in
the installed pinned CLI. No repository or production setting was changed.
The delay's cause is unproven; success does not establish that CLI metrics caused it.

The retry ultimately completed every command with exit 0:

| UTC completion   | R2 check       | Result                                          |
| ---------------- | -------------- | ----------------------------------------------- |
| 04:48:10.8096624 | Information    | mustbeviral-v2-production-media; 0 objects; 0 B |
| 04:48:15.0115004 | Public access  | r2.dev disabled                                 |
| 04:48:20.2741260 | Custom domains | None                                            |

While the retry's first command was still completing, bounded independent privacy
reads also completed with exit 0: public access disabled at
**04:48:18.2020581Z** and no custom domains at **04:48:18.5677916Z**. These were
duplicate read-only corroboration, not configuration changes. No read session
was left running. Collection remained under 30 minutes.

## Vercel evidence

Exact target: project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, production. REST at
**04:43:21.5812423Z** confirmed READY, null separate state field and unchanged
aliases `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. Listing at
**04:43:24.0190156Z** found no deployments since September 8 03:18:11Z;
pagination count 0 and next null.

Connector telemetry selected the anchor through September 9 **04:43:30Z**.
No runtime-error clusters were returned. Histogram: **HTTP 200: 523; HTTP 403:
26**, explicitly **3 distinct values but only 2 shown**, despite limit 100.
The omitted status/count remain UNKNOWN. These aggregate historical records do
not corroborate fresh browser denials in this checkpoint. No exhaustive runtime,
edge or browser-availability claim is made.

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
The original September 4–7 window remains NOT PROVEN. Required day-one evidence
and the remaining clock/owner requirements are unchanged. No successor was activated.

Next action: retry owner-browser availability during supplemental coverage and
collect required day two September 10 **01:18:11Z–05:18:11Z**. Closing remains
September 11 **03:18:11Z–05:18:11Z**, never before 72 hours elapsed; the separate
actual owner traffic ruling remains pending.
