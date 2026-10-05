# Quote and Run review repairs, October 4 run

Run: codex-finish-20261002

This supplements the [original tablet package](../browser-proof-2026-10-04-tablet/README.md) for WP-PLATFORM-UI-001 revision 3, step ui-008-release. Application source is 74b98486204c22e41b76072a6eba833e14609a57. These are production-rendered local layout and recovery mechanics with synthetic inputs. Exact final-head C4, independent review and the guarded web release are pending when this package is committed. primary-flows and release-smoke remain pending. No whole-platform completion or authenticated production acceptance is claimed.

The run-date suffix remains October 4 in America/Chicago; actual UTC measurements below span October 4 and 5. Recording times are preserved in the receipts and inspection batches.

## Repairs and source

Timer expiry without a confirmation attempt leaves the confirmation result null. A successful re-quote now focuses the still-mounted heading directly, independently of changes to that result. Confirmation refusals keep their existing focus effect. Recovery resets acknowledgment and keeps Confirm disabled until a fresh acknowledgment. The regression advances the real 15-minute expiry with the repository's controlled test clock and never confirms a run.

Quote and Run use a two-pixel inset focus outline on their named complementary regions. Stacked or short frames use document flow, with the summary's own scroll area bounded to 50dvh. This keeps all four focus edges inside the viewport and clipping ancestors after End. Arrow keys can bring the complete final monetary row into view when Quote's explanatory paragraph follows it. The tests retain a maximum of twelve ArrowUp steps and require the complete row and outline afterward.

Original-resolution inspection then found a separate horizontal value defect: long Quote route and revision fields widened the coverage grid's min-content track and pushed monetary values beyond the panel. The coverage track now uses minmax(0, 1fr); term/value pairs wrap, shrink and break long text within the available width. Values keep right alignment. No monetary contract or value changes. Four doubled-text regressions use explicitly synthetic long route/revision text while preserving the preview money. Three failed before the CSS fix; all four pass afterward.

The code checkpoints are 13e65d78867a9dd31bd77f102a515df1606fa535, 0b9f33bd340c501bc02047ef8e911a028afadeda and 74b98486204c22e41b76072a6eba833e14609a57. [source-equivalence.json](source-equivalence.json) and [source/checkpoint.json](source/checkpoint.json) record the thirteen current application/test hashes. Since the first reviewed candidate b7fb3c39a0fc1556e77ca616550fb4a6cb9e12ac, only QuoteFlow, its CSS, Run CSS and final-ui tests changed. The other nine scoped files retain their bytes. The earlier package supplies unchanged route, state, Canvas and shared-shell proof at its stated source level; it is not relabelled as a capture of the new whole tree. Its old Quote/Run focus claims are superseded by the current proof here.

## Native browser matrix and originals

[native-current.json](native-current.json) is the parsed result of the existing Playwright MCP, Chromium 154.0.4258.48, source 74b98486204c22e41b76072a6eba833e14609a57. Its native tool response succeeded; a native MCP result has no CLI exit code. All twenty-six cases pass their named predicates:

- Quote and Run each have the seven design-qa-loop cells: mobile light/dark, tablet light/dark, desktop light/dark and mobile reduced motion.
- Each also has reduced-motion 1280 and 1920, doubled text at 1280 by 900 and 1280 by 600, emulated 200-percent reflow at 640 by 450, and forced colors.
- Every case has HTTP 200, one main, no document horizontal scroll, no summary horizontal scroll, six contained definition values and text ranges, all four focus borders, keyboard reachability of the last row, zero serious or critical axe violations and zero console/page errors or failed HTTP requests. Reduced-motion cells have no running motion or broad transition properties.

[capture-manifest.json](capture-manifest.json) accounts for 81 original PNG names and 57 distinct contents. One byte-identical original per hash is under images; aliases resolve through the manifest. [inspection.json](inspection.json) documents all 57 original-resolution inspections with actual recording times and observations. No original was resized, edited or composited. The separately labelled before image is a diagnostic, outside that current count.

Both requested color preferences retain the product's intentional light design, which remains readable. This proves that preference behavior, not a separate dark theme. The text-only check freezes measured fonts and line heights, then doubles them once. The 640 by 450 viewport emulates a 1280 by 900 viewport at 200 percent. Neither is claimed as actual browser zoom, real-device testing or a real assistive-technology session.

The nine retained accessibility trees show named main/navigation/regions, heading levels, Quote's six terms and definitions, the acknowledged maximum, disabled Confirm, the expired alert and re-quote action, Run's settlement values/status and output-review action. Recovery focuses the existing heading. Axe's color-contrast incomplete entries remain disclosed; their plain light-background text was also inspected visually. An incomplete entry is not silently converted into a reported violation or a numerical contrast result.

## Runtime and measurement limits

The clean local production build in C:/dev/mbv-verify-3082e90-perf actually exited 0 from 2026-10-05T00:38:20.6254874Z to 00:38:46.4404811Z, with Node 24.18.0 and corepack pnpm 11.12.0. Preview bypass is disabled. The preliminary build explicitly reused the passed parent orientation and matching focused repair hashes; full final-head C4 remains required. Current C1 preflight then passed on 74b98486204c22e41b76072a6eba833e14609a57, actual exit 0, 00:55:10.5286448Z to 00:58:56.2141599Z, PATH Node 24.21.0 and pinned pnpm.

The browser signs into one fresh local synthetic fixture. Browser-intercepted Quote, Run, Canvas context, project and brand mapping DTOs prove layout mechanics only; other GETs use local Core. Fifteen Quote POSTs are intercepted in the browser, zero forwarded. All other mutations and external requests are blocked; zero external requests were observed. Fake providers and queues remain off. No real customer, remote sign-in, remote database write, provider run, charge or submitted confirmation is involved.

| Current ordinary 375-pixel lab sample | LCP ms | CLS | Console/page errors |
| ------------------------------------- | -----: | --: | ------------------: |
| Quote                                 |    484 |   0 |                   0 |
| Run                                   |    324 |   0 |                   0 |

These unthrottled samples are taken before test-only font enlargement. Artificial enlargement shifts remain separate and are not page-load acceptance. Native-clock qualifying Event Timing entries after actual keyboard summary interactions are present for both families in every matrix case; the maximum is 96 ms, below the unchanged 200 ms ceiling. Quote reaches at most 64 ms. Field INP is unmeasured; an absent entry is never a zero.

The native timer-only check uses an explicitly synthetic 4.5-second expiry. It proves recovery mechanics, not the actual 15-minute contract, which the separate repository regression exercises. The document is foreground-visible at acknowledgment and after recovery; heading focus, unchecked/enabled acknowledgment, disabled Confirm and no confirmation attempt all pass. Qualifying native interactions are 56 and 64 ms, with CLS 0.02248019360436334. No virtual clock is used in this native measurement.

Owned web PID 20396 and Core PID 64240 were stopped after executable, launch-script and creation-time identity checks. Both actual taskkill exits are 0, ending at 01:01:16.8843570Z and 01:01:17.6581145Z. Ports 3115 and 8790 were free at 01:01:19.7451268Z. No file, fixture, clone, backup or other session's process was deleted.

## Regression and diagnostic history

[regression-results.json](regression-results.json) contains selected native test names/results, reported counts and failure messages. The complete Playwright environment reports and raw MCP response are excluded. Original commands, actual intervals, exits, versions and hashes remain in receipts.

| Focused run                  | Before: failures/passes | Before exit | After: passes | After exit |
| ---------------------------- | ----------------------: | ----------: | ------------: | ---------: |
| Timer-only and inset outline |                     3/1 |           1 |             4 |          0 |
| Bounded stacked focus        |                     4/4 |           1 |             8 |          0 |
| Long Quote value containment |                     3/9 |           1 |            12 |          0 |

The final twelve-case GREEN ran 2026-10-05T00:34:51.3243727Z to 00:35:15.9817386Z and reports 22.9 seconds. Its final-ui hash is 400f05e9530770e00f18e0f2588993d81990e0e357b7516904b813bc7bd0ba07; the repaired Quote CSS hash is 39b4b1a83e696e288df50df709f3e8a7927ba7d21f199aaec47b65a11477aeb4. Both match the committed checkpoint. No check, test, golden, assertion, threshold or hook was disabled or removed.

Earlier diagnostics remain failures at their measured scope. The first mouse-modality outline attempt did not prove keyboard focus. The first inset-only native matrix on 13e65d failed six containment cases; [its diagnostic](diagnostics/prior-outline-result.json) preserves them. The bounded fix on 0b9f33b passed focus geometry but did not measure internal horizontal value loss; [the later original inspection](diagnostics/prior-value-inspection.json) and [before image](diagnostics/before-quote-values.png) document that separate cause. Current value and text-range containment predicates supplement the earlier geometry checks.

The initial bounded test expected Quote's last row fully visible at End, despite the following explanatory paragraph. It was repaired to require actual reachability with ArrowUp, preserving full outline/row assertions. A controlled acknowledgment check/uncheck before DOM enlargement prevents test-only hydration mutation. The initial short-label value experiment passed and is not a RED; explicitly longer synthetic fields reproduce the real layout cause. One formatter command exited 255 when Windows rejected parentheses in its argument before Prettier ran; the verified single-file glob retry exited 0. None is hidden as a validator pass or crash.

An earlier native timer sample took 5168 ms while the document was backgrounded; it is an unusable performance diagnostic, not a passing latency. A prior capture-inventory helper emitted unsupported Span diagnostics despite exit 0; its result is not used. The earlier native Canvas 32 FPS/blank-frame baseline remains a failed environment sample in the original package; the separate repository Chromium result remains scoped to that environment. Fresh C4 Canvas measurements are still required. No MCP, browser dependency or agent configuration changes were made.

## Rubric and remaining work

These author scores apply to the repaired routes using the existing tokens/primitives. A3 requires the exact-head independent PASS in addition to these scores and zero serious/critical axe violations; it is still pending. The categories follow design-qa-loop. Plain-background incomplete contrast entries are disclosed and visually inspected, not scored as axe violations.

| Route | A11y /25 | Responsive /15 | Theme /10 | Motion /10 | Lab /20 | Craft /20 | Total |
| ----- | -------: | -------------: | --------: | ---------: | ------: | --------: | ----: |
| Quote |       25 |             11 |        10 |         10 |      20 |        19 |    95 |
| Run   |       25 |             10 |        10 |         10 |      20 |        19 |    94 |

Responsive deductions retain the measured 15-pixel mobile body default (-3), physical skip-link size (-1), and Run's 40-pixel footer link (-1); inline text links remain exempt. Craft withholds one point for compact data density, including Run's close Revision term/value at doubled text. First impression, hierarchy and readiness remain clear; money and recovery actions stay reachable; typography, tokens and motion remain consistent with the brand. No new critical or moderate visual defect was found in the 57 current originals. Dense data labels and monospace follow the brand and receive no generic-template deduction. The unchanged Software film remains separately scored 89 and unaccepted under D4.

Read-only migration metadata recorded in C1 orientation 47 reports staging 50 entries through 20260917223105, production 39 through 20260902154759, and main/local 75 through 20260929017000. Alternative staging timestamps do not establish semantic parity. This repair adds no schema dependency, Core runtime, deployment configuration, new resource or visitor-facing Spanish.

The adopted A1–A11 record governs; disk-only A12 is unadopted. Canonical checkout and PR #1 stay untouched. Existing founder and schema stops retain their prepared owner inputs. The operator UI/Core gate trace, D4 films, composer/rejection/mapping contracts, successor chain, migration pack, quality passes and observation remain open. Nothing is parked for this bounded repair. The prior C5 round stays in PR #78's body and is copied only by the next documentation PR after merge.

Next action: complete final-head author/fresh C4 and connected suites, obtain independent C5, then merge and perform the guarded web release.
