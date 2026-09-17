# Replacement observation — twelfth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T19:55:28.277Z**. Fresh collection ran
**20:02:43.638Z–20:14:46.988Z**. Collection HEAD:
`966006beb9bc163019f6c04a564d820b577e1a6d`, branch
`codex/viralgraph-cleanroom`, one worktree. The preceding checkpoint-11 file
was still untracked after interruption; its original capture times were preserved.

The interrupted handoff left an authority-transition lock. No matching handoff
process remained. `pnpm agent:recover` rolled the interrupted transition back,
and pinned preflight then passed for `WP-P3-009 /
p3i-003-private-72-hour-observation`. Required authority documents were unchanged.
Node 24.18.0 / pnpm 11.12.0 were confirmed.

**Partial supplemental evidence:** browser denials recovered, while the S4
database-switch read returned unusable results. The current database switch
values and update time are UNKNOWN. Available endpoints, Worker gates, tenant
counts and deployments showed no observed drift. This is not complete evidence
of all containment controls and does not pass a required daily capture.

## Sequential database reads and S4 gap

The project-scoped connector used earlier was unavailable in this run. The
existing machine credential accessed only Supabase `jjgtlfblsfobdhmtngbz`
through its Management API, with `read_only=true` and the seven exact SQL blocks
from the execution spec; S1 additionally captured database time. The documented
[query endpoint](https://supabase.com/docs/reference/api/v1-run-a-query) supports
that flag. No alternate project's connector or credentials were used.

| Check          | Client UTC bounds                 | Result                                                                                                                                  |
| -------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 20:02:45.3788490–20:02:47.5138266 | 1 user; 1 session; 10 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database timestamp 20:02:47.592783Z |
| S2             | 20:02:47.5367850–20:02:48.5916178 | All 27 tenant/money/machine tables zero                                                                                                 |
| S3             | 20:02:48.5938861–20:02:49.3833942 | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                           |
| S4             | 20:02:49.3850551–20:02:50.1537453 | INVALID RESULT SHAPE: four catalog rows were returned; database kill switches UNKNOWN                                                   |
| S5             | 20:02:50.1596182–20:02:51.3935638 | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                      |
| S6             | 20:02:51.4112917–20:02:53.1554744 | Migration head 20260902154759, 20260902000000, 20260831140000                                                                           |
| S7             | 20:02:53.1577983–20:02:53.8772054 | 0 anonymous public-table grants                                                                                                         |
| TokenAggregate | 20:02:53.8777887–20:02:55.7761879 | 10 total; 9 revoked; 1 active; 1 distinct session; database timestamp 20:02:54.833741Z                                                  |

The initial S4 result duplicated S3's catalog-shaped rows. It was rejected as
evidence of the kill switches. Extraction of the exact S4 SQL was independently
checked: `select public.get_platform_kill_switches() as kill_switches;`.
An explicit retry at **20:03:29.2565573Z–20:03:30.1006276Z** returned no usable
value. A transport diagnostic at **20:07:46.3126938Z–20:07:47.1345383Z** also
produced no usable response or switch values. Its null status was cast to zero
in the diagnostic projection; that is **not an observed HTTP status code**.
Cause is UNKNOWN. No switch value, update time, successful S4 read or repair is
inferred, and the read-only guard was retained.

The exact S2 enumeration remains in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z, session creation 21:19:38.052003Z, and latest session touch
September 8 15:30:34.150126Z before browser probes.

Post-probe S2 at **20:11:46.6538355Z–20:11:47.7197581Z** returned all 27 counts
zero. Post-probe Auth at **20:11:47.7288273Z–20:11:48.6524275Z**, database time
**20:11:48.899518Z**, returned 1 user, 1 session, 11 total refresh tokens,
10 revoked, 1 active and 1 distinct session. This is consistent with rotation
of the retained session; a second active session or completed password reset
is not inferred. These are snapshots, not continuous reads.

## HTTP, Worker, storage and DNS

| UTC completion   | Check                               | Result                                                                                                                                                    |
| ---------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20:02:47.8672137 | Core health                         | HTTP 200; service mustbeviral-core; generation viralgraph-cleanroom-v2; status ok; request ID 61364642-3afd-42a7-be75-3a4864c292c3; client elapsed 733 ms |
| 20:02:48.2805667 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request ID 3e1ee86f-f471-4546-afb0-b53f071fefdb; client elapsed 114 ms                                                          |
| 20:02:48.6589462 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client elapsed 364 ms                                                                                     |
| 20:02:50.6595600 | Auth configuration projection       | disable_signup=true; mailer_autoconfirm=false                                                                                                             |
| 20:03:00.0999970 | Active Worker deployment            | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100%                          |
| 20:03:03.7500387 | Active version gates                | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                                         |
| 20:03:03.7500387 | Secret-binding names                | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                                                      |
| 20:03:07.0689278 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                                                     |

Wrangler 4.110.0 was pinned. Secret names were projected from the active version's
`secret_text` metadata without values. HTTP timings are client elapsed values,
not Worker p95, an SLO result or capacity evidence.

R2 output reported `mustbeviral-v2-production-media` with **0 objects / 0 B**.
The information command's completion marker was delayed to **20:08:49.0465843Z**.
The public-access output reported **r2.dev disabled**, and a standalone
custom-domain read reported **no custom domains**. The read processes stalled
after output; the original sequence and two bounded follow-ups were interrupted
locally, ending by **20:14:46.988Z** with exit 1. These are observed read outputs,
not a claim that all three CLI sequences completed successfully. No R2 setting
was changed. The final standalone attempt disabled only optional client metrics.

DNS reads at **20:02:51.6774524Z–20:02:52.0613040Z** returned
api.mustbeviral.com NXDOMAIN (status 3); apex/www A answers were
104.21.6.198 and 172.67.135.59. Hidden CNAME targets are not inferred.

## Recovered browser checks

The original observation tab was absent from the current browser inventory.
A fresh tab in the same existing Chrome profile opened Continue successfully;
no new sign-in was performed. The supported zero-UUID canvas and quote URLs
both eventually rendered their permission-denied states. Canvas navigation
initially timed out, then showed loading, and a later state read showed the denial.
Quote initially showed calculation, then its denial.

Network capture ran **20:05:29.838Z–20:08:36.940Z**. It observed **76 responses:
74 HTTP 200 and two HTTP 403**, one for each supported Core proxy path. There
were **32 RSC responses and zero observed RSC 503s**. Thirteen loading failures
were canceled `net::ERR_ABORTED`. The single returned event page reported
`hasMore=false` and `truncated=false`; this bounded capture is not exhaustive
edge telemetry.

Network-disable was acknowledged. Return navigation to Continue timed out, but
a subsequent fresh state read verified Continue, and a separate handoff mark
succeeded. The recovered tab is retained for later checks. Normal navigation
updated only the browser's local workflow-step record; no fixture, canvas, quote
or run was saved. Earlier missing browser evidence remains missing.

## Vercel fallback and telemetry limits

The Vercel connector was unavailable; existing authenticated Vercel CLI 55.0.0
and documented REST reads supplied bounded fallback evidence. Targets remained
project `prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, team
`team_A11dbY2xnTWzGL63IRBTWmLo`, deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`.

The [deployment read](https://vercel.com/docs/rest-api/deployments/get-a-deployment-by-id-or-url)
at **20:04:07.9660246Z** confirmed that exact project/deployment, READY,
production and the two existing vercel.app aliases. Its separate `state` field
was absent. The listing at **20:04:08.1255274Z** returned no deployments since
the 03:18:11Z anchor; pagination count was zero and next was null.

The initial 100-record CLI sample exposed `responseStatusCode`; the first
projection had selected nonexistent status fields and was rejected for counts.
A corrected bounded query through **20:13:08.0229201Z**, completed
**20:13:34.1222531Z**, returned **100 records but only 50 unique record IDs**:
48 HTTP 200, two HTTP 403, all level info. The limit was reached; duplicate and
omitted coverage is disclosed. These sample counts cannot replace the earlier
connector's whole-window histogram, whose current value is unavailable.

An error-level query through **20:13:08.3097742Z**, completed
**20:13:19.5968827Z**, returned no records. That is not an exhaustive zero-error
or runtime-cluster claim. A checkpoint-only HTTP 403 query through
**20:13:08.1903922Z**, completed **20:13:18.7966759Z**, returned one canvas
record. The browser's quote 403 lacks checkpoint-scoped retained-server
corroboration here. Missing records are not treated as zero requests.

## Local verification and cost boundary

The user's new CI cost rules prohibit Markdown-only changes from triggering
builds. The existing Quality and Governance workflows include pushes to this
branch without path filters; Quality also has 30/45-minute jobs. Workflow paths
are outside this active step. **These two evidence records are committed locally
and held from push.** No workflow, linter, protection or required check was
weakened, and no CI run was dispatched for these records.

The interrupted checkpoint was recovered, followed by successful pinned
preflight, same-next-action handoff, formatting, governance/generated-output and
staged/committed scope checks. Authority files remained byte-identical after
formatting. No full build was repeated for routine evidence. At the unchanged
published HEAD, Governance run 34251927653 succeeded and Quality run 34251927661
failed. Its previously inspected failing job was database-pgtap; detailed failure
logs were not reread here.

No deployment, DNS, signup, customer/provider activity, sending, payment or
production configuration mutation occurred. The original September 4–7 window
remains NOT PROVEN. Replacement acceptance, all required daily captures and the
separate owner traffic ruling remain pending.

Next action: continue scheduled observation with a fresh S4 read at the next
checkpoint. Day-one capture is due September 9 **01:18:11–05:18:11Z**; day two
uses that window September 10. Closing is due September 11
**03:18:11–05:18:11Z**, never before 72 hours elapsed.
