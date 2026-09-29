# Replacement observation — thirteenth scheduled checkpoint

Heartbeat `mustbeviral-private-v2-observation` triggered at
**2026-09-08T20:24:28.935Z**. Collection ran
**20:27:58.060Z–21:18:33Z** at HEAD
`3f2f449662b8b5806f8a3f6a75d07c182f1897e4`, branch
`codex/viralgraph-cleanroom`, one worktree. Pinned preflight passed for
`WP-P3-009 / p3i-003-private-72-hour-observation`; authority was unchanged.

**Partial supplemental evidence.** The database getter's permission error was
identified, and a separate authorized read verified all four underlying switches
off with their baseline update time. Browser control timed out and supplied no
fresh denial or network evidence. Local command stalls stretched collection
beyond 30 minutes; the independently timed snapshots below are not a single
instantaneous state or a completed daily capture. Earlier gaps remain unfilled.

## Database reads and switch diagnostic

Only Supabase project `jjgtlfblsfobdhmtngbz` was queried, using the existing
machine credential and Management API with `read_only=true`. Explicit .NET
HTTP-client status/body handling replaced the preceding checkpoint's unusable
PowerShell result handling. No roles, permissions, functions or configuration
were changed. The original seven queries remained the execution-spec queries;
S1 additionally captured database time.

| Check          | Client UTC bounds                 | HTTP | Result                                                                                                                             |
| -------------- | --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------- |
| S1             | 20:27:59.5667197–20:28:00.7111845 | 201  | 1 user; 1 session; 11 refresh-token rows; 0 flow-state rows; 1 identity; 1 non-null password field; database time 20:28:00.945213Z |
| S2             | 20:28:00.7260058–20:28:01.6016689 | 201  | All 27 tenant/money/machine tables zero                                                                                            |
| S3             | 20:28:01.6028266–20:28:02.3044547 | 201  | Providers 4; price catalogs 2; model routes 5; route prices 8                                                                      |
| S4             | 20:28:02.3049701–20:28:03.4037450 | 400  | Getter unavailable to this monitoring call; no switch value returned                                                               |
| S5             | 20:28:03.4134569–20:28:04.9408164 | 201  | 31 public tables; 0 RLS-disabled; 0 not forced; 2 with no policies                                                                 |
| S6             | 20:28:04.9426318–20:28:05.5768248 | 201  | Migration heads 20260902154759, 20260902000000, 20260831140000                                                                     |
| S7             | 20:28:05.5772785–20:28:06.1704203 | 201  | 0 anonymous public-table grants                                                                                                    |
| TokenAggregate | 20:28:06.1729518–20:28:06.7644633 | 201  | 11 total; 10 revoked; 1 active; 1 distinct session; database time 20:28:07.095681Z                                                 |

The exact S4 query was
`select public.get_platform_kill_switches() as kill_switches;`. A bounded
diagnostic at **20:29:27.0259018Z–20:29:28.1542517Z** confirmed HTTP 400,
SQLSTATE **42501**, `permission denied for function get_platform_kill_switches`.
The local migration `20260830170000_p1a_kill_switch_stripe_rpcs.sql` confirms
that the getter reads the singleton row in
`app_private.platform_kill_switches`. Its execution grants were not amended.

A separate count diagnostic at **20:28:06.7656202Z–20:28:08.2888029Z** returned
HTTP 201, one control row and one singleton. A separate authorized projection
at **20:29:28.1842667Z–20:29:28.7903589Z** returned HTTP 201:

```sql
select signups_enabled, generation_enabled, provider_routes_enabled,
       charging_enabled, updated_at
from app_private.platform_kill_switches where singleton;
```

All four values were **false**. `updated_at` remained
**2026-09-02 15:47:59.474991Z**, matching baseline. This verifies the underlying
controls at that time; it does not turn the denied S4 RPC into a successful
call, establish a newly accepted capture procedure, or retroactively repair
checkpoint 12. The read-only flag stayed enabled for every query.

S2's exact enumeration remains in
`replacement-observation-hour-01-2026-09-08.md`. Last sign-in remained September
4 21:19:38.051408Z and session creation 21:19:38.052003Z. Initial latest session
touch was September 8 20:04:54.003436Z.

Later S1 at **21:17:31.0205059Z–21:17:32.1498219Z**, database time
**21:17:32.468355Z**, returned 1 user, 1 session, 12 refresh-token rows, 0 flow
states, 1 identity and 1 non-null password field. Latest session touch was
21:17:30.062466Z; sign-in and session-creation times were unchanged. S2 at
**21:17:32.1682879Z–21:17:34.3683134Z** again returned all 27 counts zero.
TokenAggregate at **21:17:34.4237986Z–21:17:35.8050224Z**, database time
21:17:35.464288Z, returned 12 total, 11 revoked, 1 active and 1 distinct session.
This is consistent with retained-session rotation; a second active session or
password reset is not inferred. These snapshots are not continuous reads.

## HTTP, Worker, storage and DNS

| UTC completion   | Check                               | Result                                                                                                                           |
| ---------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 20:28:00.1652883 | Core health                         | HTTP 200; mustbeviral-core; viralgraph-cleanroom-v2; status ok; request 13ec2513-ee0d-42d9-a123-cf705d7b5be8; client 685 ms      |
| 20:28:00.3110810 | Unsigned zero-UUID artifact content | HTTP 401 UNAUTHENTICATED; request adfd8df5-bdaf-4fcb-aa9e-b200971093fc; client 32 ms                                             |
| 20:28:00.6497070 | Anonymous protected Vercel alias    | HTTP 302 to vercel.com; redirect query omitted; client 336 ms                                                                    |
| 20:28:02.0128475 | Auth configuration                  | disable_signup=true; mailer_autoconfirm=false                                                                                    |
| 20:28:14.5430952 | Worker deployment                   | ee26c70e-9be5-4406-a5af-ceec2897f42a; created September 2 16:36:09.785687Z; version b832cca9-3dea-46d2-8313-eba80854c1ca at 100% |
| 20:28:20.8541953 | Worker gates                        | PROVIDER_RUNS_ENABLED=false; QUEUES_ENABLED=false                                                                                |
| 20:28:20.8541953 | Secret-binding names only           | ARTIFACT_ACCESS_SIGNING_KEY; CONFIRMATION_SIGNING_KEY; SUPABASE_PUBLISHABLE_KEY; SUPABASE_SECRET_KEY                             |
| 20:28:25.4243443 | Worker history                      | 8 versions; containment 45077c66-f31e-4c30-8396-9300b8e27fe0 retained                                                            |

Wrangler 4.110.0 was pinned. Binding values were not printed or saved. HTTP
timings are client elapsed values, not Worker p95 or an SLO/capacity result.

Three direct pinned Wrangler read clients printed R2
`mustbeviral-v2-production-media`: **0 objects / 0 B**, **r2.dev disabled**,
and **no custom domains**. All three stalled after their relevant output and
were interrupted locally with exit 1. These are observed outputs, not successful
CLI-completion evidence. Disabling optional client metrics did not resolve the
stall. No R2 configuration was changed.

DNS at **20:28:02.2541869Z–20:28:02.8745778Z** returned api.mustbeviral.com
NXDOMAIN (status 3), and apex/www A answers 104.21.6.198 and 172.67.135.59.
Hidden CNAME targets are not inferred.

## Browser gap and runtime telemetry

The retained-tab state read, a fresh selection of its known tab ID, and a
bounded browser inventory call all timed out with kernel resets and no usable
state. Neither supported browser denial was freshly verified. Current tab
position, handoff, RSC counts and browser network coverage are UNKNOWN. No
Network.enable call was issued in this checkpoint. Prior checkpoint 12's
acknowledged Network.disable and Continue/handoff remain historical evidence,
not fresh verification. No fixture, generation request or new sign-in was
intentionally submitted.

Vercel REST at **21:17:31.5730313Z** confirmed deployment
`dpl_6u7aUJ6VSTiaQYESzpSZtf9Kdyxb`, project
`prj_oPGn8bYorRz0VvXhsWUnHhGN0vGj`, READY, production. The separate `state`
field was null. Aliases remained `mustbeviral-web-production.vercel.app` and
`mustbeviral-web-production-ashrunscode-projects.vercel.app`. The listing at
**21:17:31.8029662Z** returned no deployments since the 03:18:11Z anchor,
pagination count zero and next null. Both reads used the existing exact team.

The first log client was interrupted before returning a log aggregate. A bounded
retry using pinned Vercel CLI 55.0.0 completed all three reads with exit 0.
All used an upper bound of **21:18:04.6371714Z**:

- Anchor-to-upper-bound sample, completed **21:18:17.5909074Z**: 100 records,
  50 unique IDs, 48 HTTP 200 and two HTTP 403, all level info. The two 403 paths
  were the supported zero-UUID canvas and quote Core proxy routes. The record
  limit was reached; these historic sample entries are not new browser probes.
- Checkpoint-only HTTP 403 query from 20:27:58.060Z, completed
  **21:18:25.7992314Z**: no returned records. It provides no fresh retained-server
  corroboration and does not establish zero requests.
- Anchor-to-upper-bound error-level query, completed **21:18:31.5557071Z**:
  no returned records. This is not an exhaustive zero-error/runtime-cluster claim.

The connector's whole-window histogram remains unavailable. Duplicate records
were deduplicated by ID before the projected status/path counts. No raw log
headers, cookies, query values or credentials were retained.

## Verification and disposition

Pinned preflight, same-next-action handoff, formatting, local
governance/generated-output validation and staged/committed scope checks passed.
Authority files remained byte-identical after formatting. Only this redacted
evidence file was committed. No full build was repeated for this unchanged-code
checkpoint.

The commit remains local. Existing branch push workflows lack Markdown path
filters, and their paths are outside this step; publication is held under the
user's CI cost rules. No workflow, linter or required check was weakened, and no
push or CI dispatch occurred. Published HEAD remains
`966006beb9bc163019f6c04a564d820b577e1a6d`; its prior observed Governance success
and Quality failure were not reread in this checkpoint. Local CI remains not run.

No deployment, DNS, signup, customer/provider activity, sending, payment or
production configuration mutation was performed. Available timed service and
database reads showed no observed drift, with the browser and telemetry limits
above. Original September 4–7 acceptance remains NOT PROVEN. Replacement
acceptance, all required daily captures and the separate owner traffic ruling
remain pending. No successor was activated.

Next action: continue the replacement observation and recover browser control
for the required day-one capture, September 9 **01:18:11–05:18:11Z**. Day two
uses the same window September 10; closing is September 11
**03:18:11–05:18:11Z**, never before 72 hours elapsed.
