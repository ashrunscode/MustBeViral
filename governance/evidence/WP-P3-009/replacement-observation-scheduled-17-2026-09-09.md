# Replacement observation — seventeenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-09T00:27:48.099Z**. Collection ran **00:28:00Z–00:32:25Z**, at HEAD
`117dccb983a2e4296fcccd7576959a8e47f7bd61`, branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0 and
preflight passed. The current step remains
`WP-P3-009 / p3i-003-private-72-hour-observation`; authority is unchanged.

**Partial supplemental checkpoint:** available service, deployment, storage and
database reads showed no observed drift. The project-scoped Supabase connector
became available and successfully returned the exact S4 getter. Vercel connector
telemetry also returned, with explicit histogram truncation. The existing Chrome
browser was absent from the available provider inventory, so no browser probes
were attempted. Owner-browser attention requested at checkpoint 16 remains
outstanding; this is still before the day-one window.

## Database evidence

The seven execution-spec queries first ran sequentially through the Management
API against only `jjgtlfblsfobdhmtngbz`, using the existing credential,
`read_only=true` and explicit HTTP handling. S1 also captured database time.

| Check                           | Client UTC bounds                 | HTTP | Result                                                                                                                             |
| ------------------------------- | --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1                              | 00:29:46.0151454–00:29:47.7552585 | 201  | 1 user; 1 session; 12 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 00:29:47.464602Z |
| S2                              | 00:29:47.8326639–00:29:48.4465653 | 201  | All 27 tenant/money/machine tables zero                                                                                            |
| S3                              | 00:29:48.4496688–00:29:49.0515525 | 201  | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4                              | 00:29:49.0637409–00:29:49.7611550 | 400  | SQLSTATE 42501; permission denied for get_platform_kill_switches                                                                   |
| S5                              | 00:29:49.7659158–00:29:50.5374952 | 201  | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6                              | 00:29:50.5401959–00:29:51.3327748 | 201  | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7                              | 00:29:51.3336671–00:29:51.9396314 | 201  | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate                  | 00:29:51.9562900–00:29:52.5329183 | 201  | 12 total; 11 revoked; 1 active; 1 distinct session; database time 00:29:52.990998Z                                                 |
| SeparateControlValuesDiagnostic | 00:29:52.6651183–00:29:53.3037213 | 201  | Four switches false; updated_at=2026-09-02 15:47:59.474991Z                                                                        |

The separate singleton-table projection was the same authorized read documented
in checkpoint 13. Its four fields were signups_enabled, generation_enabled,
provider_routes_enabled and charging_enabled. No role, grant, function or
configuration was changed. The exact S2 enumeration remains in
`replacement-observation-hour-01-2026-09-08.md`.

A later capability inventory found the original project-scoped Supabase
connector available again. Within UTC bounds **00:31:39Z–00:31:44Z**, it executed
exactly `select public.get_platform_kill_switches() as kill_switches;` against
`jjgtlfblsfobdhmtngbz` and returned tool success with **all four fields false**
and **updated_at=2026-09-02T15:47:59.474991+00:00**. No HTTP status was exposed by
that tool. This is fresh successful S4 evidence through the already authorized
connector, separate from the earlier Management API permission denial. The
Management API's read-only guard was never disabled. Earlier missing S4 results
are not retroactively repaired.

A later consistency read of S1 at
**00:30:36.0210296Z–00:30:36.9980042Z**, database time 00:30:37.418171Z,
returned unchanged Auth counts. S2 at **00:30:37.0318426Z–00:30:37.6337033Z**
again returned all 27 counts zero. TokenAggregate at
**00:30:37.6424554Z–00:30:38.3686777Z**, database time 00:30:38.827384Z,
returned 12 total, 11 revoked, 1 active and 1 distinct session. These are not
post-denial probes because no browser denial was executed in this checkpoint.

Sign-in remained September 4 21:19:38.051408Z; session creation remained
21:19:38.052003Z; latest touch remained September 8 21:17:30.062466Z. Historical
revoked tokens are not a second active session. Password-reset completion and
continuous database state between snapshots are not inferred.

## Endpoint, Worker, R2 and DNS evidence

| UTC completion   | Check                               | Result                                                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 00:29:46.4549065 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request 8906938a-e7e8-4c89-bf6d-95a8bf76f516; client 545 ms      |
| 00:29:46.6239268 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request b0f75757-04f9-4b0e-b382-899cf5c680ee; client 30 ms                                             |
| 00:29:46.7695513 | Anonymous protected alias           | HTTP 302 to vercel.com; redirect query omitted; client 131 ms                                                                    |
| 00:29:47.4676565 | Auth configuration                  | disable_signup=true; mailer_autoconfirm=false                                                                                    |
| 00:31:08.0921266 | Worker deployment                   | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 00:31:20.2376455 | Worker gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 00:31:20.2376455 | Secret-binding names only           | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 00:31:24.4032833 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |
| 00:31:07.5755129 | R2 information                      | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                  |
| 00:31:26.0168382 | R2 public access                    | r2.dev disabled                                                                                                                  |
| 00:31:28.1772989 | R2 custom domains                   | None                                                                                                                             |

Pinned Wrangler 4.110.0 completed Worker and R2 sequences with exit 0; no
interruption was needed. No binding values other than the two allowlisted flags
were retained. Client elapsed HTTP times are not Worker p95, SLO or capacity
results. DNS at **00:29:47.5651592Z–00:29:47.7907420Z** returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Hidden CNAME targets are not inferred.

## Browser and Vercel evidence

The fresh browser inventory exposed only the Codex in-app browser, with no tabs.
The existing owner Chrome profile was unavailable. No different session or
profile was substituted, no sign-in was attempted, and no CDP or Network.enable
command was issued. Fresh canvas/quote renders, owner-browser RSC counts and
handoff remain UNKNOWN. The earlier owner request to reopen Studio remains
pending; no new owner response or successful reconnect was observed.

Vercel REST at **00:30:36.2064737Z** confirmed production deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, project
`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, READY, with null separate `state` field.
Aliases remained `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. The exact-team
listing at **00:30:36.3763763Z** returned no deployments since the September 8
03:18:11Z anchor, pagination count zero and next null.

Before connector availability was discovered, pinned Vercel CLI 55.0.0 completed
three bounded log reads with exit 0 through **00:30:36.3964744Z**:

- Anchor-window sample, completed **00:31:04.5592930Z**: 100 records, 50 unique
  IDs, 48 HTTP 200 and two historic HTTP 403, all info. The limit was reached;
  those absent-canvas/quote paths do not represent new probes.
- HTTP 403 query from **00:28:00Z**, completed **00:31:09.0779970Z**: no returned
  records; no fresh server-path corroboration, not proof of zero requests.
- Anchor-window error-level query, completed **00:31:15.1919235Z**: no returned
  records; not an exhaustive runtime-error claim.

The restored Vercel connector then read the exact production deployment's
status histogram and the exact project's runtime-error clusters within client
UTC bounds **00:31:39Z–00:31:44Z**. Both selected September 8 **03:18:11Z** through
September 9 **00:31:00Z**. The histogram returned **HTTP 200: 381; HTTP 403: 18**,
while explicitly reporting **three distinct values, showing only two**. The
omitted third value and count are UNKNOWN; this is partial coverage despite the
requested limit of 100. The runtime-error query returned no clusters for that
selected range. Neither result supplies missing browser RSC coverage or proves
that every edge request was retained.

No headers, cookies, query values, credentials or raw Auth records were saved.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting,
governance/generated-output validation and exact staged/committed scope checks
passed. Authority files remained byte-identical after formatting. Only this
redacted evidence file was committed; no full build was repeated.

Publication remains held under the CI cost rules: branch push workflows lack
Markdown path filters and workflow paths are outside the active step. No push,
workflow dispatch, linter change or weakened check occurred. Published HEAD
remains `966006beb9bc163019f6c04a564d820b577e1a6d`; its prior CI results were
not reread. CI for local evidence remains not run.

No deployment, DNS, sending, signup, customer/provider activity, payment or
production configuration mutation occurred. Original September 4–7 acceptance
remains NOT PROVEN. Replacement acceptance, all required daily captures and the
separate owner traffic ruling remain pending. No successor was activated.

Next action: retry owner-browser access and collect day one September 9
**01:18:11–05:18:11Z**. Day two uses the same window September 10; closing is
September 11 **03:18:11–05:18:11Z**, never before 72 hours elapsed.
