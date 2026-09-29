# Replacement observation — sixth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T09:57:17.520Z**. Collection ran **09:58:16.538Z–10:01:01.659Z**.
Collection HEAD: `f00510a59cf43e74e7842be8a1dbfcf44f7370a7`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

Browser control recovered using the same retained tab and owner session.
Both fresh denial pages rendered, network capture cleanup was acknowledged, and
Continue rendered afterward. The prior checkpoint's unverified browser data
remains unverified. This supplemental checkpoint has incomplete retained server
and network coverage; it does not pass a daily capture or the 72-hour observation.

## Sequential database reads

Every query explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 09:58:16.538–09:58:29.645 | 1 user; 1 session; 7 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 09:58:29.952203Z |
| S2             | 09:58:29.645–09:58:30.810 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 09:58:30.811–09:58:32.122 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 09:58:32.122–09:58:33.363 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 09:58:33.363–09:58:34.536 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 09:58:34.536–09:58:35.723 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 09:58:35.723–09:58:37.172 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 09:58:37.172–09:58:38.327 | 7 total; 6 revoked; 1 active; 1 distinct session; database timestamp 09:58:38.635721Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 09:57:17.217077Z before these probes.

Post-probe S2 again returned zero for all 27 tables within
10:00:08.983Z–10:00:30.292Z. The accompanying Auth aggregate at database timestamp
**10:00:28.179393Z** returned 1 user, 1 session, 7 total refresh tokens, 6 revoked,
1 active and 1 distinct session, unchanged from this checkpoint's initial read.
The additional historical revoked token since the previous checkpoint is
consistent with rotation of the same session; it is not evidence of a second
active session. Password-reset completion is not inferred. These are snapshots.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 09:58:18.6657870 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 2007f816-4e62-420f-be5f-2e6eef0ee4bc; client elapsed 325 ms |
| 09:58:18.7438619 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID c9b680fe-0b61-4b34-8592-5ffc28e5db0c; client elapsed 26 ms                                                           |
| 09:58:18.9625771 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 217 ms                                                                                     |
| 09:58:19.6020689 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 09:58:20.7146570 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 09:58:21.1652178 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 09:58:24.1500568 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 09:58:24.1500568 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 09:58:24.5695985 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 09:58:28.0296639 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |
| 09:58:28.3538766 | R2 custom domains                   | None                                                                                                                                                      |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95 or capacity evidence.

DNS reads at 09:58:19.7229022Z–09:58:19.9059709Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Recovered browser and retained telemetry

The existing tab initially displayed the quote-denial page left by the prior
checkpoint. That observation is not a new quote request. Fresh network capture
then ran from **09:58:54.887Z–09:59:44.961Z**, with normal navigation first to the
supported zero-UUID canvas URL and then the supported quote URL. Both rendered:

- Canvas unavailable / You do not have access to this canvas.
- Quote unavailable / You do not have permission to quote this canvas.

Observed responses totaled 75: 73 HTTP 200 and two HTTP 403, one for each canvas
and quotes-child Core proxy path. Of these, 32 were RSC requests and **zero
observed RSC responses were 503**. Three loading failures were canceled
`net::ERR_ABORTED`. The first event page was truncated; the second was not;
both reported `hasMore=false`. This is partial event coverage, not exhaustive
edge telemetry.

The network-disable command succeeded. The tab then returned to
`/studio/continue`, rendered successfully, and was marked for later checks.
No browser restart or new login was used. Normal navigation updated the browser's
local workflow-step record; no tenant fixture, canvas, quote or run was saved.
No credentials, cookies, headers, session IDs or signed URLs were retained.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.

For **03:18:11Z–10:00:08.983Z**, no runtime-error clusters were returned. The
status histogram showed 236 HTTP 200 and 11 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
provider counts are separate from browser events.

The initial 403-by-path query for **09:58:16.538Z–10:00:08.983Z** returned one
quote path. One later query extended the end to **10:00:59.592Z** and still
returned only that quote path; it completed at 10:01:01.659Z. The canvas 403
observed in the browser remains uncorroborated in retained server records for
this checkpoint. Missing records are not treated as zero requests or a service
failure. The reporting gap's cause is UNKNOWN. No further retry was performed.

## Disposition and verification

No new service incident or containment drift was observed. Gates, deployments,
private storage and zero tenant/money counts remained consistent with the
baseline. No deployment, configuration, DNS, signup, sending, customer/provider
or payment mutation was performed. Observation acceptance and the separate actual
owner traffic ruling remain pending; closing sign-out stays deferred. The
original September 4–7 window remains NOT PROVEN.

Next action: continue scheduled checks. Day one is due September 9
**01:18:11–05:18:11Z**; day two uses that window September 10. Closing is due
September 11 **03:18:11–05:18:11Z**, never before 72 hours from the replacement
anchor.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34208031240 succeeded. Quality run 34208031407 failed only in database-pgtap
(job 102002103206); general quality job 102002102937 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This checkpoint does not clear the separate CI gate or authorize its successor.
