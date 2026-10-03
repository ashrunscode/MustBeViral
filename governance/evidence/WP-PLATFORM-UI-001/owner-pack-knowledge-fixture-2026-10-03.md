# Owner pack: deterministic latest-job fixture

Run: codex-finish-20261002

## Prepared proposal

Add only `supabase/tests/database/00043_platform_knowledge.test.sql` to the
active packet's allowed paths in a separately reviewed authority-only change,
then make the narrow fixture repair in a separate product change. No migration,
production query, runtime behavior or assertion is changed by this proposal.

The ready candidate is outside Git at
`C:/dev/mbv-run/knowledge-latest-fixture-candidate.sql`. It preserves all 63
assertions and explicitly sets the synthetic editor fixture's updated_at later
than the workspace's existing jobs before asserting which job is latest. It
restores the authenticated role/claims before the original permission check.
This makes the fixture independent of wall-clock ordering. It is not committed
or applied remotely.

## Evidence and limits

One full database gate on b96436d reported assertion 52 failing. Six focused
rollback-only probes passed and showed distinct timestamps, so neither a tie
nor the original failure's cause was established. A synthetic backward-clock
scenario made the unchanged fixture fail one of 63 assertions; the prepared
candidate passed all 63 on that same scenario. Subsequent final-head full
database gates passed 1181 assertions, but those passes are not a repair claim.

The reproduction supports hardening the fixture. It does not justify rewriting
the latest-job RPC, changing its ordering contract or describing the original
failure as diagnosed. After approval, both the original failure scenario and
the unchanged permission assertions must be retained as regression evidence.

## Gate and one clearing sentence

C3 grants no scope amendment beyond A9. This SQL path is outside UI-001 scope.
The existing asynchronous scope question remains unanswered. No approval is
inferred from elapsed time or the current passing gates.

> Authorize an authority-only amendment adding only
> supabase/tests/database/00043_platform_knowledge.test.sql to
> WP-PLATFORM-UI-001, followed by only the deterministic latest-job fixture
> repair described in owner-pack-knowledge-fixture-2026-10-03.md.

The amendment and repair each require the normal exact-head checks and
independent review. No remote write, deletion, reset or existing assertion
removal is included.
