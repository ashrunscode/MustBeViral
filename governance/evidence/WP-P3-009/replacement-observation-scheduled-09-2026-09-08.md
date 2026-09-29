# Replacement observation — ninth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T15:25:16.895Z**. Collection ran **15:29:05.125Z–15:36:29.927Z**.
Collection HEAD: `264c7fb622ef89245dff5f1e3c86aa49c207132f`, clean branch
`codex/viralgraph-cleanroom`, one worktree. Node 24.18.0 / pnpm 11.12.0.
Preflight confirmed `WP-P3-009 / p3i-003-private-72-hour-observation`; required
authority documents were unchanged from their previously read state.

Browser inspection became unavailable. This is a **partial supplemental
checkpoint**: current browser renderings, response totals and RSC outcomes are
UNKNOWN. Database, deployed gates and private storage remained consistent with
the baseline. No new service incident was observed in the available evidence;
the browser gap prevents a complete browser assessment.

The preceding scheduled trigger was 11:59:49.690Z. The roughly 3-hour-25-minute
trigger gap is disclosed without inventing a cause or backdating captures. An
optional hourly gap alone does not fail the window. Required daily captures and
observation acceptance remain pending.

## Sequential database reads

All queries explicitly targeted Supabase `jjgtlfblsfobdhmtngbz`. Bounds use the
client UTC clock; labeled database timestamps may differ slightly.

| Check          | Client UTC bounds         | Result                                                                                                                                 |
| -------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 15:29:05.126–15:29:25.646 | 1 user; 1 session; 9 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 15:29:25.983813Z |
| S2             | 15:29:25.646–15:29:29.223 | All 27 tenant/money/machine tables zero                                                                                                |
| S3             | 15:29:29.223–15:29:32.805 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                          |
| S4             | 15:29:32.805–15:29:36.084 | Signup, charging, generation and provider routes false; updated_at unchanged at 2026-09-02T15:47:59.474991+00:00                       |
| S5             | 15:29:36.084–15:29:39.580 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                     |
| S6             | 15:29:39.580–15:29:43.221 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                          |
| S7             | 15:29:43.222–15:29:47.770 | 0 anonymous public-table grants                                                                                                        |
| TokenAggregate | 15:29:47.770–15:29:52.730 | 9 total; 8 revoked; 1 active; 1 distinct session; database timestamp 15:29:53.080982Z                                                  |

The exact 27-table enumeration is in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 12:01:23.679891Z before these probes.

Post-attempt S2 returned zero for all 27 tables within
15:35:41.624Z–15:35:54.487Z. The accompanying Auth aggregate, collected within
15:35:41.624Z–15:35:55.974Z, had database timestamp **15:35:56.26835Z** and
returned 1 user, 1 session, 10 total refresh tokens, 9 revoked, 1 active and
1 distinct session. This is consistent with rotation of the same session;
neither a second active session nor password-reset completion is inferred.
These are snapshots, not continuous database reads.

## HTTP, storage and deployed gates

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15:29:08.1450159 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 273f57d0-89de-449b-9505-3805fa6a94a0; client elapsed 820 ms |
| 15:29:08.4399840 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 80180bca-5c5f-4fbb-905f-ffa392f95ac9; client elapsed 43 ms                                                           |
| 15:29:08.7583694 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 310 ms                                                                                     |
| 15:29:09.7143858 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 15:29:43.3606896 | R2 bucket                           | mustbeviral-v2-production-media; 0 objects; 0 B                                                                                                           |
| 15:29:43.5616039 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 15:29:49.6290482 | R2 public access                    | r2.dev disabled                                                                                                                                           |
| 15:29:49.9636974 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 15:29:49.9636974 | Active version secret-binding names | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 15:29:56.1157668 | R2 custom domains                   | None                                                                                                                                                      |
| 15:29:56.6287347 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names came from the active version's
`secret_text` metadata; no secret values or separate secret-list success are
claimed. Timings are client elapsed values, not Worker p95, an SLO result or
capacity evidence.

DNS reads at 15:29:10.0785489Z–15:29:11.3727513Z returned api.mustbeviral.com
NXDOMAIN (status 3); apex/www A answers were 104.21.6.198 and 172.67.135.59.
Proxied A answers do not prove hidden CNAME targets.

## Browser gap and retained telemetry

The existing owner tab was present at `/studio/continue` before the attempted
probe batch. That batch timed out after 30 seconds and reset the automation
kernel without partial acknowledgements. Its individual operations, including
network enable and navigation completion, cannot be claimed successful.

After reconnecting to the same Chrome profile, tab inventory showed the same
tab at the supported zero-UUID canvas URL. The tab was successfully marked for
handoff. A separate DOM snapshot returned `Debugger unattached`. A bounded
`Network.disable` cleanup attempt also returned `Debugger unattached` after
reading the supported CDP instructions. **Network cleanup was not acknowledged.**
Return to Continue was not verified. The retained tab was preserved; no new
login or browser restart was performed.

No fresh canvas or quote rendering, browser HTTP-response count, RSC-503 count,
or complete event coverage is asserted. Earlier checkpoint browser results are
not reused as current evidence. No tenant fixture, canvas, quote or run was
saved. No credentials, cookies, headers, session IDs or signed URLs were retained.

Vercel reads targeted project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment `dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.
The deployment remained READY, production, with the same two vercel.app aliases.
No deployments created after the September 8 03:18:11Z anchor were returned.
These provider reads completed within 15:35:43.545Z–15:35:52.313Z.

For **03:18:11Z–15:35:41.623Z**, no runtime-error clusters were returned. The
status histogram showed 331 HTTP 200 and 17 HTTP 403, while reporting three
distinct categories and displaying only two. The omitted category is UNKNOWN;
these are retained provider records, not complete edge telemetry.

The anchor-to-query 403 path totals were nine canvas and eight quotes-child
records. One bounded checkpoint-only query for
**15:29:05.125Z–15:36:25.785Z**, completed at **15:36:29.927Z**, returned one
canvas 403. It returned no quote record. This corroborates one retained server
denial in this checkpoint but does not prove browser rendering or attribute
every request to a particular client. Missing records are not treated as zero
requests. No further retry was performed.

## Disposition and verification

Available gates, deployment, storage and database evidence remained consistent
with containment. No deployment, configuration, DNS, signup, sending,
customer/provider or payment mutation was performed. Observation acceptance and
the separate actual owner traffic ruling remain pending; closing sign-out stays
deferred. The original September 4–7 window remains NOT PROVEN.

Next action: continue scheduled checks and retry browser inspection in the next
checkpoint. Day one is due September 9 **01:18:11–05:18:11Z**; day two uses that
window September 10. Closing is due September 11 **03:18:11–05:18:11Z**, never
before 72 hours from the replacement anchor.

Pinned preflight, same-next-action handoff, targeted formatting, governance,
generated-output and scoped-diff checks passed before publication. No full build
was repeated for this evidence-only checkpoint. At collection HEAD, Governance
run 34224174322 succeeded. Quality run 34224174256 failed only in database-pgtap
(job 102054128118); general quality job 102054128441 succeeded. Detailed failed
logs were not reread, so exact error equivalence to prior runs is not asserted.
This partial checkpoint does not clear the separate CI gate or authorize its
successor.
