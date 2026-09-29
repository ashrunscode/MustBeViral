# Replacement observation — fourth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T07:55:45.206Z**. Collection ran **07:56:46.684Z–07:59:27.800Z**.
Collection HEAD: `8a0d9073b1ec8ea74eb735928c8e8a62a0ccacad`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

No new service incident was observed. Both browser denials rendered, but retained
server records corroborated only the quote path. This is a supplemental
checkpoint with partial telemetry, not a passed daily capture or observation.

## Sequential database reads

All reads explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds below use
the client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 07:56:46.684–07:56:58.398 | 1 user; 1 session; 5 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 07:56:58.614734Z |
| S2             | 07:56:58.398–07:56:59.737 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 07:56:59.737–07:57:00.895 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 07:57:00.895–07:57:03.204 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 07:57:03.204–07:57:04.929 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 07:57:04.930–07:57:06.268 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 07:57:06.268–07:57:07.772 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 07:57:07.772–07:57:09.991 | 5 total; 4 revoked; 1 active; 1 distinct session; database timestamp 07:57:10.186112Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 07:00:30.401314Z before these probes.

Post-probe S2 again returned zero for all 27 tables within
07:58:37.317Z–07:58:50.153Z. The accompanying Auth aggregate at database timestamp
**07:58:50.26931Z** returned 1 user, 1 session, 5 total refresh tokens, 4 revoked,
1 active and 1 distinct session. These counts were unchanged during the probes.
Historical revoked tokens do not establish additional active sessions.
Password-reset completion is not inferred. Database reads establish snapshots.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 07:56:47.9285623 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 227877c5-52a7-455c-8000-4a2b159a1ef4; client elapsed 340 ms |
| 07:56:48.0371123 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 2ae320d6-6f0f-44f2-aca4-3c2bd2059603; client elapsed 34 ms                                                           |
| 07:56:48.2787336 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 240 ms                                                                                     |
| 07:56:48.8936062 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 07:56:51.2311307 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 07:56:51.3695371 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 07:56:54.6541102 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 07:56:54.8830513 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 07:56:54.8830513 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 07:56:57.9608191 | R2 custom domains                   | None                                                                                                                                                      |
| 07:56:58.2145303 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names were projected from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95 or capacity evidence.

DNS reads at 07:56:49.0733806Z–07:56:49.2877545Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser and server telemetry

The existing owner browser rendered both supported zero-UUID denials from the
recovery procedure during **07:57:29.474Z–07:58:12.614Z**:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

Observed network responses totaled 75: 73 HTTP 200 and two HTTP 403, one for each
canvas and quotes-child Core proxy path. Of these, 32 were RSC requests and
**zero observed RSC responses were 503**. Three loading failures were canceled
`net::ERR_ABORTED`. The first event page was truncated; the second was not; both
reported `hasMore=false`. These are observed counts, not exhaustive edge traffic.

Network capture was disabled and `/studio/continue` rendered successfully.
The same tab and session were retained. Normal application navigation updated
only the browser's local workflow-step record; no fixture, canvas, quote or run
was saved. No credentials, cookies, headers, session IDs or signed URLs were
retained.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.

For **03:18:11Z–07:58:37.317Z**, no runtime-error clusters were returned. The
status histogram showed 163 HTTP 200 and 6 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
provider counts are separate from browser events.

The first 403-by-path query for **07:56:46.684Z–07:58:37.317Z** returned no rows.
One later query extended the end to **07:59:25.903Z** and returned one quote path;
it completed at 07:59:27.800Z. The canvas 403 observed in the browser remains
uncorroborated in retained server records for this checkpoint. Missing records
are not treated as zero requests or a service failure. The reporting gap's cause
is UNKNOWN. No further retry was performed.

## Disposition and verification

Gates, deployments, private storage and zero tenant/money counts remained
consistent with the baseline. No deployment, configuration, DNS, signup, sending,
customer/provider or payment mutation was performed. Observation acceptance and
the separate actual owner traffic ruling remain pending; closing sign-out stays
deferred. The original September 4–7 window remains NOT PROVEN.

Next action: continue scheduled checks. Day one is due September 9
**01:18:11–05:18:11Z**; day two uses the same window September 10. Closing is due
September 11 **03:18:11–05:18:11Z**, never before 72 hours from the replacement
anchor.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34197588821 succeeded. Quality run 34197588782 failed only in database-pgtap
(job 101968675827); general quality job 101968675578 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This checkpoint does not clear the separate CI gate or authorize its successor.
