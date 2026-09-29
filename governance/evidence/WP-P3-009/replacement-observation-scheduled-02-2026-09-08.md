# Replacement observation — second scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T05:53:12.800Z**. Collection ran **05:55:32Z–06:00:10Z**.
Collection HEAD: `cda3b799acc0e664555ad7ad5afad4a213c0ef82`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009`, current `p3i-003-private-72-hour-observation`.

Browser control recovered without a browser restart or new login. Supported
canvas and quote denials were observed and subsequently corroborated by retained
server records. No new production incident was observed. This remains a
supplemental checkpoint with disclosed telemetry limits, not a completed daily
capture or a passed 72-hour window.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds below are
client UTC tool-call bounds; server timestamps are separately labeled. Small
client/server clock differences are not evidence of session drift.

| Check           | Client UTC bounds         | Result                                                                                                                               |
| --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| S1              | 05:55:32.386–05:55:33.598 | 1 user, 1 session, 3 refresh-token rows, 0 flow-state rows, 1 identity, 1 non-null password field; server timestamp 05:55:33.744943Z |
| S2              | 05:55:33.599–05:55:34.816 | All 27 tenant/money/machine tables zero                                                                                              |
| S3              | 05:55:34.816–05:55:36.189 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                        |
| S4              | 05:55:36.189–05:55:37.339 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                     |
| S5              | 05:55:37.339–05:55:38.431 | 31 public tables; zero RLS-disabled; zero not forced; 2 with no policies                                                             |
| S6              | 05:55:38.431–05:55:40.721 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                        |
| S7              | 05:55:40.721–05:55:42.183 | Zero anonymous public-table grants                                                                                                   |
| Token aggregate | 05:55:42.183–05:55:43.407 | 3 total, 2 revoked, 1 active, 1 distinct session; server timestamp 05:55:43.544430Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. S1 last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 04:19:21.56888Z before the new probes.

After browser probes, the S2 recheck still returned zero for all 27 tables; that
query completed within 05:58:33Z–05:58:45Z. The accompanying Auth aggregate at
server **05:58:43.080967Z** returned 1 user, 1 session, 4 total refresh tokens,
3 revoked, 1 active, 1 distinct session. The extra revoked token is consistent
with normal rotation of the same session. Password-reset completion is not
inferred. These are snapshots, not continuous database knowledge.

## HTTP and deployed configuration

| UTC capture      | Check                               | Result                                                                                                                                               |
| ---------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 05:56:59.4980797 | Core health                         | 200; service mustbeviral-core, generation viralgraph-cleanroom-v2, status ok; request ID 391d20c6-d583-4067-922b-4d6d04cc7bf1; client elapsed 318 ms |
| 05:56:59.5835771 | Unsigned zero-UUID artifact content | 401 UNAUTHENTICATED; request ID 928935b3-2cde-4af3-b4df-9a9493463372; client elapsed 37 ms                                                           |
| 05:56:59.8078460 | Anonymous protected Vercel alias    | 302 to vercel.com; redirect query omitted; client elapsed 222 ms                                                                                     |
| 05:57:00.5618300 | Auth allowlist projection           | disable_signup=true; mailer_autoconfirm=false                                                                                                        |
| 05:57:05.9685133 | R2 bucket                           | mustbeviral-v2-production-media, 0 objects, 0 B                                                                                                      |
| 05:57:08.4291131 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a, created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                     |
| 05:57:09.6352943 | R2 public access                    | r2.dev disabled                                                                                                                                      |
| 05:57:12.0184009 | Active version gate projection      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                    |
| 05:57:12.0184009 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY, CONFIRMATION_SIGNING_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY                                                 |
| 05:57:13.6004016 | R2 custom domains                   | None                                                                                                                                                 |
| 05:57:16.0939286 | Worker history                      | Eight versions; same newest version; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                       |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` binding metadata; no separate secret-list parsing success or secret
values are claimed. Client elapsed times are not Worker p95 or capacity evidence.

DNS reads at 05:57:00.7270176Z–05:57:00.9805642Z returned api.mustbeviral.com
NXDOMAIN (status 3), and apex/www A addresses 104.21.6.198 and 172.67.135.59.
Proxied A records do not establish hidden CNAME targets.

## Browser and retained runtime evidence

At approximately 05:57Z–05:58Z the existing owner browser rendered:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

The supported zero-UUID paths are those in the recovery procedure. Browser events
captured through **05:58:09.710Z** showed 75 response events: 73 HTTP 200 and two
HTTP 403, one for each corresponding canvas and quotes-child proxy path. Of those,
32 were RSC requests and **zero observed RSC responses were 503**. Four loading
failures were canceled `net::ERR_ABORTED`. The first event page reported
`truncated=true`; the second reported false, with `hasMore=false`. Counts describe
observed events, not exhaustive edge traffic. No response headers, cookies,
credentials, session IDs or signed URLs were retained.

Temporary network capture was disabled and the browser returned to
`/studio/continue`, which rendered successfully. The tab was retained for later
checks. Only normal Auth refresh and the browser's local workflow-step record
were touched; no tenant fixture, canvas, quote or run was saved.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases;
no deployments created after the replacement anchor were returned.

For **03:18:11Z–05:58:33.376Z**, runtime errors returned no clusters. The status
histogram showed 85 HTTP 200 and 3 HTTP 403, while reporting three distinct values
and displaying only two. The omitted category remains UNKNOWN. These counts are
not interchangeable with browser event counts.

The initial 403-by-path query from 05:57:00Z returned only the canvas path. One
later read, with range **05:57:00Z–06:00:08.518Z**, returned one canvas path and one
quotes-child path; it completed at 06:00:10.201Z. This corroborates both new
browser denials. The earlier incomplete query was not treated as zero or as
proof of a failed quote response; the cause of the reporting delay is unverified.

## Disposition

The prior browser-control gap did not recur. Gates, deployments, private storage,
and zero tenant/money counts remained consistent with the baseline. No production
configuration, deployment, DNS, signup, sending, provider, payment or customer
mutation was performed. Current packet acceptance and the separate owner traffic
ruling remain pending; closing sign-out is still deferred.

The next required day-one capture is September 9 **01:18:11–05:18:11Z**; day two
uses that window September 10. Closing remains September 11
**03:18:11–05:18:11Z**, never before 72 hours from the September 8 03:18:11Z anchor.
The original September 4–7 window stays NOT PROVEN. Continue the scheduled checks.

Pinned preflight and governance checks passed; generated OpenAPI and all eight
generated documents were current. Targeted formatting and diff-scope validation
are checked before publication. No full build was
repeated for this evidence-only heartbeat. At collection HEAD, GitHub Quality run
34189347170 completed with the quality job successful and database-pgtap failed;
the checkpoint does not clear that separate CI gate or authorize its successor.
