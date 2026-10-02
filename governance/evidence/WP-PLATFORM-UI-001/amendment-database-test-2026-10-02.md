# Authority-only amendment, 2026-10-02: the barrier database test joins the packet

Owner directive of 2026-10-02, verbatim: "The database test
supabase/tests/database/00003_p0_barrier_and_invariants.test.sql aborts with "planned 40 ran 0"
after any canvas has existed, because it updates every canvas with no workspace filter and canvas
revisions are immutable. That file is outside the packet paths. First commit an authority-only
amendment that adds that test file, then fix the test so a database that has held a canvas still
runs, with a regression. Do not wipe a database you do not own to make the suite green."

This commit changes authority only: `docs/delivery/ACTIVE_WORK_PACKET.yaml` gains the single path
`supabase/tests/database/00003_p0_barrier_and_invariants.test.sql` under `scope.allowed_paths`.
No product step, acceptance row, required skill, check, external-effects policy, state or history
changes, and `spec_revision` stays at 2 because the recorded supersession receipt names it. The
test fix follows in its own commit after this one, with a regression that seeds a canvas outside
the test's own workspace before the barrier fixtures run.
