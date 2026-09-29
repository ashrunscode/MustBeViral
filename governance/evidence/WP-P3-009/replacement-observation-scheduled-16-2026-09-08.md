# Replacement observation — sixteenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T23:27:17.692Z**. Collection ran **23:27:39Z–23:33:36Z**, at HEAD
`35fea9e269ec62dc184cc507edfa014d10b29f13`, branch
`codex/viralgraph-cleanroom`, one worktree. Pinned Node 24.18.0 / pnpm 11.12.0
and preflight passed. The current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`; authority is unchanged.

**Partial supplemental checkpoint:** available endpoints, deployments, storage
and database reads showed no observed drift. Browser recovery still failed,
including a separate tab-creation/navigation approach. Required rendered denials
and RSC coverage remain unverified. The S4 monitoring RPC is still denied, while
a separate authorized projection verifies all underlying controls false.
No daily capture or observation acceptance was advanced.

## Sequential database evidence

Only Supabase `jjgtlfblsfobdhmtngbz` was queried with the existing credential,
using Management API requests with `read_only=true` and explicit HTTP response
handling. The seven execution-spec queries ran in order; S1 additionally
captured database time.

| Check                           | Client UTC bounds                 | HTTP | Result                                                                                                                                         |
| ------------------------------- | --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| S1                              | 23:30:19.4015529–23:30:20.8272701 | 201  | 1 user; 1 session; 12 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 23:30:21.210659Z             |
| S2                              | 23:30:20.8524987–23:30:21.4979109 | 201  | All 27 tenant/money/machine tables zero                                                                                                        |
| S3                              | 23:30:21.5012947–23:30:22.1401673 | 201  | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                                  |
| S4                              | 23:30:22.1408327–23:30:22.8008600 | 400  | SQLSTATE 42501; permission denied for get_platform_kill_switches                                                                               |
| S5                              | 23:30:22.8031647–23:30:23.6316670 | 201  | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                             |
| S6                              | 23:30:23.6372400–23:30:24.4565310 | 201  | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                                 |
| S7                              | 23:30:24.4573348–23:30:25.0843504 | 201  | 0 anonymous public-table grants                                                                                                                |
| TokenAggregate                  | 23:30:25.0895624–23:30:25.8991497 | 201  | 12 total; 11 revoked; 1 active; 1 distinct session; database time 23:30:26.226948Z                                                             |
| SeparateControlValuesDiagnostic | 23:30:25.9020027–23:30:26.5176588 | 201  | signups_enabled=false; generation_enabled=false; provider_routes_enabled=false; charging_enabled=false; updated_at=2026-09-02 15:47:59.474991Z |

The final row uses the same authorized singleton-table projection documented in
checkpoint 13. It is separate from the unsuccessful S4 RPC and does not amend
accepted capture requirements. No grants, functions or configuration changed;
the update time remains the baseline value. The exact S2 enumeration remains
in `replacement-observation-hour-01-2026-09-08.md`.

After browser recovery attempts, S1 at
**23:32:59.7746743Z–23:33:00.7413471Z**, database time 23:33:01.109728Z,
returned unchanged Auth counts. S2 at **23:33:00.7714506Z–23:33:01.4587881Z**
again returned all 27 counts zero. TokenAggregate at
**23:33:01.4600196Z–23:33:02.2180932Z**, database time 23:33:02.647900Z,
returned 12 total, 11 revoked, 1 active and 1 distinct session.

Sign-in remained September 4 21:19:38.051408Z; session creation remained
21:19:38.052003Z; latest session touch remained September 8 21:17:30.062466Z.
Revoked token history is not a second active session. No password-reset
completion is inferred. These are snapshots, not continuous database reads.

## Endpoint, Worker, R2 and DNS evidence

| UTC completion   | Check                               | Result                                                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 23:30:20.1663296 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request a23af738-b4d2-4805-b2c8-3979e6135e5e; client 1532 ms     |
| 23:30:20.6520754 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request b68828c6-8d36-41f4-b4e5-62792a99293b; client 305 ms                                            |
| 23:30:20.9652810 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 308 ms                                                                    |
| 23:30:22.0777827 | Auth configuration                  | disable_signup=true; mailer_autoconfirm=false                                                                                    |
| 23:30:37.9841107 | Worker deployment                   | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 23:30:44.8804815 | Worker gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 23:30:44.8804815 | Secret-binding names only           | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 23:30:50.2799208 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 23:30:37.8849254 | R2 information                      | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 23:30:43.1742165 | R2 public access                    | r2.dev disabled                                                                                                                  |
| 23:30:47.9712923 | R2 custom domains                   | None                                                                                                                             |

Pinned Wrangler 4.110.0 completed the full Worker and R2 sequences with exit 0.
No read client required interruption. Binding values other than the two
allowlisted flags were not retained. Client elapsed HTTP times do not establish
Worker p95, SLO or capacity results.

DNS at **23:30:22.3761769Z–23:30:24.7080666Z** returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Hidden CNAME targets are not inferred.

## Browser recovery outcome

The existing Chrome profile was available, with no observation tab in inventory.
A fresh Continue-tab open, allowed up to 60 seconds, returned a missing-tab
error after about 18 seconds. A documented lower-level browser tab creation then
returned a new tab ID. Its ordinary Continue navigation followed by a DOM read
ran into the 45-second tool timeout and reset control. A fresh filtered inventory
still showed that specific new tab at `about:blank`. No rendered Studio page or
successful navigation was verified; cause of the control failure is UNKNOWN.

No unrelated browser tab was operated on. No new sign-in, fixture or generation
was intentionally submitted. CDP documentation was read, but no CDP command or
Network.enable was issued because navigation never reached the intended origin.
Fresh canvas/quote renders, RSC counts, current handoff and network coverage are
UNKNOWN. The blank tab was not marked for retention. Earlier browser evidence
and gaps remain historical.

The required day-one window opens in less than two hours after this checkpoint.
Repeated selection and navigation recovery has not restored control. Owner
attention is needed to reopen the existing signed-in Studio page in connected
Chrome before the required capture, so observation can be retried. Reopening is
not assumed to fix the underlying control problem, and no daily failure is
backdated or declared before its actual window.

## Bounded Vercel evidence

REST at **23:33:00.0986550Z** confirmed production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, project
`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, READY, with null separate `state` field.
Aliases remained `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. The exact-team
listing at **23:33:00.2778923Z** returned no deployments since the 03:18:11Z
anchor, pagination count zero and next null.

Pinned Vercel CLI 55.0.0 completed all three bounded log reads with exit 0,
through **23:33:00.2880264Z**:

- Anchor-window sample, completed **23:33:10.1605768Z**: 100 records, 50 unique
  IDs, 48 HTTP 200 and two HTTP 403, all info. The historic 403 records identify
  the supported absent-canvas and quote proxy paths; they are not new probes.
  The 100-record limit was reached.
- HTTP 403 query from **23:27:39Z**, completed **23:33:14.1710366Z**: no returned
  records. It supplies no fresh server-path corroboration, not proof of zero
  requests.
- Anchor-window error-level query, completed **23:33:19.3510486Z**: no returned
  records. This is not an exhaustive zero-error or runtime-cluster claim.

The whole-window connector histogram remains unavailable. Sample counts were
deduplicated by record ID. No missing category was converted to zero, and no
headers, cookies, query values, credentials or raw Auth records were saved.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting,
governance/generated-output validation and exact staged/committed scope checks
passed. Authority files remained byte-identical after formatting. Only this
redacted evidence file was committed; no full build was repeated.

Publication remains held under the CI cost rules: branch push workflows lack
Markdown path filters and their paths are outside this active step. No push,
workflow dispatch, linter change or weakened check occurred. Published HEAD
remains `966006beb9bc163019f6c04a564d820b577e1a6d`; its prior CI results were
not reread. CI for local evidence remains not run.

No deployment, DNS, sending, signup, customer/provider activity, payment or
production configuration mutation occurred. Original September 4–7 acceptance
remains NOT PROVEN. Replacement acceptance, all daily captures and the separate
owner traffic ruling remain pending. No successor was activated.

Next action: restore observation-browser access and continue the required day-one
capture September 9 **01:18:11–05:18:11Z** (September 8, 8:18:11 PM–September 9,
12:18:11 AM CDT). Day two uses the same UTC window September 10; closing is
September 11 **03:18:11–05:18:11Z**, never before 72 hours elapsed.
