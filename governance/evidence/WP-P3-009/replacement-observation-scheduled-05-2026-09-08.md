# Replacement observation — fifth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T08:56:46.429Z**. Collection ran **08:58:09.945Z–09:02:09.018Z**.
Collection HEAD: `02d6845860c79943aac25212225d17b595026843`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

This checkpoint is **PARTIAL**. The canvas denial rendered and was corroborated
by a retained server record. Quote rendering and browser response/RSC counts
remain UNKNOWN after a browser-control interruption. Provider/database checks
showed no new incident or containment drift; these do not fill the browser gap.
No required daily capture or observation acceptance is passed by this checkpoint.

## Sequential database reads

All reads explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds below use
the client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 08:58:09.945–08:58:22.930 | 1 user; 1 session; 5 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 08:58:23.152871Z |
| S2             | 08:58:22.930–08:58:24.178 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 08:58:24.178–08:58:25.294 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 08:58:25.294–08:58:26.442 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 08:58:26.442–08:58:27.630 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 08:58:27.630–08:58:28.797 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 08:58:28.797–08:58:30.004 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 08:58:30.005–08:58:31.224 | 5 total; 4 revoked; 1 active; 1 distinct session; database timestamp 08:58:31.484068Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 07:00:30.401314Z before these probes.

After the attempted quote navigation, S2 returned zero for all 27 tables within
09:01:56.700Z–09:02:09.018Z. The accompanying Auth aggregate at database timestamp
**09:02:05.956913Z** returned 1 user, 1 session, 6 total refresh tokens, 5 revoked,
1 active and 1 distinct session. The additional revoked token is consistent with
rotation of the same session. Password-reset completion is not inferred.
Database reads establish snapshots, not continuous knowledge between reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 08:58:13.2430166 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 561df0be-0811-451b-a480-1a2de3248ff6; client elapsed 336 ms |
| 08:58:13.3296755 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 91c451e9-df41-44f8-a4ec-da3867bf8cd2; client elapsed 37 ms                                                           |
| 08:58:13.5328047 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 201 ms                                                                                     |
| 08:58:14.5739483 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 08:58:14.9717098 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 08:58:15.3980829 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 08:58:17.9659968 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 08:58:17.9659968 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 08:58:18.5269233 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 08:58:21.2643610 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |
| 08:58:21.4909056 | R2 custom domains                   | None                                                                                                                                                      |

Wrangler 4.110.0 was pinned. Secret names were projected from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95 or capacity evidence.

DNS reads at 08:58:14.7015521Z–08:58:14.8811103Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser interruption and telemetry limits

The retained owner tab first rendered `/studio/continue`. Network observation
started at **08:58:46.557Z**, then the supported zero-UUID canvas page rendered
“Canvas unavailable / You do not have access to this canvas.”

The subsequent canvas event read reported `truncated=true`, `hasMore=false`.
Quote navigation then timed out. A read of current page state also timed out and
reset the browser-control session. A fresh browser inventory showed the retained
tab at the supported quote URL, but URL presence does not prove quote rendering.

Recovery reused the same Chrome profile and retained tab, without a browser
restart or new login. The documented troubleshooting guidance was read. An
accessibility read reported `Debugger unattached`; an explicit temporary network
capture cleanup attempt (`Network.disable`) reported the same state. Successful
cleanup acknowledgement is therefore not claimed. The browser debugger was
reported unattached, and no network results were recovered after the reset.

Response, failure and RSC-prefetch 503 counts are **UNKNOWN**, not zero. The
pre-reset event data was lost before aggregate projection. No browser HTTP 403
count or quote denial render is inferred from earlier checkpoints. No further
navigation was attempted. The retained tab was marked for handoff at the quote
URL; a return to Continue was not completed. No form, fixture, canvas, quote or
run was saved. No credentials, cookies, headers, session IDs or signed URLs were
retained.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.

For **03:18:11Z–09:01:56.700Z**, no runtime-error clusters were returned. The
status histogram showed 197 HTTP 200 and 9 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category remains
UNKNOWN; provider counts do not replace browser event evidence.

The 403-by-path query for **08:58:09.945Z–09:01:56.700Z** returned one canvas path
and no quote row. It corroborates the canvas denial only. Missing quote records
are not treated as zero requests or proof of a service failure. No extra runtime
query or repeat quote request was performed.

## Disposition and verification

Gates, deployments, private storage and zero tenant/money counts remained
consistent with the baseline. Browser coverage is incomplete. No deployment,
configuration, DNS, signup, sending, customer/provider or payment mutation was
performed. Observation acceptance and the separate actual owner traffic ruling
remain pending; closing sign-out stays deferred. The original September 4–7
window remains NOT PROVEN.

Next action: continue scheduled observation and retry the supported browser
checks from the retained tab at the next checkpoint. Day one is due September 9
**01:18:11–05:18:11Z**; day two uses that window September 10. Closing is due
September 11 **03:18:11–05:18:11Z**, never before 72 hours from the replacement
anchor. This optional hourly gap alone does not invalidate those future captures.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34202338835 succeeded. Quality run 34202338872 failed only in database-pgtap
(job 101983791638); general quality job 101983791385 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This checkpoint does not clear the separate CI gate or authorize its successor.
