# Replacement observation — first supplemental checkpoint

Packet: `WP-P3-009`, current step `p3i-003-private-72-hour-observation`.
Checkout: `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`,
HEAD at collection `003c9d26ea53feb9130f38d0595f7725dad187b0`, clean, one worktree.
Pinned Node 24.18.0 / pnpm 11.12.0; `pnpm agent:preflight` passed.

Collection ran **2026-09-08T04:17:06Z–04:23:08Z**, about one hour after the
replacement anchor `2026-09-08T03:18:11Z`. This is an additional contemporaneous
checkpoint from the active Codex continuation, not proof that the scheduled
heartbeat executed. It does not replace the required September 9/10 daily or
September 11 closing captures and does not pass either observation window.

## Database and containment

S1–S7 used the explicitly targeted Supabase connector for
`jjgtlfblsfobdhmtngbz`. Independent reads ran concurrently between 04:17:06Z and
04:17:17Z; they are point-in-time reads, not one transaction or continuous knowledge.

| Check                                                 | Observed result                                                                                                      |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| S1 at 04:17:09.528005Z                                | 1 user, 1 session, 2 refresh-token rows, 0 flow-state rows, 1 identity, 1 non-null password field                    |
| S1 token detail                                       | 1 revoked token, 1 active token, 1 distinct session across token history                                             |
| S1 session metadata                                   | Last sign-in September 4 21:19:38.051408Z; session created 21:19:38.052003Z; last touch September 8 02:46:59.706282Z |
| S2                                                    | All 27 tenant/money/machine tables listed below have zero rows                                                       |
| S3                                                    | 4 providers, 2 price catalogs, 5 model routes, 8 route prices                                                        |
| S4                                                    | Signup, charging, generation and provider routes false; updated_at remains 2026-09-02T15:47:59.474991+00:00          |
| S5                                                    | 31 public tables, zero RLS-disabled, zero not forced, 2 with no policies                                             |
| S6                                                    | Migration head 20260902154759, 20260902000000, 20260831140000                                                        |
| S7                                                    | Zero anonymous public-table grants                                                                                   |
| S2 after browser probes, read completed 04:21:00Z     | All 27 tables still zero                                                                                             |
| S1 after browser probes, server time 04:20:58.328193Z | 1 user, 1 session, 3 total refresh tokens, 2 revoked, 1 active, 1 distinct session across all tokens                 |

S2 tables: `api_keys`, `artifact_lineage`, `artifacts`, `attempts`, `audit_events`,
`brand_kits`, `briefs`, `canvas_revisions`, `canvases`, `cost_reservations`,
`idempotency_records`, `ledger_transactions`, `oauth_access_tokens`, `oauth_clients`,
`outbox_events`, `projects`, `provider_jobs`, `provider_webhook_events`, `quotes`,
`run_nodes`, `runs`, `skill_versions`, `skills`, `stripe_webhook_events`,
`workspace_billing_profiles`, `workspace_memberships`, `workspaces`.

The additional revoked refresh token after browser access is consistent with
normal rotation on the same session: active-token and distinct-session counts
remain one. Token contents, session IDs and owner identifiers were not collected.
The non-null password field is not evidence of password-reset completion.

## HTTP, browser and retained runtime evidence

| UTC capture               | Probe                                       | Result                                                                                                                                                    |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04:18:30.2435523          | Core health                                 | HTTP 200, service mustbeviral-core, generation viralgraph-cleanroom-v2, status ok; request ID 3489bc3f-594f-423f-950d-2b1eb05c0479; client elapsed 288 ms |
| 04:18:30.3390503          | Unsigned zero-UUID artifact content         | HTTP 401 UNAUTHENTICATED; request ID 84d66b4b-5cc7-4d3d-9341-a18aa8b2644c; client elapsed 36 ms                                                           |
| 04:18:30.5786196          | Anonymous protected Vercel alias            | HTTP 302 to vercel.com; client elapsed 236 ms; redirect query not retained                                                                                |
| Approximately 04:19–04:20 | Existing owner browser, absent canvas       | Rendered Canvas unavailable / You do not have access to this canvas; observed HTTP 403                                                                    |
| Approximately 04:20       | Existing owner browser, absent-canvas quote | Rendered Quote unavailable / You do not have permission to quote this canvas; observed HTTP 403                                                           |

The browser used the two supported paths in
`observation-recovery-procedure-2026-09-08.md`. Its network capture returned 75
response events: 73 HTTP 200 and two HTTP 403, including each corresponding
`/api/core/v1/canvases/<zero-uuid>` path and its `/quotes` child. Of the responses,
32 were RSC requests; **zero observed RSC responses were 503**. Seven loading
failures were canceled `net::ERR_ABORTED` events. The tool reported
`truncated=true`, `hasMore=false`; these are counts observed, not exhaustive
browser or edge coverage. An initial CDP documentation prerequisite was resolved
before capture; that tool requirement was not a service failure.

Vercel queries explicitly targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`,
team `team_A11dbY2xnTWzGL63IRBTWmLo`, and deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb` for request counts. The deployment read returned
READY, production target and only its two vercel.app aliases. No deployments
created since the replacement anchor were returned.

For **03:18:11Z–04:20:57.067Z**, the runtime-error tool returned no clusters. The
status histogram showed 36 HTTP 200 and one HTTP 403, while reporting three
distinct values and displaying only two. The omitted category remains UNKNOWN.
The 403-by-path query for 04:18:11Z onward returned one absent-canvas path, including
on one later recheck. It did not independently return the quote path. Browser
evidence proves the observed quote 403; this checkpoint does not claim complete
retained Vercel corroboration for both denials. Counts from the two systems are
not interchangeable, and the cause of the coverage difference is unverified.

Client elapsed times include local/network overhead and are not Worker p95 or
capacity measurements. Navigation touched only the browser's local workflow-step
record and normal Auth refresh; no brief, canvas, quote, run or fixture was saved.
After collection the browser returned to `/studio/continue`; temporary network
observation was disabled and the owner session was retained for later captures.

## Provider configuration, storage and DNS

Pinned Wrangler 4.110.0 reads and allowlisted configuration projections returned:

| Surface                                       | Result                                                                                                                                      |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| R2 bucket information around 04:17Z           | mustbeviral-v2-production-media, zero objects, zero bytes                                                                                   |
| R2 privacy, 04:19:44Z–04:19:52Z               | r2.dev public access disabled; no custom domains                                                                                            |
| Active Worker, read completed by 04:18:36Z    | Deployment ee26c70e-9be5-4406-a5af-ceec2897f42a, created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| Version-specific gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                           |
| Version history at 04:23:07.3204751Z          | Eight versions; same newest version; containment version 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                      |
| Worker secret names, read completed 04:19:52Z | ARTIFACT_ACCESS_SIGNING_KEY, CONFIRMATION_SIGNING_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY                                        |
| Auth projection at 04:19:44.1635910Z          | disable_signup=true; mailer_autoconfirm=false                                                                                               |
| api.mustbeviral.com at 04:19:44.2123327Z      | NXDOMAIN, DNS status 3                                                                                                                      |
| www.mustbeviral.com at 04:19:44.3299398Z      | A answers 104.21.6.198 and 172.67.135.59                                                                                                    |
| mustbeviral.com at 04:19:44.4825285Z          | A answers 172.67.135.59 and 104.21.6.198                                                                                                    |

The A answers do not reveal the proxied CNAME targets. No secret values, Auth
configuration beyond the two allowlisted flags, redirect query, cookies, customer
rows or signed URLs are retained here.

## Result and next capture

No observed change to deployment identity, disabled behavior, private storage or
tenant/money containment. Runtime/browser coverage limits remain explicit. No
deployment, migration, DNS change, provider execution, payment, customer admission
or new authorization was performed. The original window remains NOT PROVEN and
replacement acceptance remains pending.

The next required daily capture is **September 9, 01:18:11–05:18:11Z**; day 2 uses
the same window on September 10. Closing remains September 11 at or after
03:18:11Z and no later than 05:18:11Z, never before 72 hours. The separate explicit
owner traffic ruling is still pending. Keep the successor inactive until current
acceptance is proven.

Independent read-only review by successor_review found no inconsistency, exposed
private data or completion overclaim. It confirmed that the missing retained
quote-path result remains a disclosed procedure-coverage limitation; this is
supplemental evidence and not a claim that every daily-capture requirement passed.

Local `pnpm agent:verify` completed successfully after recording this checkpoint
and its handoff: governance and formatting passed; fresh integration tests passed
(web 21, contracts 3, Core 2); all 18 build tasks passed using the existing cache.
The subsequent additions of this verification note and the handoff evidence path
were rechecked before commit. This does not clear the separately recorded
database pgTAP failures in GitHub Quality CI at collection HEAD.
