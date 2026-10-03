# Public origin and local harness: merge and review

Run: codex-finish-20261002

PR [#67](https://github.com/ashrunscode/MustBeViral/pull/67), base
`485e7287e21b7f6656fef0647fcbabf5fc92651f`, final head
`4ca8264c2ad4a1cf7ef61e32753ca179be9c259c`, normal merge
`658cd50cc48906262bf24ec08e84b7d768cce481` at 2026-10-03T06:58:41Z.

The two commits are `b96436da182904fe0e18ca0b5fbcf272707a52b3` (public origin)
and `4ca8264c2ad4a1cf7ef61e32753ca179be9c259c` (complete local harness).

## Independent exact-head reviews

Each round used Codex CLI 0.160.0, gpt-6.1-sol, xhigh, a detached tracked-only
clone, the directive's read-only sandbox and all required isolation flags.
Credential-like environment variables were removed. Neither reviewer ran
validators or remote calls; local gate evidence is recorded separately.

| Round | Exact head                                 | Session                                | Exit / verdict                                                   |
| ----- | ------------------------------------------ | -------------------------------------- | ---------------------------------------------------------------- |
| 1     | `b96436da182904fe0e18ca0b5fbcf272707a52b3` | `01a10027-6854-74a3-9d34-e87dca3ffa60` | 0 / PASS, no actionable findings in the original eight-file diff |
| 2     | `4ca8264c2ad4a1cf7ef61e32753ca179be9c259c` | `01a10062-e2e8-7042-891b-a14eaaff7f9c` | 0 / PASS, no actionable findings in the full ten-file diff       |

Round 2 explicitly required fresh exact-head checks and positive connected
proof, which subsequently passed. It also warned that the earlier database
assertion failure was unexplained and not repaired by passing retries. No
product acceptance status advanced. The merged tree equals this reviewed head.

## Retained earlier failures

Before the public-origin fix, the focused Vitest regression run reported 23
failures and six passes, exit 1. The selected rendered homepage canonical check
also failed. An initial browser test filter selected no tests and was not
treated as defect proof. After the fix, the focused suite passed 29 tests and
the exact-head rendered-output suite passed nine, each exit 0.

On b96436d, fresh verify passed but the database gate reported one failure in
00043_platform_knowledge.test.sql, assertion 52: the authorized latest-job read
returned a different job from the fixture expectation. This was a reported
test failure, not a validator crash. Six rollback-only focused diagnostics
passed with distinct timestamps and no tie. A separately prepared synthetic
backward-clock scenario made the original fail and the proposed deterministic
fixture pass. That scenario demonstrates a fixture weakness, not the cause of
the original observed failure. No tracked SQL edit or reset was made. The
proposal is outside packet scope and remains pending owner input.

The prescribed older local harness on b96436d produced eight passing and nine
failing connected journeys, exit 1. Its omitted privileged capture fixture,
R2 and explicit-host egress fixtures explained the failed/queued source
captures. The second commit reuses the existing complete local-only harness,
preserving disabled providers and queues. Fresh proof on the final head passed
all 17 journeys. These are synthetic local results, not remote acceptance.

The two migration-output parser failures and the corrected exact parity check
are retained in `release-public-origin-2026-10-03.md`. No failing run was erased
or represented as a validator crash. The current-head passing gates, source,
deployment identities and signed-out smokes are in that release record.
