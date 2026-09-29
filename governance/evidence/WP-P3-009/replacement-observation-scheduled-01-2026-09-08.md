# Replacement observation — first scheduled execution

Packet: `WP-P3-009`, current step `p3i-003-private-72-hour-observation`.
Collection HEAD: `82f7b437b80b06cfd310d01d9c5c790f114792d8`, branch
`codex/viralgraph-cleanroom`, one clean worktree. Node 24.18.0 / pnpm 11.12.0.
`pnpm agent:preflight` passed; the packet and observation remain applicable.

The heartbeat `mustbeviral-private-v2-observation` triggered this task at
**2026-09-08T04:52:11.465Z**. This proves an actual scheduled execution, unlike
the prior manual hour-one continuation. Aggregate/provider collection ran
**04:54:15Z–04:59:50Z**, with preceding browser connection attempts after preflight.
The entire run's capture work remained below 30 minutes.

This is an optional supplemental checkpoint. It is **partial** because browser
control timed out; it does not pass a required daily capture or the 72-hour window.
The original September 4–7 window remains NOT PROVEN. Replacement acceptance is
pending, with the same September 8 03:18:11Z anchor.

## Database and disabled behavior

S1–S7 and refresh-token aggregates used the explicitly targeted connector for
Supabase `jjgtlfblsfobdhmtngbz`. Independent point-in-time queries ran concurrently;
these are not a transaction or continuous knowledge between reads.
The 27-table S2 enumeration is recorded in
`replacement-observation-hour-01-2026-09-08.md`. Required daily captures must follow
the external spec's sequential read order and retain individual capture times.

| Check                                    | Observed result                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| S1, server 04:54:21.047288Z              | 1 user, 1 session, 3 refresh-token rows, 0 flow-state rows, 1 identity, 1 non-null password field                |
| Session metadata                         | Sign-in September 4 21:19:38.051408Z; session created 21:19:38.052003Z; latest touch September 8 04:19:21.56888Z |
| Token aggregate, server 04:54:25.910275Z | 3 total; 2 revoked; 1 active; 1 distinct session                                                                 |
| S2                                       | All 27 tenant/money/machine tables enumerated in the hour-one checkpoint remain zero                             |
| S2 recheck after browser attempts        | All 27 tables still zero, within this collection window                                                          |
| S3                                       | Providers 4; price catalogs 2; model routes 5; route prices 8                                                    |
| S4                                       | Signup, charging, generation, provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00    |
| S5                                       | 31 public tables; zero RLS-disabled; zero not forced; 2 with no policies                                         |
| S6                                       | Migration head 20260902154759, 20260902000000, 20260831140000                                                    |
| S7                                       | Zero anonymous public-table grants                                                                               |

The session touch is consistent with the previous 04:19 browser activity.
Revoked token history does not indicate an additional active session.
Password-reset completion is not inferred. No owner identifiers, token contents,
session IDs, passwords or customer rows were collected.

## HTTP, storage and deployed configuration

| UTC capture      | Check                               | Result                                                                                                                                                  |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04:55:59.4272735 | Core health                         | 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 8d7cef94-2774-4cad-9212-7d58d105449f; client elapsed 375 ms    |
| 04:55:59.5141130 | Unsigned zero-UUID artifact content | 401 UNAUTHENTICATED; request ID 0f86909e-bfad-47bf-be70-a1219d208a9d; client elapsed 36 ms                                                              |
| 04:55:59.7445449 | Anonymous protected Vercel alias    | 302 to vercel.com; redirect query omitted; client elapsed 226 ms                                                                                        |
| 04:56:00.5139415 | Auth allowlist projection           | disable_signup=true; mailer_autoconfirm=false                                                                                                           |
| 04:56:04.5384098 | Worker deployments                  | Same newest deployment ee26c70e-9be5-4406-a5af-ceec2897f42a, created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 04:56:05.0389117 | R2 bucket information               | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                         |
| 04:56:10.0459639 | Active version flag projection      | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                       |
| 04:56:10.8760629 | R2 public access                    | r2.dev disabled                                                                                                                                         |
| 04:56:15.5925695 | R2 custom domains                   | None                                                                                                                                                    |
| 04:56:16.1239510 | Worker version history              | Eight versions; same newest version; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                          |
| 04:59:09.9637635 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY, CONFIRMATION_SIGNING_KEY, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY                                                    |

Wrangler reads used pinned 4.110.0 and the exact production Worker. Its separate
secret-list output did not parse reliably: an initial empty projection is **not**
evidence that secrets disappeared. A retry was unavailable; the final explicit
JSON-format call exited 0 but its 674-character response was not parseable by the
wrapper. Raw output was not retained. The four names above were instead freshly
verified from the active version's `secret_text` binding metadata. No secret
values or other binding values were retained.

DNS A reads at 04:56:00.6918067Z–04:56:00.9083663Z returned api.mustbeviral.com
NXDOMAIN (status 3), and apex/www addresses 104.21.6.198 and 172.67.135.59. These
answers do not prove hidden proxied CNAME targets. Client elapsed times are not
Worker p95 or capacity measurements.

## Vercel and browser coverage

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remains READY, production, with its same two vercel.app aliases.
No deployments created after the replacement anchor were returned.

For **03:18:11Z–04:57:35.692Z**, runtime errors returned no clusters. The deployment
status histogram returned 41 HTTP 200 and 2 HTTP 403, but reported three distinct
values while showing only two; the omitted category remains UNKNOWN.

A separate retained-403 path query from 04:18:11Z returned one absent-canvas path
and one `/quotes` child path. This supplies the previously missing retained
corroboration for the **earlier manual probes**. It does not prove fresh browser
probes in this scheduled run.

The retained Studio tab was listed at `/studio/continue`, but two CUA selection
attempts and the documented browser fallback timed out. The reported failure
was the browser-control `Emulation.setFocusEmulationEnabled` command, not an
application HTTP response. The existing tab was marked for handoff successfully.
No browser restart, replacement login, credential extraction or fixture creation
was attempted.

Fresh rendered-page outcomes, corresponding scheduled-run canvas/quote denials,
RSC request counts and RSC-prefetch 503 counts are **UNAVAILABLE**, not zero.
No scheduled-run quote was submitted. Provider/database evidence remains
consistent with containment, but cannot substitute for these browser checks.

## Disposition and next capture

No observed production deployment, disabled-gate, storage, tenant or money drift.
The browser-control failure is a new collection gap. No deployment, migration,
DNS change, sending, signup, provider activity, payment or customer admission was
performed. Closing sign-out remains deferred to the closing session check.

The next scheduled run should retry browser access. Required day-one capture is
September 9 **01:18:11–05:18:11Z**; day two uses that window September 10. Closing
is September 11 **03:18:11–05:18:11Z**, never before 72 elapsed hours. An optional
partial hourly checkpoint alone does not fail that future required observation.
The separate owner traffic ruling remains pending and the successor stays inactive.

Completed validation for this evidence-only checkpoint: pinned preflight passed,
targeted Prettier passed, governance checks passed, and generated OpenAPI plus
all eight generated documents were current. Independent read-only review passed
for a partial supplemental checkpoint; this note incorporates its evidence-clarity
recommendations. Formatting and diff scope are checked again before publication.
Full builds were not repeated, as the heartbeat directs for routine observation.
Earlier local verification and the separately recorded failed database CI are
historical results; this checkpoint does not change either outcome.
