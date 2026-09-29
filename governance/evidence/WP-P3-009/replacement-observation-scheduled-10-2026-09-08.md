# Replacement observation — tenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T16:27:09.430Z**. Collection ran **16:28:26.194Z–16:30:30.992Z**.
Collection HEAD: `8fda8aa65bd7301c3d84afca19217da1c3fefa0b`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`.
Required authority documents were unchanged from their previously read state.

This is a **partial supplemental checkpoint**. Browser control timed out twice;
fresh rendered denials, browser response totals and RSC outcomes are UNKNOWN.
Available database, service, storage and deployment evidence remained consistent
with containment. No new service incident was observed in those available reads.
The browser gap prevents a complete browser assessment.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                  |
| -------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 16:28:26.197–16:28:38.723 | 1 user; 1 session; 10 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 16:28:39.121149Z |
| S2             | 16:28:38.723–16:28:40.481 | All 27 tenant/money/machine tables zero                                                                                                 |
| S3             | 16:28:40.481–16:28:41.668 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                           |
| S4             | 16:28:41.668–16:28:42.851 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                        |
| S5             | 16:28:42.851–16:28:44.636 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                      |
| S6             | 16:28:44.637–16:28:46.007 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                           |
| S7             | 16:28:46.008–16:28:47.738 | 0 anonymous public-table grants                                                                                                         |
| TokenAggregate | 16:28:47.738–16:28:48.988 | 10 total; 9 revoked; 1 active; 1 distinct session; database timestamp 16:28:49.318832Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 15:30:34.150126Z before the browser attempt.

Post-attempt S2 returned zero for all 27 tables within
16:30:19.074Z–16:30:29.878Z. The accompanying Auth aggregate, collected within
16:30:19.074Z–16:30:30.991Z, had database timestamp **16:30:31.413734Z** and
returned 1 user, 1 session, 10 total refresh tokens, 9 revoked, 1 active and
1 distinct session. Counts were unchanged from the initial aggregate. Historical
revoked tokens do not establish another active session. Password-reset completion
is not inferred. These are snapshots, not continuous database reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 16:28:29.1985028 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID cc860569-91da-4a33-94ee-97e3f2b65a4a; client elapsed 799 ms |
| 16:28:29.5336258 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 092548e8-70fc-41ef-9de8-2bd8b40b998b; client elapsed 167 ms                                                          |
| 16:28:29.9482044 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 411 ms                                                                                     |
| 16:28:31.0868473 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 16:28:36.6856390 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 16:28:36.7392992 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 16:28:44.3886620 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 16:28:44.4994009 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 16:28:44.4994009 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 16:28:53.6899812 | R2 custom domains                   | None                                                                                                                                                      |
| 16:28:54.1062549 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95, an SLO result or
capacity evidence.

DNS reads at 16:28:31.4228521Z–16:28:31.7248487Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser gap and retained telemetry

The existing Chrome browser inventory showed a MustBeViral Studio tab at the
supported zero-UUID canvas URL. Its tab identifier differed from the preceding
checkpoint; that alone does not establish a different authenticated session.

Getting this tab and marking it for handoff timed out after 10 seconds, resetting
the automation kernel without an acknowledgement. One bounded recovery using
the documented tab-selection API with that exact browser/tab also timed out
after 15 seconds and reset the kernel. No further browser retry was performed.
No fresh rendering, navigation completion or handoff acknowledgement is claimed.

No current network-enable operation was acknowledged. The earlier network-cleanup
gap remains unresolved; cleanup and return to Continue were not verified here.
This run did not create a browser tab, restart the browser, perform a new login,
or save a tenant fixture, canvas, quote or run. Credentials, cookies, headers,
session IDs and signed URLs were not collected. Browser HTTP-response counts,
RSC-prefetch 503 counts and event coverage remain UNKNOWN.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.
These provider reads completed within 16:30:23.014Z–16:30:28.739Z.

For **03:18:11Z–16:30:19.074Z**, no runtime-error clusters were returned. The
status histogram showed 331 HTTP 200 and 17 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
these retained counts do not establish complete edge telemetry.

The checkpoint-only 403 path query for **16:28:26.194Z–16:30:19.074Z** returned
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

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34246217338 succeeded. Quality run 34246217227 failed only in database-pgtap
(job 102128762356); general quality job 102128762103 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This partial checkpoint does not clear the separate CI gate or authorize its
successor.
