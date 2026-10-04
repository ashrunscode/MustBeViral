# Receipt, Review and Canvas browser proof, October 4, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, step ui-008-release, bounded L3f repair. This package proves production-rendered local UI with synthetic intercepted Core reads and an existing local Auth session. It proves neither remote authenticated acceptance nor provider generation. All browser sessions made zero Core writes. No fixture credential, raw authentication driver or raw MCP result is included.

## Source and scope

The author base is 88804c80c814cfe2ee2b65182566b6f9d4358829. Final Review proof 20 used source fingerprint 880f63b52fd9e57c67ce54f78e117ffa3f97ec15d6b49f23db31e1936721d8e1, with 2,476 tracked and owned untracked source files. Its production build exited 0 on Node 24.18.0 and corepack pnpm 11.12.0, 06:18:51.9463910–06:19:15.2864985 UTC. The final browser observations precede the product commit. They are source-equivalent evidence, not a run performed at a future commit identity.

[source-equivalence.json](source-equivalence.json) checks the exact final hashes of the Receipt component, styles, export port and shared platform CSS against proof 8, and the Canvas component, styles and shared CSS against proof 13. Each original before/after whole-source fingerprint is identical. Review acceptance uses proof 20 only. The current production-build source files also match the recorded final hashes. Existing private preview URL and authorization contracts are unchanged.

Public home and shared Brief captures are references for unchanged runtime and the shared shell. They do not prove those routes' primary tasks. The wider missing 768-px platform matrix and operator-gate investigation remain separate L3f work.

## Final browser matrix

| Family       | Widths               | Final observations                                                                                               | Evidence                                                                                                                                                          |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Receipt      | 375, 768, 1280, 1920 | 48 state/recovery cells; 14 theme/accessibility/enlargement cells; one exact text-doubling reference             | accepted/l3f-receipt-browser-final-8-*.json; accepted/l3f-receipt-accessibility-additional-8.json; references/l3f-exact-text-zoom-final-9.json, Receipt cell only |
| Canvas       | 375, 768, 1280, 1920 | 18 ready/theme/enlargement cells; 42 read-failure/loading/recovery cells; one settled mobile confirmation        | accepted/l3f-canvas-ready-final-13.json; accepted/l3f-canvas-states-final-13.json; accepted/l3f-canvas-ready-settled-13.json                                      |
| Review       | 375, 768, 1280, 1920 | 19 ready/theme/enlargement cells; 42 failure/loading/pending/recovery cells, all with visible-heading assertions | accepted/l3f-review-final-20.json; accepted/l3f-review-states-verified-20.json                                                                                    |
| Shared Brief | 375, 768, 1280, 1920 | Four shared-shell references                                                                                     | references/l3f-workflow-shared-shell-and-review-8.json, shared-brief cells only                                                                                   |
| Public home  | 375, 768, 1280, 1920 | Four signed-out references, no form submission                                                                   | references/l3f-receipt-home-reference-5.json                                                                                                                      |

Receipt distinguishes missing totals from known zero and positive settlement, incomplete artifacts, denied access, not found, a generic read conflict/error, recoverable failure and held loading. Unknown quote, charged amount and comparison all say Unavailable. Check receipt status repeats the existing GET, updates the named live status, and focuses the recovered heading. Four keyboard ledger samples prove scroll movement, visible focus, column containment and no overlap with the evidence panel.

Canvas covers unavailable, denied, not found, synthetic read 409, malformed data, held loading and recovery. Ready coverage proves available-width drawer selection, toolbar and quote-bar containment, graph placement after controls, a single mounted outline, closed-drawer inertness, keyboard Close/Escape and focus return. Mobile plan mutations are disabled and the desktop continuation remains available. The settled 375-px capture replaces the transient closing-drawer continuation frame for visual acceptance.

Review covers error, permission denial, not found, generic read 409, incomplete receipt, session expiry, pending approvals, held loading, and error/loading recovery. Before a verified receipt arrives, there are no approval counts, output drafts or export control. Pending outputs show the approval instruction and no Export approved link. The final 42 cells assert the H1 is actually visible, rather than merely counting a hidden DOM heading. Ready QA panels scroll, retain readable concept labels under enlargement and return focus after closing.

The GET 409 fixtures exercise read-error presentation. They are not proof of a durable approval or graph-write conflict. Actual approval conflict behavior remains covered by the worker regression tests; existing connected concurrency journeys provide the separate local write evidence.

## Accessibility, performance and craft

All measured final cells have zero serious or critical axe violations and no page horizontal overflow. Keyboard recovery records are retained separately. The retained trees show named main/navigation/regions, placement pressed states, a separate Safe zone checkbox, the receipt totals status, errors and recovery actions. Keyboard observations include ledger scrolling, receipt recovery, QA and Canvas drawers, visible focus and Escape return. Reduced-motion and forced-color cells remain readable. Dark-preference cells preserve the intentional readable Lightfield palette; this work adds no dark palette.

The enlargement checks use 200% CSS enlargement and exact computed text doubling at 1280; they are explicitly emulations, not a claim of browser-toolbar zoom. Review also retains an inherited-text stress sample. Test thresholds, axe rules and existing goldens were not weakened.

| Route   | Accessibility /25 | Responsive /15 | Theming /10 | Motion /10 | 375-px lab /20 | Craft /20 | Total |
| ------- | ----------------: | -------------: | ----------: | ---------: | -------------: | --------: | ----: |
| Receipt |                25 |              9 |          10 |         10 |             16 |        20 |    90 |
| Canvas  |                25 |             11 |          10 |         10 |             16 |        19 |    91 |
| Review  |                25 |             11 |          10 |         10 |             16 |        19 |    91 |

These design-qa-loop scores use measured 15-px inherited mobile body text (minus three) and the shared 41-px skip link (minus one). Receipt also loses one point each for the short Back to content review and Open the plan to recover links in negative states. All three routes receive the 16 LCP/CLS points and conservatively receive zero of the four console points because controlled failed-resource entries remain. Canvas loses one craft point for dense presence metadata; Review loses one for the wrapped pending-approval label. Existing brand-required paper, grid and metadata styling incurs no generic-template deduction. A3 supplies the visual approval only with these scores, zero serious/critical axe, existing tokens/primitives and a passing independent review. Independent review and fresh exact-head gates must still complete before merge.

| Local production-rendered 375-px sample | Maximum LCP ms | Maximum CLS |
| --------------------------------------- | -------------: | ----------: |
| Receipt                                 |            264 |    0.083719 |
| Canvas                                  |            400 |    0.083476 |
| Review                                  |            224 |    0.084413 |

Performance and event timing are unthrottled local lab samples, not field percentiles. Accepted Canvas trusted event durations reach 64 ms; Review reaches 64 ms; receipt recovery samples reach 56 ms across all widths. Recovery wall time includes assertions, axe and screenshots and is not INP. Fresh C4 canvas performance/stress results belong to the exact-head gate record; the one-node browser fixture makes no FPS claim. Shared-shell 768-px CLS exceeds 0.1 in some retained samples and remains a P3 wider-matrix finding; the brief's measured lab ceiling here is at 375.

There are zero application/page exceptions. Controlled failed-resource console entries are retained: 16 across the four Receipt state runs, 34 in Canvas negative-state coverage, 304 in Review ready coverage from unavailable synthetic previews and 244 in Review negative-state coverage. They are not silently relabelled as an empty console. No real provider asset was requested.

## Actual visual inspection and retained failures

[image-manifest.json](image-manifest.json) maps 212 capture names to 163 distinct PNG contents, each inspected at original resolution or proven byte-identical to a previously inspected original. Four contents are explicitly before-repair diagnostics. The manifest preserves both the original source and every capture label; one PNG per SHA-256 avoids duplicating identical files. The inspection records and their actual prior timestamps are in provenance/. Six additional originals were inspected during packaging to close the settled-Canvas and diagnostic-heading manifest coverage.

The native before-19 probe reproduced an invisible mobile heading in four states. It returned a normal result with headingVisible false, not a process exit of 1. Its screenshots are marked diagnostic-before-mobile-heading. The selector repair excludes H1 from the mobile metadata-hiding selector. Final proof 20 passes all four states and the other 38 visible-heading cases. Earlier structural H1 counts alone are not accepted as visual proof.

diagnostics/ preserves actual failing and passing regression receipts plus selected log excerpts. A failed initial Next search-parameter mock, an asynchronous focus assertion race and earlier driver precision attempts remain diagnostic; they do not masquerade as product failures or final acceptance. Historical Review/Canvas cells embedded in reference and provenance files are superseded wherever this README selects proof 13 or 20. Old Review CSS enlargement and transient Canvas closing frames remain failed/diagnostic, even when other cells in the same original file pass.

All copied text inputs passed the source secret scan before packaging. Authentication scripts and raw MCP results remain outside the package. Owned browser processes 8, 13 and 20 were stopped with before/after source equality and their preview port free. No other browser page, process or checkout was removed.

## Remaining acceptance

Fresh C4 product gates, isolated C5 review, normal merge and guarded web release remain required for this patch. primary-flows and release-smoke stay pending. This package does not complete the missing composer contract, durable rejection reason, project-to-brand mapping, founder smoke, operator-gate trace, remaining 768-px matrix, films or roadmap work. Founder credentials and production schema lag remain separate owner stops.
