# Replacement observation — fifteenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T22:25:14.878Z**. Collection ran **22:25:41Z–22:30:00Z**, at HEAD
`62ec7ceda694b76a1d8aef1547559e575f65d5ec`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0 and
preflight passed. The active step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`; required authority is unchanged.

**Partial supplemental checkpoint:** available endpoint, deployment, storage and
database reads showed no observed drift. Browser control remained unavailable;
no fresh rendered denial or RSC capture was verified. The S4 RPC remains denied
to the monitoring call, while a separate authorized projection again verified
all underlying switches false. No required daily acceptance was advanced.

## Sequential database reads

Only Supabase `jjgtlfblsfobdhmtngbz` was queried with the existing credential
through the Management API. Every query retained `read_only=true` and explicit
HTTP status/body handling. The seven execution-spec queries ran in order; S1
additionally captured database time.

| Check                           | Client UTC bounds                 | HTTP | Result                                                                                                                                         |
| ------------------------------- | --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| S1                              | 22:27:09.6900474–22:27:10.9751376 | 201  | 1 user; 1 session; 12 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 22:27:11.296614Z             |
| S2                              | 22:27:10.9922393–22:27:11.7699884 | 201  | All 27 tenant/money/machine tables zero                                                                                                        |
| S3                              | 22:27:11.8041664–22:27:14.1171390 | 201  | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                                  |
| S4                              | 22:27:14.1188130–22:27:14.7993856 | 400  | SQLSTATE 42501; permission denied for get_platform_kill_switches                                                                               |
| S5                              | 22:27:14.8034601–22:27:17.3525390 | 201  | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                             |
| S6                              | 22:27:17.3746242–22:27:18.3045613 | 201  | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                                 |
| S7                              | 22:27:18.3068732–22:27:18.9607223 | 201  | 0 anonymous public-table grants                                                                                                                |
| TokenAggregate                  | 22:27:18.9623373–22:27:19.8908083 | 201  | 12 total; 11 revoked; 1 active; 1 distinct session; database time 22:27:20.197257Z                                                             |
| SeparateControlValuesDiagnostic | 22:27:19.8997578–22:27:21.2502275 | 201  | signups_enabled=false; generation_enabled=false; provider_routes_enabled=false; charging_enabled=false; updated_at=2026-09-02 15:47:59.474991Z |

The final row is the same authorized singleton-table projection documented in
checkpoint 13, not successful execution of the S4 getter or a newly accepted
capture procedure. No permissions, functions or configuration changed. The
control-row update time still matches baseline. The exact S2 enumeration remains
in `replacement-observation-hour-01-2026-09-08.md`.

After browser recovery attempts, S1 at
**22:28:37.4722993Z–22:28:38.4244647Z**, database time 22:28:38.765375Z,
returned the same Auth counts. S2 at **22:28:38.4384175Z–22:28:39.3500625Z**
again returned all 27 counts zero. TokenAggregate at
**22:28:39.3521738Z–22:28:40.0610104Z**, database time 22:28:40.461230Z,
again returned 12 total, 11 revoked, 1 active and 1 distinct session.

Last sign-in remained September 4 21:19:38.051408Z; session creation remained
21:19:38.052003Z; latest session touch remained September 8 21:17:30.062466Z.
Revoked historical tokens are not a second active session. Password-reset
completion is not inferred. These snapshots do not establish continuous database
state between reads.

## Endpoint, Worker, storage and DNS reads

| UTC completion   | Check                               | Result                                                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 22:27:11.3968108 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request b98d97a0-1ad8-4f4c-82fc-7ee655d412dc; client 612 ms      |
| 22:27:11.7361682 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request 43c14a03-9740-4814-8b5e-f732159d03ce; client 174 ms                                            |
| 22:27:11.9168350 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 165 ms                                                                    |
| 22:27:13.3257484 | Auth configuration                  | disable_signup=true; mailer_autoconfirm=false                                                                                    |
| 22:28:38.4795260 | Worker deployment                   | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 22:29:41.8340243 | Worker gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 22:29:41.8340243 | Secret-binding names only           | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 22:29:57.6462480 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 22:28:38.2530793 | R2 information                      | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 22:29:32.6330217 | R2 public access                    | r2.dev disabled                                                                                                                  |
| 22:29:35.8615847 | R2 custom domains                   | None                                                                                                                             |

Pinned Wrangler 4.110.0 completed the Worker and R2 sequences with exit 0.
CLI completion was delayed after some output; each completion timestamp above
comes from its actual marker. No commands needed interruption in this checkpoint.
No binding values other than the two allowlisted flags were retained. Client
HTTP timings are not Worker p95, SLO or capacity evidence.

DNS at **22:27:13.6339581Z–22:27:14.0625244Z** returned api.mustbeviral.com
NXDOMAIN (status 3), and apex/www A answers 104.21.6.198 and 172.67.135.59.
Hidden CNAME targets are not inferred.

## Browser outcome and bounded Vercel telemetry

The existing Chrome profile was available, but the previous observation tab was
absent from inventory. Opening a fresh Continue tab in that same profile timed
out after 15 seconds and reset control. A later inventory showed a new blank tab;
selecting it with a 30-second bound also timed out without usable page state.
The blank inventory entry does not prove successful navigation or owner-session
access. No unrelated tab was operated on, and no new login was submitted.

Fresh canvas/quote denial renders, RSC counts, current handoff and browser network
coverage remain UNKNOWN. No Network.enable call was issued, fixture created or
generation intentionally submitted. The blank tab was not marked for retention.
Earlier successful browser checks and earlier gaps remain historical evidence.

Vercel REST at **22:28:38.1365867Z** confirmed production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb` in project
`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, READY, with null separate `state` field.
Aliases remained `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. The exact-team
listing at **22:28:38.2930337Z** returned no deployments since the 03:18:11Z
anchor, pagination count zero and next null.

Pinned Vercel CLI 55.0.0 completed three bounded reads with exit 0. All used the
upper bound **22:28:38.3027438Z**:

- Anchor-window sample, completed **22:29:05.1206590Z**: 100 records, 50 unique
  IDs, 48 HTTP 200 and two HTTP 403, all info. The historic 403 entries are the
  supported absent-canvas and quote proxy paths, not fresh probes. The
  100-record limit was reached.
- HTTP 403 query from **22:25:41Z**, completed **22:29:12.0385286Z**: no returned
  records. This supplies no fresh server-path corroboration, not proof of zero
  requests.
- Anchor-window error-level query, completed **22:29:21.2696307Z**: no returned
  records. This is not an exhaustive zero-error or runtime-cluster claim.

The whole-window connector histogram remains unavailable. Sample counts were
deduplicated by record ID; omitted categories are not zero. No headers, cookies,
query values, credentials or raw Auth records were saved.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting,
governance/generated-output validation and exact staged/committed scope checks
passed. Authority files remained byte-identical after formatting. Only this
redacted evidence file was committed; no full build was repeated.

Publication remains held under the CI cost rules: current branch push workflows
lack Markdown path filters, and workflow paths are outside this step. No push,
workflow dispatch, linter change or weakened check occurred. Published HEAD
remains `966006beb9bc163019f6c04a564d820b577e1a6d`; prior CI results were not
reread. CI for the local evidence remains not run.

No deployment, DNS, sending, signup, customer/provider activity, payment or
production configuration mutation occurred. Original September 4–7 acceptance
remains NOT PROVEN. Replacement acceptance, all daily captures and the separate
owner traffic ruling remain pending. No successor was started.

Next action: continue observation and recover browser control for day one,
September 9 **01:18:11–05:18:11Z**. Day two uses that window September 10;
closing is September 11 **03:18:11–05:18:11Z**, never before 72 hours elapsed.
