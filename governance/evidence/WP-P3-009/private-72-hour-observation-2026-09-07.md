# Original 72-hour observation — incomplete evidence

Written on 2026-09-08 UTC. The filename identifies the original window's closing
date; it is not a claim that this report was captured on September 7.

**Result: NOT PROVEN. Do not mark `observation-window` passed.**

The intended window was 2026-09-04T21:22Z–2026-09-07T21:22Z. The record supports
several successful snapshots and stable retained provider records, but it does
not prove all required observations throughout that window.

| Evidence                                       | What it establishes                                                                | Limit                                                                     |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `owner-session-zero-spend-smoke-2026-09-04.md` | Authorized owner session and initial disabled foundation smoke                     | Closing sign-out was deferred                                             |
| `private-observation-2026-09-05.md`            | Later reconstruction of current state                                              | Explicitly says the contemporaneous September 5 capture was missed        |
| `private-observation-2026-09-06.md`            | An in-window snapshot with empty tenant/money tables and disabled gates            | Authenticated containment probes and Vercel runtime data unavailable then |
| `private-observation-2026-09-08.md`            | Fresh database, HTTP, provider and DNS checks; retrospective Vercel runtime counts | Late recovery capture, outside September 7 21:22–23:22Z                   |

## Verified comparison

At the September 6 and September 8 database reads, there is one owner session;
all 27 tenant/money/machine tables are empty; catalog counts are 4/2/5/8; all four
database switches are false with the same update timestamp; all 31 public tables
have enabled and forced RLS; anonymous public-table grants are zero; migration
head is unchanged. Worker version, secret-name count, Vercel deployment, R2 count,
and public DNS A answers also match the earlier snapshot evidence.

The recovered Vercel query for September 4 21:22Z–September 8 02:45Z returned no
runtime error clusters and a function status histogram of 27 HTTP 200 and 2 HTTP
400 responses. That closes the connector-access gap for this retained query; it
does not prove historical browser rendering, prefetch status counts, or continuous
database state between samples. The last limitation is inherent in snapshot
measurement; it is not an additional acceptance gate. The historical failures are
the missing required captures and their missing browser evidence.

## Findings requiring a corrected observation procedure

1. A missing historical capture cannot be recreated by changing a filename or by
   reading present state. Keep both inherited reports intact as evidence of what
   was actually observed.
2. The execution spec prescribes `POST /v1/quotes`, but the implemented REST route
   is `POST /v1/canvases/:id/quotes`. The empty production database has no authorized
   canvas, so successful empty MCP context and a quote reaching generation policy
   are not attainable without creating fixture state. Creating that state would
   contradict this packet's zero-mutation boundary. Validate the actual denial
   contract and record the spec divergence; do not fabricate a successful context.
3. A non-null encrypted-password field is not evidence that a password reset or
   global sign-out occurred. The inherited reset explanation is unproven.
4. Runtime absence of error clusters does not prove absence of edge prefetch 503s.
5. A new observation must have an explicitly recorded start, contemporaneous
   samples, retained telemetry, supported containment probes, and a closing
   owner-session/sign-out check. Do not backdate its start or pass the old window.
6. The recovery browser naturally refreshed its existing session. Total refresh
   token rows became two, with one revoked and one active token for one session.
   The external spec's total-token-count equality would misclassify normal token
   rotation. The recovery capture preserves the counts and primary documentation.

## Disposition

The active observation step remains current and automated observation acceptance
remains pending. Public traffic remains a no-go recommendation. The owner traffic
ruling is also pending, separately from this evidence gap.

The supported probe procedure and replacement baseline are now recorded in
`observation-recovery-procedure-2026-09-08.md` and
`replacement-observation-baseline-2026-09-08.md`. The new window starts September 8
at 03:18:11Z and cannot finish before September 11 at 03:18:11Z. Any change
to the packet sequence or acceptance contract must be a separate governed change;
it cannot be hidden in an implementation commit or represented as a passed gate.
