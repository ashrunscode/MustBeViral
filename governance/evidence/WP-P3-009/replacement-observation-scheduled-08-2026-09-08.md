# Replacement observation — eighth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T11:59:49.690Z**. Collection ran **12:00:49.804Z–12:03:09.181Z**.
Collection HEAD: `a7c4fc600dcfae45e16b92aaf3a630c373084409`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

Both fresh browser denials rendered and their HTTP 403 responses were observed.
Retained server records corroborated only the quote path. No new service incident
or containment drift was observed. This is supplemental evidence with partial
telemetry, not a passed daily capture or completed observation window.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 12:00:49.804–12:01:03.442 | 1 user; 1 session; 8 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 12:01:03.760663Z |
| S2             | 12:01:03.442–12:01:04.757 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 12:01:04.757–12:01:05.924 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 12:01:05.924–12:01:07.075 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 12:01:07.075–12:01:08.217 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 12:01:08.217–12:01:09.423 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 12:01:09.423–12:01:10.651 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 12:01:10.651–12:01:11.882 | 8 total; 7 revoked; 1 active; 1 distinct session; database timestamp 12:01:12.251076Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 10:59:51.486823Z before these probes.

Post-probe S2 returned zero for all 27 tables within
12:02:34.192Z–12:02:47.011Z. The accompanying Auth aggregate at database timestamp
**12:02:47.380072Z** returned 1 user, 1 session, 9 total refresh tokens, 8 revoked,
1 active and 1 distinct session. The additional revoked token is consistent with
rotation of the same session, not a second active session. Password-reset
completion is not inferred. These are snapshots, not continuous database reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12:00:52.1786615 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID fddd2b32-2ef2-4cf6-85f5-01cc5c64462c; client elapsed 303 ms |
| 12:00:52.2900496 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 6a6abc24-dea6-4130-882f-f5d66bb4d5c8; client elapsed 37 ms                                                           |
| 12:00:52.4944161 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 202 ms                                                                                     |
| 12:00:54.2702199 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 12:00:58.1340728 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 12:00:58.1643782 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 12:01:01.4167387 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 12:01:01.6741418 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 12:01:01.6741418 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 12:01:04.6505867 | R2 custom domains                   | None                                                                                                                                                      |
| 12:01:04.8292809 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95 or capacity evidence.

DNS reads at 12:00:54.5369487Z–12:00:54.8047828Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser and retained telemetry

The existing owner tab rendered Continue before the probes. Fresh network capture
ran **12:01:21.825Z–12:02:03.113Z**, covering normal navigation to the supported
zero-UUID canvas and quote URLs in the recovery procedure. Both rendered:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

Observed responses totaled 75: 73 HTTP 200 and two HTTP 403, one for each canvas
and quotes-child Core proxy path. Of these, 32 were RSC requests and **zero
observed RSC responses were 503**. One loading failure was canceled
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

For **03:18:11Z–12:02:34.192Z**, no runtime-error clusters were returned. The
status histogram showed 314 HTTP 200 and 15 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
provider counts are separate from browser events.

The initial 403-by-path query for **12:00:49.804Z–12:02:34.192Z** returned one
quote path. One later query extended the end to **12:03:07.074Z** and still
returned only that quote path; it completed at 12:03:09.181Z. The canvas 403
observed in the browser remains uncorroborated by retained server records in this
checkpoint. Missing records are not treated as zero requests or a service
failure. The reporting gap's cause is UNKNOWN. No further retry was performed.

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
run 34218709251 succeeded. Quality run 34218709325 failed only in database-pgtap
(job 102036506381); general quality job 102036506545 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This checkpoint does not clear the separate CI gate or authorize its successor.
