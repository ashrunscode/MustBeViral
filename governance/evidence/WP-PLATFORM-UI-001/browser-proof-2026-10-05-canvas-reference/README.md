# Canvas reference typography proof, October 5, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, step ui-008-release. This supplements the tablet PR with one bounded identifier-font repair. Implementation source is 0ad0ebf83105010a7d9b8eeb3fdb09f0f74e5015, parent b6f022d2c2531ebd499c104ce6c9b5bcf8357428. Full C4, a new exact-head independent review, merge and public release remain pending. This package does not complete primary-flows or release-smoke.

## Behavior and regression

The selected Canvas Reference value inherited the body font. It now applies the existing font-mono token only to that value, preserving its complete text and existing wrapping. JSX and CSS change in two Canvas files; the existing selected-node regression also checks the resolved mono family after fonts load. No test, threshold, skip, golden, hook, schema, dependency or provider setting is removed or changed.

The focused command was corepack pnpm exec playwright test apps/web/e2e/final-ui.spec.ts --project=desktop-chromium --grep shows complete selected node details outside the scaled diagram. The actual red run at parent b6 with the strengthened test exited 1, 03:03:44.9744909–03:03:55.3711089 UTC: expected Geist Mono, received Geist. The first green exited 0, 03:06:50.1660720–03:07:06.5680214, one pass. Formatting expanded the test expression; the second green matches committed test SHA-256 37a376317c77d958b053775b461f5f142d4e744e7d64e9b5451b0ce9e2c1fc20 and exited 0, 03:12:12.0637993–03:12:22.6739565, one pass. Node 24.18.0, pnpm 11.12.0 and Playwright 1.61.1. The before-font-regression image is an inspected historical failure on a synthetic preview, not current passing evidence. Its error-context file remains preserved outside Git.

## Native browser scope

Native Playwright MCP on Chromium 154.0.4258.48 passed sixteen typography/layout cases, plus three production-rendered quality samples, on source 0ad0ebf. The web uses a production build with the preview bypass off and an existing retained local synthetic Auth session. Graph, project and project-to-brand GET responses are intercepted synthetic inputs; other allowed reads reach local Core. Every non-GET Core request is denied by the measurement guard, and no such request was observed. These captures prove local rendering mechanics, not connected staging or authenticated production acceptance.

The matrix includes 375, 768, 1280 and 1920, desktop 1440, dark OS preference, reduced motion, forced colors, a 640 by 450 viewport for 200-percent enlargement emulation, computed text doubling and a deliberately long synthetic model identifier. The resolved Reference font matches Geist Mono in every case. All selected values have complete text in the named details region/accessibility tree; no horizontal value clipping or page overflow was measured. Keyboard selection and compact drawer Escape/focus restoration pass. All nineteen axe runs have zero serious or critical violations. Incomplete color-contrast entries remain explicitly unmeasured numerical contrast, and actual assistive technology was not used.

The application intentionally sets color-scheme light. Dark-preference captures remain readable in that same light theme; there is no implemented dark theme claim. Enlargement is emulated, not actual browser zoom or real-device proof. The scaled graph can truncate labels while the separate selected-details region supplies complete values. Enlarged captures scroll that pane to reveal Reference; Node and Status may then lie above its current scroll position. No simultaneous-all-values visibility claim is made.

Current mobile lab LCP is 452 ms with a paragraph element, CLS 0.06351460479405793, and maximum qualifying scripted Event Timing is 56 ms. All three quality samples have positive LCP, CLS below 0.1 and zero ordinary console/resource errors. These are unthrottled local synthetic observations, not field INP or production performance percentiles. Canvas FPS remains governed by the separately recorded prescribed C4 performance tests; this package adds no FPS claim.

There are thirty-eight passing capture aliases and twenty-three distinct passing contents, all inspected at original resolution. Thirty-two aliases/twenty-two contents belong to the initial sixteen cases; the quality samples add six aliases and one distinct desktop image. Their manifests and inspection receipts retain original hashes and actual recording times. The before-failure image was separately inspected. The source-copy manifest records byte identity before formatting; JSON formatting preserves parsed values and does not relabel its native times. The initial copy-verification receipt is historical. text-normalization.json records the later LF and trailing-whitespace normalization of the three focused log copies, their original and committed-content hashes, and the preserved raw originals outside Git.

## Design assessment

| Area          | Points | Basis                                                                                                                                                               |
| ------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility |     25 | Zero serious/critical axe violations; keyboard selection and drawer recovery; incomplete contrast is disclosed.                                                     |
| Responsive    |     11 | No horizontal overflow; conservative deductions of three for the allowed 15-pixel body and one for the measured 40.5-pixel Skip to content rectangle.               |
| Theming       |     10 | Explicit light color-scheme and theme-color, readable under dark preference.                                                                                        |
| Motion        |     10 | Reduced motion stays still; broad transitions absent.                                                                                                               |
| Performance   |     20 | Current mobile LCP/CLS within ceilings, zero ordinary errors.                                                                                                       |
| Craft         |     17 | Conservative minor deductions for scanning wrapped identifiers, moving between outline/details on small screens and reading full labels outside the scaled diagram. |
| Total         |     93 | Existing tokens/primitives; exceeds A3's 90 threshold. Independent review remains pending.                                                                          |

These are retained presentation tradeoffs, not newly asserted product failures. BRAND permits the 15-pixel body scale; the rubric deduction does not invent a 16-pixel product rule. Current evidence establishes this bounded Canvas presentation, not all broader route acceptance.

## Source identity and previous proof

The source-checkpoint receipt records thirteen application/test hashes. Exactly the two Canvas files and final-ui test differ from b6; the other ten hashes remain identical. Quote and Run runtime proof in ../browser-proof-2026-10-04-tablet-review-repair/ retains its source 74b98486204c22e41b76072a6eba833e14609a57 and remains valid for the unchanged Quote/Run runtime. Its old all-thirteen hash equivalence is not asserted at this new source. Earlier Canvas/route proof keeps its own original scope; this package supplements the changed Reference typography.

Author preflight on 0ad0ebf exited 0 from 03:28:26.8628464 to 03:33:53.7276224 UTC, Node 24.21.0 and pnpm 11.12.0. It reported the active packet with no blocker or pending decision. The local production build exited 0 from 03:35:25.6927006 to 03:35:54.1397811, pinned Node 24.18.0/pnpm 11.12.0. No environment file was created. Prior build artifacts were moved to a verified outside preservation path; nothing was deleted. Core providers and queues stayed off. Owned web PID 72316 and Core PID 65740 were stopped only after executable, script and creation-time checks, both actual exits 0; ports 3115 and 8790 were free at 03:45:31.4206079.

Diagnostics are preserved: cmd.exe rejected direct parenthesized path arguments before Prettier started, actual exit 255; narrow unique globs formatted successfully and the test was rerun. An inventory helper used an unavailable URL global, and the filename-based browser call was denied by allowed-root policy before execution. Corrected inventory and inline authored capture code succeeded. The first evidence-checkpoint wrapper exited 1 before commit because cached diff-check found two trailing spaces in the native red log copy. LF and trailing-whitespace normalization resolves that check while the raw originals remain unchanged. Canonical checkout, MCP configuration and every prior artifact were preserved. These are outside-driver/wrapper diagnostics, not validator crashes or sandbox reviewer starts.

## Remaining acceptance

Full exact-head C4 and C5 must pass before merge and the guarded release. Public smoke comes after deployment. Founder input and production schema lag still keep authenticated production acceptance pending. Software film D4 work, the operator-gate trace, remaining contract work, packet succession and observation are unchanged. No remote database/Auth write, credential export, provider/queue execution, generation, spend, public send, configuration change, deletion or history rewrite occurred.

Next action: run refreshed C4 on the candidate including this source-equivalent evidence.
