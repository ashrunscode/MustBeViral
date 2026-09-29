# Observation recovery procedure — supported checks

This document prepares the current WP-P3-009 observation recovery. It does not
change packet acceptance, activate its successor, or mark the old window passed.
The old September 4–7 window remains NOT PROVEN. The replacement window starts
at 2026-09-08T03:18:11Z, as recorded in `replacement-observation-baseline-2026-09-08.md`.

## Read procedure

1. Verify the active packet, branch and exact production targets before reading.
   Use Node 24.18.0 and pnpm 11.12.0. Serialize governance commands in the one
   worktree: simultaneous preflights briefly contend for the authority lock.
2. Capture S1–S7 from the external execution spec
   `C:/Users/ernij/.claude/plans/mustbeviral-exec/packets/WP-P3-009.md`
   against only Supabase project
   `jjgtlfblsfobdhmtngbz`, using the explicitly targeted connector or Management
   API. For required daily captures, follow the external spec's sequential S1–S7
   read order and retain the UTC capture bounds for each read. Record allowlisted
   aggregate results and metadata. Never collect owner identifiers,
   passwords, tokens, cookies, Auth rows, or customer records.
3. Preserve the original S1 count, but add aggregate total/revoked/active refresh
   token counts and distinct session count. Normal token rotation can leave a
   revoked historical token alongside one active token for the same owner session.
   Do not manufacture a new-session incident from the total alone.
4. Read Core health; require an unsigned artifact-content request to be refused;
   check the anonymous Vercel alias still gives its SSO challenge. Save redirect
   hostname only. Do not save response cookies, Location query strings, or tokens.
5. Use the existing authenticated owner browser, without extracting its tokens,
   to open the supported absent-canvas paths below. Both must show permission
   denial. Confirm HTTP 403 using retained Vercel records scoped to the exact
   deployment and paths. Do not create fixtures or request a run.
6. Recheck all 27 tenant/money/machine table counts after the quote-denial probe.
   They must remain zero. Auth refresh is distinct from tenant or financial writes.
7. Read R2 count/size, disabled public access and no custom domains; active Worker
   deployment, version history, secret names only, and an allowlisted projection
   of the deployed `PROVIDER_RUNS_ENABLED` and `QUEUES_ENABLED` flags.
8. Read the exact Vercel production project/deployment, deployments since the
   recorded start, runtime errors, and the status histogram over the actual
   observation range. A top-three histogram is truncated, not complete. Record
   unavailable data and edge/browser coverage limits separately from zero errors.
   In the existing owner browser, record successful page renders and the count of
   RSC-prefetch 503 responses actually observed. The external spec's threshold is
   successful renders, zero runtime errors and at most 20 observed prefetch 503s.
   Disclose truncated browser events; do not claim an exhaustive network capture.
9. Read Auth `disable_signup` and `mailer_autoconfirm` by projecting only those
   fields. Query apex, `www`, and `api` DNS. Do not infer hidden CNAME configuration
   from proxied A answers.
10. Record retries, clock boundaries, drift and unavailable data. Disclose when
    collection spans more than 30 minutes, as the external spec requires; elapsed
    collection time alone does not disqualify a snapshot. Keep public behavior
    disabled and do not repair provider configuration during observation.

## Supported browser probes

On `mustbeviral-web-production-ashrunscode-projects.vercel.app`:

```text
/studio/campaign/canvas?canvas=00000000-0000-4000-8000-000000000000
/studio/campaign/quote?canvas=00000000-0000-4000-8000-000000000000&revision=00000000-0000-4000-8000-000000000000
```

These invoke the normal application client and current owner session. The first
reads an absent canvas; the second submits an absent-canvas quote request which
the workspace resolver denies before the quote handler. Root verified both UI
denials, two corresponding HTTP 403 records, and zero S2 rows afterward.

Relevant implemented contracts: `apps/core/src/routes/v1-table.ts`,
`apps/core/src/routes/v1.ts`, `apps/core/src/routes/mcp.ts`, and
`packages/contracts/src/handlers.ts`. A bare cookie-only request to `/api/core`
does not substitute for the application's bearer-authenticated client.

The external spec's `/v1/quotes`, successful empty MCP context and
`generation_disabled` assumptions conflict with these contracts on an empty
database. This procedure records those corrections against the implemented
contracts. Restarting these read-only checks requires no new owner approval and
does not change the accepted containment criterion or pass the old window.

## Completion and ongoing checks

The hourly task `mustbeviral-private-v2-observation` collects recovery checkpoints
in this Codex task. Its first scheduled execution is evidenced in
`replacement-observation-scheduled-01-2026-09-08.md`: the September 8 04:52Z run
completed provider reads but encountered unavailable browser control. Scheduling
or executing a task is not proof that every capture requirement passed or that
the observation is complete.

Preserve contemporaneous daily checkpoints and intervening available telemetry.
Day 1 is due September 9 at 03:18:11Z, within 01:18:11–05:18:11Z; day 2 uses the
same window on September 10. The final capture is due September 11 at or after
03:18:11Z and no later than 05:18:11Z. Hourly checkpoints add coverage; a missed
optional hourly run alone does not invalidate the required daily observations.
A missing or failed required daily capture remains a gap. Snapshot measurements
do not assert continuous knowledge of database contents between reads.

After at least 72 hours, evaluate the owner session before the separately
evidenced closing sign-out. Keep the manual traffic ruling separate from
automated observation acceptance. Do not start the successor before the current
packet's acceptance criteria are met.

Do not send routine hourly notifications. Surface only new failures, required
owner action or a fully evidenced window ready for review. Pause the task when
the packet changes or this observation is no longer applicable.
