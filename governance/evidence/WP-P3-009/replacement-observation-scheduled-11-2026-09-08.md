# Replacement observation — eleventh scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T17:28:20.024Z**. Collection ran **17:29:24.325Z–17:32:00.859Z**.
Collection HEAD: `966006beb9bc163019f6c04a564d820b577e1a6d`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`;
required authority documents were unchanged from their previously read state.

This is a **partial supplemental checkpoint**. Reconnecting through the live
browser-tab inventory succeeded, but the subsequent handoff/page-inspection batch
timed out. Fresh rendered denials, browser response totals and RSC outcomes remain
UNKNOWN. Available database, service, storage and deployment evidence remained
consistent with containment. No new service incident was observed in those reads;
the browser gap prevents a complete browser assessment.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                  |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 17:29:24.325–17:29:37.440 | 1 user; 1 session; 10 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 17:29:37.888226Z |
| S2             | 17:29:37.440–17:29:38.580 | All 27 tenant/money/machine tables zero                                                                                                 |
| S3             | 17:29:38.580–17:29:40.036 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                           |
| S4             | 17:29:40.036–17:29:41.361 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                        |
| S5             | 17:29:41.361–17:29:42.776 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                      |
| S6             | 17:29:42.776–17:29:44.226 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                           |
| S7             | 17:29:44.226–17:29:45.896 | 0 anonymous public-table grants                                                                                                         |
| TokenAggregate | 17:29:45.896–17:29:47.733 | 10 total; 9 revoked; 1 active; 1 distinct session; database timestamp 17:29:48.095909Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 15:30:34.150126Z before the browser attempt.

Post-attempt S2 returned zero for all 27 tables within
17:31:43.815Z–17:31:55.046Z. The accompanying Auth aggregate, collected within
17:31:43.817Z–17:32:00.859Z, had database timestamp **17:32:01.285903Z** and
returned 1 user, 1 session, 10 total refresh tokens, 9 revoked, 1 active and
1 distinct session. Counts were unchanged from the initial aggregate. Historical
revoked tokens do not establish another active session. Password-reset completion
is not inferred. These are snapshots, not continuous database reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 17:29:27.2294268 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 6ff254d9-607f-49e5-8d82-088e3901ae75; client elapsed 650 ms |
| 17:29:27.5496860 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 873995cd-1e8b-40c0-9c60-27f628071f31; client elapsed 131 ms                                                          |
| 17:29:27.9287865 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 375 ms                                                                                     |
| 17:29:28.7566163 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 17:29:38.0275315 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 17:29:38.1107057 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 17:29:47.5669738 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 17:29:47.8555638 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 17:29:47.8555638 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 17:29:55.0088657 | R2 custom domains                   | None                                                                                                                                                      |
| 17:29:55.8543304 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95, an SLO result or
capacity evidence.

DNS reads at 17:29:29.1222337Z–17:29:29.4756830Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser recovery attempt and retained telemetry

The browser inventory showed the existing observation tab at the supported
zero-UUID canvas URL. After reading the supported troubleshooting procedure, the
live user-tab list confirmed that same tab and supplied its current provider
reference. Claiming that exact returned tab succeeded in about 10.2 seconds.
The subsequent handoff-and-DOM-snapshot batch timed out after 15 seconds and reset
the automation kernel without a partial acknowledgement. Neither a current
handoff mark nor fresh page rendering is proven. No further browser retry was
performed in this checkpoint.

No fresh probe navigation or network-enable operation was acknowledged. The
earlier network-cleanup gap remains unresolved; cleanup and return to Continue
were not verified here. No browser tab was created or closed, browser restarted,
new login performed, or tenant fixture, canvas, quote or run saved. Credentials,
cookies, headers, session IDs and signed URLs were not collected. Browser
HTTP-response counts, RSC-prefetch 503 counts and event coverage remain UNKNOWN.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.
These provider reads completed within 17:31:45.875Z–17:31:53.730Z.

For **03:18:11Z–17:31:43.811Z**, no runtime-error clusters were returned. The
status histogram showed 331 HTTP 200 and 17 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
these retained counts do not establish complete edge telemetry.

The checkpoint-only 403 path query for **17:29:24.325Z–17:31:43.811Z** returned
no rows. This provides no fresh server corroboration for the supported probes.
Missing records are not treated as zero requests or proof of a service failure.
Earlier browser or retained-server denials are not reused as current evidence.

## Disposition and verification

Available gates, deployment, storage and database evidence remained consistent
with containment. No deployment, configuration, DNS, signup, sending,
customer/provider or payment mutation was performed. Observation acceptance and
the separate actual owner traffic ruling remain pending; closing sign-out stays
deferred. The original September 4–7 window remains NOT PROVEN.

Next action: continue scheduled checks and retry browser inspection in the next
checkpoint. Day one is due September 9 **01:18:11–05:18:11Z**; day two uses that
window September 10. Closing is due September 11 **03:18:11–05:18:11Z**, never
before 72 hours from the replacement anchor. This optional checkpoint does not
pass a required daily capture.

The initial handoff was interrupted after collection. The 19:55Z heartbeat
recovered the authority transition without backdating this evidence, then ran
preflight, same-next-action handoff, formatting, governance, generated-output
and scoped-diff checks before the local commit. This record is held from push
under the new CI cost rules; see checkpoint 12. No full build was repeated.
At collection HEAD, Governance
run 34251927653 succeeded. Quality run 34251927661 failed only in database-pgtap
(job 102148185397); general quality job 102148185726 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This partial checkpoint does not clear the separate CI gate or authorize its
successor.
