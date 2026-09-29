# Replacement observation — seventh scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T10:58:18.721Z**. Collection ran **10:59:15.522Z–11:01:30.377Z**.
Collection HEAD: `01373e81e3e092266bf2755ebdc2d3f95af8a4d4`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

Both fresh browser denials rendered and their HTTP 403 responses were observed.
Retained server path queries returned no rows, so neither denial was corroborated
by those records in this checkpoint. No new service incident or containment drift
was observed. This is supplemental evidence with partial telemetry, not a passed
daily capture or a completed observation window.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 10:59:15.522–10:59:29.151 | 1 user; 1 session; 7 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 10:59:29.480548Z |
| S2             | 10:59:29.152–10:59:30.536 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 10:59:30.536–10:59:31.763 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 10:59:31.763–10:59:32.977 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 10:59:32.977–10:59:34.306 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 10:59:34.306–10:59:35.483 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 10:59:35.483–10:59:36.989 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 10:59:36.989–10:59:38.171 | 7 total; 6 revoked; 1 active; 1 distinct session; database timestamp 10:59:38.510107Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 09:57:17.217077Z before these probes.

Post-probe S2 returned zero for all 27 tables within
11:00:58.169Z–11:01:10.576Z. The accompanying Auth aggregate at database timestamp
**11:01:02.699912Z** returned 1 user, 1 session, 8 total refresh tokens, 7 revoked,
1 active and 1 distinct session. The additional revoked token is consistent with
rotation of the same session, not a second active session. Password-reset
completion is not inferred. These are snapshots, not continuous database reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10:59:18.1561194 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 5d7c70a2-4a18-4834-90bc-7b244f947bf8; client elapsed 386 ms |
| 10:59:18.2643453 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 582d9c4e-d2da-426d-b3f8-ff4c8962cbe3; client elapsed 43 ms                                                           |
| 10:59:18.4677591 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 198 ms                                                                                     |
| 10:59:19.5667830 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 10:59:24.1084595 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 10:59:24.1379913 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 10:59:26.9509359 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 10:59:27.1009265 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 10:59:27.1009265 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 10:59:29.9849647 | R2 custom domains                   | None                                                                                                                                                      |
| 10:59:30.2186213 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95 or capacity evidence.

DNS reads at 10:59:19.7369425Z–10:59:20.0928971Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser and retained telemetry

The existing owner tab rendered Continue before the probes. Fresh network capture
ran **10:59:49.630Z–11:00:27.067Z**, covering normal navigation to the supported
zero-UUID canvas and quote URLs in the recovery procedure. Both rendered:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

Observed responses totaled 75: 73 HTTP 200 and two HTTP 403, one for each canvas
and quotes-child Core proxy path. Of these, 32 were RSC requests and **zero
observed RSC responses were 503**. Five loading failures were canceled
`net::ERR_ABORTED`. The first event page was truncated; the second was not;
both reported `hasMore=false`. This is partial event coverage, not exhaustive
edge telemetry.

The network-disable command succeeded, and `/studio/continue` rendered afterward.
The same tab was marked for later checks. No new login or browser restart was
used. Normal navigation updated the browser's local workflow-step record; no
tenant fixture, canvas, quote or run was saved. No credentials, cookies, headers,
session IDs or signed URLs were retained.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.

For **03:18:11Z–11:00:58.169Z**, no runtime-error clusters were returned. The
status histogram showed 275 HTTP 200 and 12 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
provider counts are separate from browser events.

The initial 403-by-path query for **10:59:15.522Z–11:00:58.169Z** returned no
rows. One later query extended the end to **11:01:28.405Z** and again returned no
rows; it completed at 11:01:30.377Z. Neither browser denial was corroborated by
retained server path records in this checkpoint. Missing records are not treated
as zero requests or a service failure. The cause is UNKNOWN. No further retry
was performed.

## Disposition and verification

Gates, deployments, private storage and zero tenant/money counts remained
consistent with the baseline. No deployment, configuration, DNS, signup, sending,
customer/provider or payment mutation was performed. Observation acceptance and
the separate actual owner traffic ruling remain pending; closing sign-out stays
deferred. The original September 4–7 window remains NOT PROVEN.

Next action: continue scheduled checks. Day one is due September 9
**01:18:11–05:18:11Z**; day two uses that window September 10. Closing is due
September 11 **03:18:11–05:18:11Z**, never before 72 hours from the replacement
anchor.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34213391567 succeeded. Quality run 34213391551 failed only in database-pgtap
(job 102019393574); general quality job 102019393924 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This checkpoint does not clear the separate CI gate or authorize its successor.
