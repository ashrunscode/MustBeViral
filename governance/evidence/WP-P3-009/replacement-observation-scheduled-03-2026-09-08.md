# Replacement observation — third scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T06:54:14.046Z**. Collection ran **06:59:10.573Z–07:02:13.884Z**.
Collection HEAD: `e31b73036a95aae77098c81bd6c2f8940386f3fd`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009`, current `p3i-003-private-72-hour-observation`.
The required authority documents were unchanged from their previously read state.

Both supported browser denials rendered. Retained server records corroborated
only the quote path during this collection, so server corroboration is incomplete.
No new production incident was observed. This supplemental checkpoint does not
pass a required daily capture or the 72-hour observation window.

## Sequential database reads

Every query explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. These are client
UTC tool-call bounds; labeled server timestamps use the database clock. Small
client/server clock differences are not session drift.

| Check           | Client UTC bounds         | Result                                                                                                                               |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S1              | 06:59:11.660–06:59:13.302 | 1 user, 1 session, 4 refresh-token rows, 0 flow-state rows, 1 identity, 1 non-null password field; server timestamp 06:59:13.476972Z |
| S2              | 06:59:13.304–06:59:14.598 | All 27 tenant/money/machine tables zero                                                                                              |
| S3              | 06:59:14.598–06:59:15.874 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                        |
| S4              | 06:59:15.874–06:59:17.578 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                     |
| S5              | 06:59:17.578–06:59:18.979 | 31 public tables; zero RLS-disabled; zero not forced; 2 with no policies                                                             |
| S6              | 06:59:18.980–06:59:20.292 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                        |
| S7              | 06:59:20.292–06:59:21.584 | Zero anonymous public-table grants                                                                                                   |
| Token aggregate | 06:59:21.584–06:59:23.977 | 4 total, 3 revoked, 1 active, 1 distinct session; server timestamp 06:59:22.918567Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 05:57:20.67366Z before these browser probes.

The post-probe S2 query, within 07:01:38.629Z–07:01:50.142Z, again returned zero
for every table. The accompanying Auth aggregate at server **07:01:48.86237Z**
returned 1 user, 1 session, 5 total refresh tokens, 4 revoked, 1 active and
1 distinct session. The additional revoked token is consistent with rotation of
the same session. Password-reset completion is not inferred. These are snapshots,
not continuous knowledge of database contents between reads.

## HTTP and deployed configuration

| UTC completion   | Check                               | Result                                                                                                                                               |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 07:00:10.2516643 | Core health                         | 200; service mustbeviral-core, generation viralgraph-cleanroom-v2, status ok; request ID 4bb32eae-52c3-4dfe-90cc-265e16f8ab13; client elapsed 296 ms |
| 07:00:10.3446733 | Unsigned zero-UUID artifact content | 401 UNAUTHENTICATED; request ID b04a5a4d-fbf4-4a23-a3ff-9cc984eec2e8; client elapsed 35 ms                                                           |
| 07:00:10.5591821 | Anonymous protected Vercel alias    | 302 to vercel.com; redirect query omitted; client elapsed 211 ms                                                                                     |
| 07:00:12.1607692 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a, created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                     |
| 07:00:12.9422745 | R2 bucket                           | mustbeviral-v2-production-media, 0 objects, 0 B                                                                                                      |
| 07:00:13.0144359 | Auth allowlist projection           | disable_signup=true; mailer_autoconfirm=false                                                                                                        |
| 07:00:14.8928375 | Active version gate projection      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                    |
| 07:00:14.8928375 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY, CONFIRMATION_SIGNING_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY                                                 |
| 07:00:15.9156968 | R2 public access                    | r2.dev disabled                                                                                                                                      |
| 07:00:17.9132300 | Worker history                      | Eight versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                            |
| 07:00:18.6699459 | R2 custom domains                   | None                                                                                                                                                 |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Client timings are not Worker p95 or capacity evidence.

DNS reads at 07:00:13.1590047Z–07:00:13.4909406Z returned api.mustbeviral.com
NXDOMAIN (status 3), with apex/www A answers 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser and retained runtime evidence

At approximately 07:00Z–07:01Z the retained owner browser rendered both supported
zero-UUID denials from the recovery procedure:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

Network events collected through **07:01:11.896Z** showed 75 responses: 73 HTTP
200 and 2 HTTP 403, one for each canvas and quotes-child Core proxy path. Of
these, 32 were RSC requests and **zero observed RSC responses were 503**. Six
loading failures were canceled `net::ERR_ABORTED`. The first event page reported
`truncated=true`, the second false, and both `hasMore=false`. This is partial
event coverage, not exhaustive edge telemetry. No headers, cookies, credentials,
session IDs or signed URLs were retained.

Network capture was disabled and `/studio/continue` rendered after the probes.
The existing tab was retained. Only normal Auth refresh and the browser's local
workflow-step record were touched; no tenant fixture, canvas, quote or run was
saved.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases;
the listing returned no deployments created after the replacement anchor.

For **03:18:11Z–07:01:38.629Z**, no runtime-error clusters were returned. The
status histogram showed 124 HTTP 200 and 5 HTTP 403, while reporting three
distinct values and displaying only two. The omitted category remains UNKNOWN.
These provider counts are separate from browser event counts.

The initial 403-by-path query for **07:00:20Z–07:01:38.629Z** returned one
quotes-child path and no canvas row. One later query broadened the range to
**06:59:10.573Z–07:02:11.774Z** and still returned only that quote path; it
completed at 07:02:13.884Z. Thus, the browser's canvas 403 was not corroborated by
retained server records in this checkpoint. Missing retained telemetry is not
reported as zero requests, successful server corroboration, or a production
failure. Its cause is UNKNOWN; no further retry was performed.

## Disposition

Gates, deployments, private storage and zero tenant/money counts remained
consistent with the baseline. No production configuration, deployment, DNS,
signup, sending, provider, payment or customer mutation was performed. Browser
denials passed, with incomplete retained server and network coverage disclosed.
Observation acceptance and the separate owner traffic ruling remain pending;
closing sign-out is still deferred.

The next required day-one capture is September 9 **01:18:11–05:18:11Z**; day two
uses that window September 10. Closing remains September 11
**03:18:11–05:18:11Z**, never before 72 hours from the September 8 03:18:11Z anchor.
The original September 4–7 window stays NOT PROVEN. Continue the scheduled checks.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only heartbeat. At collection HEAD, Governance
run 34193064756 succeeded; Quality run 34193064767 failed only in database-pgtap
(job 101954913944), while its quality job 101954914146 succeeded. Detailed failed
logs were not reread, so this checkpoint does not assert exact error equivalence
to earlier runs. It does not clear that CI gate or authorize the successor.
