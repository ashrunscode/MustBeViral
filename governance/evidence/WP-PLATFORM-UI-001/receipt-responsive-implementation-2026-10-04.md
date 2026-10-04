# Receipt totals and responsive workflow repair, October 4, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, ui-008-release; author base 88804c80c814cfe2ee2b65182566b6f9d4358829. This is the bounded first L3f product patch. It changes existing web projections, layouts and regressions, with no contract, migration, dependency, Worker or provider-setting change. The adopted A1–A11 record governs; disk-only A12 remains unadopted.

## Resulting behavior

Missing receipt reservations now produce nullable quote and actual totals. The export port keeps integer micros, computes known captured minus refunded amounts with a zero floor, preserves actual known zero, and does not substitute the run spend projection for missing receipt evidence. The UI names each missing amount and comparison as Unavailable. Check receipt status repeats the existing read; it never replays a run, approval or payment write. A successful recovery announces the totals and focuses the heading.

Receipt totals wrap inside a growing footer. The ledger remains a semantic table in a named, keyboard-scrollable region, contained within its column; a narrow route container uses one column. The shared mobile shell reserves intrinsic rail height and campaign workflow links have 44-px targets.

Review uses a semantic Placement group with pressed buttons and an independent Safe zone checkbox. Concept labels and QA content remain readable under enlarged text and reduced available width. Hidden QA drawers are inert; closing returns focus. Initial loading, read failure and session expiry retain visible route headings without invented counts or draft editors. Verified pending outputs show the approval instruction. Export appears only when every verified output is approved.

Canvas reserves an honest loading/error surface, uses the actual available width to choose its outline drawer, and waits for the first measured layout before starting the graph worker. Only one outline is mounted. The compact drawer supports Close, Escape, focus return and closed-state inertness. The toolbar and quote strip grow without covering the graph. Mobile plan mutation controls stay disabled with a desktop continuation; viewing the outline and comments remains supported.

## Regression evidence

The original Receipt regression command reported four failed and 32 passed tests and exited 1 at 01:05:40.4203050 UTC against unchanged runtime. After the nullable projection and read-only recovery repair, the three-file Receipt suite passed 38 tests and exited 0 at 01:09:44.4597870 UTC. Later seven-file focused suites include both newly added worker test files; the final unverified-counts run passed 81 tests at 05:58:48.9811239 UTC, actual exit 0. Original failing receipts and selected excerpts are retained under browser-proof-2026-10-04-receipt/diagnostics/.

Further failing-then-passing regressions cover semantic placement, receipt containment, scrollable QA and focus return, reserved loading layout, available-width drawers, inert closed drawers, the Canvas first-layout worker gate, toolbar height, expired-session heading and unverified approval counts. The existing connected browser spec adds a local synthetic read matrix, including eight visible Review error/denial heading cells. It tracks all Core requests and asserts zero writes during the matrix. Existing connected real-handler journeys remain intact.

Actual native inspection found a mobile H1 hidden by a broad first-child selector. The before-19 probe reproduced four invisible headings. The repair excludes H1 from that selector and the final production-rendered proof passes 19 ready/enlargement plus 42 negative/pending/loading/recovery cases. A DOM count of one H1 is not used as visibility proof.

The [browser package](browser-proof-2026-10-04-receipt/README.md) records final source equivalence, widths 375/768/1280/1920, actual axe/keyboard/tree checks, emulated enlargement, local lab measurements, 90–91 conservative design scores and inspected captures. Before-fix failures, mock setup failures and driver diagnostics remain labelled distinctly. GET 409 fixtures are generic read-error proof; actual durable approval conflict is proved by its worker regression, not inferred from that fixture.

The first fresh C4 attempt at 87ec058116f798414bb4702f37a644bac67e2034 passed its first ten gates, then the preview validator reported 53 passed, four failed and the one existing guarded staging skip, actual exit 1. Its four obsolete expectations required the old 460-px drawer, a 32-px visual control and one generic receipt scroller. The test-only repair verifies the bounded existing Drawer and Close/focus/inert recovery, the entire 44-px pointer target, separately named vertical receipt and horizontal ledger regions with keyboard movement, and focus preservation after resize. All four focused cases passed, actual exit 0; the original focused receipt abbreviates its grep label, while the complete six-suite command is recorded by the full author rerun. That rerun at 08:24:01.1210040–08:25:13.8812682 UTC passed 57 tests and the unchanged single guarded skip, actual exit 0. It measured 60.04 FPS at 100 nodes (55 threshold) and 60.17 FPS at 500 nodes (unchanged 30 threshold), with twelve DOM nodes and 24.5 ms selection. Runtime hashes, axe rules, performance limits and existing goldens remain unchanged. A first author-wrapper artifact guard omitted generated performance/capture files after the validator reported the same pass count; its actual wrapper exit 1 is retained separately and is not recorded as a validator exit. Generated artifacts from both author runs are preserved outside the checkout before their tracked copies are restored. Fresh exact-head C4 proof must still be repeated after this test repair is committed.

The final patch now changes sixteen application/test paths; the extra path is the repaired existing preview spec. The browser source-equivalence record preserves the original fifteen hashes and separately identifies the later test hash.

Author packet gates and fresh C4 gates apply to the final commit and are recorded in its PR body, followed by the exact-head C5 round. These are local required checks; GitHub Actions remains off. This implementation record does not assert that those future steps have already passed.

## Release and limits

Release only after C4/C5 pass and a normal merge, through the documented existing staging and production web targets with fresh rollback deployments and schema-dependency checks. The patch uses only existing reads and changes no permission authority. Both web targets remain production-data-backed, so no remote signed-in write or local fixture writer may be used for smoke. Worker targets require no release for this patch.

primary-flows and release-smoke remain pending. The remaining missing 768-px matrix, operator UI/Core gate, films, roadmap packets and owner input packs are still required. No remote database write, provider generation, paid call, sign-in to production, posting, send, signup, settings change, deletion or history rewrite occurred in this repair.
