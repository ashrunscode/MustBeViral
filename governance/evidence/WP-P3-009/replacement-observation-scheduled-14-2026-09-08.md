# Replacement observation — fourteenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T21:25:42.224Z**. Collection ran **21:27:11Z–21:32:51Z**, at HEAD
`7269b2c8f977ce15703d8649b12acc070ea8f2a2`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0 and
preflight passed; the current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`.

**Partial supplemental checkpoint:** available service, deployment and database
reads showed no observed drift. Browser inventory was available, but selecting
and claiming the retained tab timed out; no fresh rendered denial or RSC capture
was verified. The S4 RPC remains denied to the monitoring call, while a separate
authorized read again verified its underlying switch values off. R2 commands
completed successfully in this checkpoint. No daily acceptance was advanced.

## Sequential database reads

The same existing credential accessed only Supabase
`jjgtlfblsfobdhmtngbz` through the Management API. All requests retained
`read_only=true` and explicit HTTP status/body handling. The seven execution-spec
queries ran sequentially; S1 additionally captured database time.

| Check                           | Client UTC bounds                 | HTTP | Result                                                                                                                                         |
| ------------------------------- | --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| S1                              | 21:29:37.3408086–21:29:38.9130530 | 201  | 1 user; 1 session; 12 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 21:29:38.826385Z             |
| S2                              | 21:29:39.1856622–21:29:40.0490219 | 201  | All 27 tenant/money/machine tables zero                                                                                                        |
| S3                              | 21:29:40.1116884–21:29:41.4749457 | 201  | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                                  |
| S4                              | 21:29:41.5151817–21:29:42.1744728 | 400  | SQLSTATE 42501; permission denied for get_platform_kill_switches                                                                               |
| S5                              | 21:29:42.2381000–21:29:42.9054509 | 201  | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                             |
| S6                              | 21:29:42.9217167–21:29:43.5919038 | 201  | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                                 |
| S7                              | 21:29:43.6126272–21:29:44.2398228 | 201  | 0 anonymous public-table grants                                                                                                                |
| TokenAggregate                  | 21:29:44.2498968–21:29:44.9912456 | 201  | 12 total; 11 revoked; 1 active; 1 distinct session; database time 21:29:45.234929Z                                                             |
| SeparateControlValuesDiagnostic | 21:29:45.1251089–21:29:45.8166456 | 201  | signups_enabled=false; generation_enabled=false; provider_routes_enabled=false; charging_enabled=false; updated_at=2026-09-02 15:47:59.474991Z |

The final row is the same authorized singleton-table projection recorded in
checkpoint 13, not successful execution of S4 or an amended acceptance procedure.
No grants, functions or configuration changed. Its update time matches baseline.
The exact S2 enumeration remains in
`replacement-observation-hour-01-2026-09-08.md`.

After the browser recovery attempts, S1 at
**21:32:38.9163284Z–21:32:39.9935247Z**, database time 21:32:40.338810Z,
returned the same Auth counts. S2 at **21:32:40.0044047Z–21:32:40.8770482Z**
again returned all 27 counts zero. TokenAggregate at
**21:32:40.8790774Z–21:32:41.5467584Z**, database time 21:32:41.893554Z,
again returned 12 total, 11 revoked, 1 active and 1 distinct session.

Last sign-in remained September 4 21:19:38.051408Z; session creation remained
21:19:38.052003Z; latest session touch remained September 8 21:17:30.062466Z.
Revoked historical tokens are not a second active session. Password-reset
completion is not inferred. These are timed snapshots, not continuous reads.

## HTTP, Auth, Worker, R2 and DNS

| UTC completion   | Check                               | Result                                                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 21:29:36.9675769 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request e0674454-e209-4b47-8257-69b501263b32; client 857 ms      |
| 21:29:37.1984170 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request 1e0fec8c-387c-4eee-bc9c-6cdde159cd2f; client 70 ms                                             |
| 21:29:37.4758714 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 256 ms                                                                    |
| 21:29:42.3229918 | Auth configuration                  | disable_signup=true; mailer_autoconfirm=false                                                                                    |
| 21:32:12.9406396 | Worker deployment                   | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 21:32:16.4783713 | Worker gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 21:32:16.4783713 | Secret-binding names only           | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 21:32:20.1393653 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 21:32:12.7775939 | R2 information                      | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 21:32:15.4050141 | R2 public access                    | r2.dev disabled                                                                                                                  |
| 21:32:18.0735204 | R2 custom domains                   | None                                                                                                                             |

Wrangler 4.110.0 was pinned. An initial Worker read from `apps/core` returned no
usable output and was interrupted locally with exit 1. The retry from the
repository root completed the full deployment/version/history sequence with
exit 0. The direct pinned R2 sequence delayed completion after output but then
completed all three commands with exit 0. Two standalone privacy/domain reads
also completed with exit 0 at **21:32:20.1910924Z** and
**21:32:12.8447192Z**, respectively. When their sessions were resumed, they had
already finished; no successful result is inferred merely from an attempted
interrupt. Previous checkpoints' interrupted CLI completion remains historical.

No binding values other than the two allowlisted flags were retained. Client
HTTP elapsed times do not establish Worker p95, an SLO or capacity.

DNS at **21:29:43.0894914Z–21:29:43.8147255Z** returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Hidden CNAME targets are not inferred.

## Browser and Vercel coverage

Inventory in the existing Chrome profile identified the retained MustBeViral tab
at `/studio/continue`. Tab selection timed out and reset the control session.
A documented recovery listed that exact tab again, but claiming it and reading
its DOM also timed out without usable page state. The inventory URL is metadata,
not proof of a successful rendered Continue page or an authenticated denial.
Fresh canvas/quote outcomes, RSC counts, current handoff and browser network
coverage are UNKNOWN. No Network.enable command was issued. No new login,
fixture or generation was intentionally submitted. No unrelated tab was claimed.

Vercel REST at **21:31:18.5532227Z** confirmed production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb` in project
`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, READY, with null separate `state` field.
Aliases remained `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. The exact-team
deployment listing at **21:31:18.7606327Z** returned none since the 03:18:11Z
anchor, pagination count zero and next null.

Pinned Vercel CLI 55.0.0 completed three bounded reads with exit 0, all through
**21:31:18.7723524Z**:

- Anchor-window sample, completed **21:31:35.8115910Z**: 100 records, 50 unique
  IDs, 48 HTTP 200 and two HTTP 403, all info. The two historic 403 entries are
  the supported absent-canvas and quote proxy paths; they are not fresh probes.
  The 100-record limit was reached.
- HTTP 403 query from **21:29:06Z**, completed **21:31:41.0801199Z**: no
  returned records; no fresh server-path corroboration. Its lower bound is later
  than the first browser inventory attempt.
- Anchor-window error-level query, completed **21:31:50.2195536Z**: no returned
  records. This is not an exhaustive zero-error/runtime-cluster claim.

The whole-window connector histogram is unavailable. Deduplicated sample counts
and missing categories are not a complete request histogram. No headers, cookies,
query values, credentials or raw Auth records were saved.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting,
governance/generated-output validation and exact staged/committed scope checks
passed. Authority files remained byte-identical after formatting. Only this
redacted evidence file was committed; no full build was repeated.

Publication remains held under the CI cost rules because current branch push
workflows lack Markdown path filters and workflow paths are outside this step.
No push, workflow dispatch, weakened check or linter change occurred. Published
HEAD remains `966006beb9bc163019f6c04a564d820b577e1a6d`; its prior CI results
were not reread. CI for local evidence remains not run.

No deployment, DNS, sending, signup, customer/provider activity, payment or
production configuration mutation occurred. Original September 4–7 acceptance
remains NOT PROVEN. Replacement acceptance, daily captures and the separate
owner traffic ruling remain pending. No successor was started.

Next action: continue observation and recover the retained browser for day one,
September 9 **01:18:11–05:18:11Z**. Day two uses that window September 10;
closing is September 11 **03:18:11–05:18:11Z**, never before 72 hours elapsed.
