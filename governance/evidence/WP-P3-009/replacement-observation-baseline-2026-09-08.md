# Replacement private observation baseline

**Actual start: 2026-09-08T03:18:11Z. Earliest close: 2026-09-11T03:18:11Z.**

This is a new window under current WP-P3-009 p3i-003, using the same authorized
owner session, production targets and disabled behavior. It does not backdate or
pass the original September 4–7 window. Observation acceptance remains pending.
No additional owner approval is required for these already authorized reads; the
separate traffic decision still requires the owner's explicit ruling.

## Timestamped baseline

Checkout: `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`, recovered HEAD
`8578e9353d15d9539ab9c9010706ce3e7bce2a4e`. No implementation files changed.
Supabase reads explicitly targeted `jjgtlfblsfobdhmtngbz` through its connector.

| UTC capture      | Check                         | Result                                                                                                                                                            |
| ---------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03:15:06.711766  | S1                            | 1 user, 1 session, 2 refresh-token rows, 0 flow-state rows, 1 identity, 1 non-null password field                                                                 |
| 03:15:06–08      | S2                            | All 27 tenant/money/machine tables listed in `private-observation-2026-09-08.md` have 0 rows                                                                      |
| 03:15:08–10      | S3                            | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                                                     |
| 03:15:10–13      | S4                            | Signup, generation, provider routes and charging false; unchanged update time 2026-09-02T15:47:59.474991+00:00                                                    |
| 03:15:13–15      | S5                            | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                                                |
| 03:15:15–16      | S6                            | Migration head 20260902154759, 20260902000000, 20260831140000                                                                                                     |
| 03:15:16–18      | S7                            | 0 anonymous public-table grants                                                                                                                                   |
| 03:15:19.012189  | Token aggregate               | Total 2; revoked 1; active 1; distinct sessions 1                                                                                                                 |
| 03:15:36.9285659 | Core health                   | HTTP 200; service `mustbeviral-core`; generation `viralgraph-cleanroom-v2`; status `ok`; request ID `fb1d2b68-f0a9-4a20-88e4-a840f32398e5`; client elapsed 317 ms |
| 03:15:36.9951852 | Unsigned artifact content     | HTTP 401 `UNAUTHENTICATED`; client elapsed 34 ms                                                                                                                  |
| 03:15–03:16      | Supported owner probes        | Absent-canvas view and quote view rendered permission-denied states; browser response records show HTTP 403 for each corresponding Core proxy path                |
| 03:16:23–25      | S2 after probes               | All 27 tables still 0                                                                                                                                             |
| 03:16:26.4728780 | Anonymous protected alias     | HTTP 302; redirect host `vercel.com`; redirect query omitted                                                                                                      |
| 03:16:33.9691655 | R2 bucket info                | `mustbeviral-v2-production-media`: 0 objects, 0 B                                                                                                                 |
| 03:16:37.6418787 | Worker versions               | 8 versions; newest `b832cca9-3dea-46d2-8313-eba80854c1ca`; containment `45077c66-f31e-4c30-8396-9300b8e27fe0` retained                                            |
| 03:16:41.3377135 | Worker secret names           | Four unchanged names, listed below                                                                                                                                |
| 03:17:08–09      | Vercel deployments            | No new deployment since September 4 21:22Z for exact production project/team                                                                                      |
| 03:17:09–11      | Vercel runtime errors         | No clusters returned for September 8 03:13–03:17Z                                                                                                                 |
| 03:17:11–13      | Vercel runtime histogram      | HTTP 200: 51; HTTP 403: 1; connector reports 3 distinct values but shows only 2, so coverage is partial                                                           |
| 03:17:14.5067414 | `api.mustbeviral.com` A       | NXDOMAIN, DNS status 3                                                                                                                                            |
| 03:17:14.6333444 | `www.mustbeviral.com` A       | 172.67.135.59 and 104.21.6.198                                                                                                                                    |
| 03:17:14.7696799 | `mustbeviral.com` A           | 104.21.6.198 and 172.67.135.59                                                                                                                                    |
| 03:17:39.5755572 | Auth configuration projection | `disable_signup=true`, `mailer_autoconfirm=false`                                                                                                                 |
| 03:17:44.8253895 | R2 public access              | `r2.dev` disabled                                                                                                                                                 |
| 03:17:50.8518857 | R2 custom domains             | None                                                                                                                                                              |
| 03:17:56.6221824 | Worker deployment             | `ee26c70e-9be5-4406-a5af-ceec2897f42a`, created September 2 16:36:09Z; newest version receives 100%                                                               |

Provider CLI timestamps are completion times. S2–S7 ranges bracket sequential
connector calls using the UTC clock. Browser time is bounded to the tool sequence,
not represented as an exact server request timestamp. The baseline reads took
about five minutes including the preceding browser prefetch capture.

Secret names only: `ARTIFACT_ACCESS_SIGNING_KEY`, `CONFIRMATION_SIGNING_KEY`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. The version-specific projection
at 02:59:11Z proved `PROVIDER_RUNS_ENABLED=false` and `QUEUES_ENABLED=false` on the
same version freshly confirmed active above. Local production configuration also
has no diff. No binding values other than these allowlisted flags were retained.

The Vercel checks used project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb` for
the histogram. The earlier recovery project read established READY and provider
domains only; the new deployment listing found no later deployment.

## Browser coverage and procedural corrections

From roughly 03:13–03:16Z, the existing owner browser rendered the blank brief,
absent-canvas denial and quote denial. Read-only browser network capture returned
81 response events: 79 HTTP 200 and 2 HTTP 403. Of those, 36 were RSC requests and
**0 observed RSC responses were 503**. Six loading failures were canceled
`net::ERR_ABORTED` events, not observed HTTP 503s. The initial event page was not
truncated; the later page reported truncation. These are counts seen, not a claim
that every request was retained. No form was saved, fixture created or run started.

The browser denial paths are the two supported paths documented in
`observation-recovery-procedure-2026-09-08.md`. A successful empty MCP context and
`POST /v1/quotes` returning `generation_disabled` are invalid expectations for the
implemented routes and this empty database. The observed permission denials prove
containment; they do not claim successful authorized canvas access or direct
execution of the generation-policy branch. This correction is documented openly
without weakening the accepted no-customer/no-spend containment criterion.

The same original session remains: sign-in September 4 21:19:38.051408Z, session
created 21:19:38.052003Z; latest touch September 8 02:46:59.706282Z. The extra
revoked refresh token is normal rotation, not a second session. Password-reset
completion remains unproven and is not inferred from the non-null password field.

## Required follow-through

- Day 1: September 9, 01:18:11–05:18:11Z, centered on 03:18:11Z.
- Day 2: September 10, 01:18:11–05:18:11Z, centered on 03:18:11Z.
- Closing day: September 11, 03:18:11–05:18:11Z, never before 72 hours elapsed.

The hourly observation automation supplies additional checkpoints and can perform
these daily captures. Its creation is verified; execution must be evidenced by
future runs. A missed optional hourly run alone does not fail the window. Record
every required daily capture, available telemetry and drift; evaluate the owner
session at the end, then evidence the deferred closing sign-out. The traffic
ruling remains separate. No successor, deployment or public traffic is authorized
by this baseline.
