# D3 public hardening browser proof, October 3, 2026

Run: codex-finish-20261002

Packet WP-PLATFORM-UI-001 revision 3, ui-008-release. Source base 526457e1ba38f612e829d2bb47fb9bb1d2a9465f plus the owned D3 candidate, including the final authentication grid repair. The containing implementation commit and its PR identify the exact candidate; fresh C4 and release receipts are recorded after those operations. These observations are local verification, not production acceptance.

Driver: Playwright MCP against the local production build on port 3115. Node 24.18.0, pnpm 11.12.0, Playwright 1.61.1, axe 4.12.1, web-vitals 5.1.0. No public form was submitted, no remote authentication occurred, and no customer data was used.

## Coverage and retained artifacts

The four public matrices cover sixteen routes at 375, 768, 1280 and 1920 CSS pixels: fourteen public routes, a genuine 404 and the expired recovery notice. All 64 cells pass their recorded expectations. Their reports retain status, document language, landmarks, heading size, footer size, accessibility tree, axe findings, CSP violations, application console errors, cookie absence and header assertions. The signup route collects nothing. The literal Spanish root remains es; English roots and the global 404 remain en.

| Evidence                                | Cells | Result |
| --------------------------------------- | ----: | ------ |
| public-375-mcp-after/report.json        |    16 | PASS   |
| public-768-mcp-after/report.json        |    16 | PASS   |
| public-1280-mcp-after/report.json       |    16 | PASS   |
| public-1920-mcp-after/report.json       |    16 | PASS   |
| interactions-mcp-after/report.json      |     6 | PASS   |
| remaining-perf-keyboard.json            |    10 | PASS   |
| themes-mcp-after/report.json            |    35 | PASS   |
| themes-additional-mcp-after/report.json |    45 | PASS   |
| dark-axe-after.json                     |    32 | PASS   |
| auth-containment-after/report.json      |     6 | PASS   |
| mobile-measurement-corrected.json       |    16 | PASS   |

capture-manifest.json identifies 169 byte-identical PNG copies: 163 final AFTER captures and six authentication BEFORE captures. All 132 distinct AFTER contents were visually inspected through native view_image: fifteen hashes match previously inspected content and 117 new distinct contents were viewed. All six BEFORE captures were also viewed. Copies preserve their original bytes; only absolute screenshot references in observational JSON were made relative to this folder. Earlier diagnostic captures and raw logs remain outside Git and earlier repository evidence remains unchanged.

Themes cover all sixteen routes under reduced motion, forced colors, requested dark preference, desktop layout enlargement and text enlargement. The intentional paper theme stays light under a dark preference; color-scheme and theme-color are present. Dark-preference axe scans at 375 and 1280 report zero violations and zero incomplete results in all 32 cells. Normal cells have no transition: all. Reduced-motion reset computes an inert all property with zero duration; those reset declarations are not animated transitions. No running animation or moving studio video was observed under reduced motion.

The desktop 200% layout check uses a 640 CSS-pixel viewport at scale two for a 1280-pixel physical image. Text enlargement doubles each element's original computed font size once while retaining spacing and dimensions. These are explicit emulations, not native browser zoom. They show no lost content or authentication control overflow. The final six authentication regressions also exercise visible inputs and buttons at 375 and 1280 with doubled text.

## Design score

Scores use design-qa-loop's 100-point rubric. The brief's A3 gate is at least 90 per route; the lowest here is 93. The score concerns these public surfaces and does not close signed-in product acceptance. Brand tokens, fonts, semantic roles, hierarchy and existing primitives are retained. No generic design tell was introduced.

| Route                   | Accessibility /25 | Responsive /15 | Theme /10 | Motion /10 | Performance /20 | Craft /20 | Total |
| ----------------------- | ----------------: | -------------: | --------: | ---------: | --------------: | --------: | ----: |
| /                       |                25 |             15 |        10 |         10 |              20 |        20 |   100 |
| /es                     |                25 |             15 |        10 |         10 |              20 |        19 |    99 |
| /pricing                |                25 |             15 |        10 |         10 |              20 |        20 |   100 |
| /software               |                25 |             12 |        10 |         10 |              20 |        17 |    94 |
| /software/pricing       |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /privacy                |                25 |             12 |        10 |         10 |              20 |        19 |    96 |
| /terms                  |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /advertising            |                25 |             12 |        10 |         10 |              20 |        19 |    96 |
| /login                  |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /signup                 |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /forgot-password        |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /verify-email           |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /maintenance            |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| /unauthorized           |                25 |             12 |        10 |         10 |              20 |        20 |    97 |
| Genuine not-found       |                25 |             12 |        10 |         10 |              16 |        20 |    93 |
| Expired recovery notice |                25 |             12 |        10 |         10 |              20 |        20 |    97 |

All routes have zero serious/critical axe findings and complete visible keyboard focus. The responsive deduction of three points on product, auth, status and legal pages is the generic rubric's text-under-16 rule: the approved product body remains 15 px and secondary metadata can be 13 px. Actual visible studio paragraphs on /, /es and /pricing are 16 px; a generic root-body reading of 15 px does not measure their studio wrapper. Every footer is 16 px.

The initial matrix's smallTargets value of one measures the skip link's visible border box only. mobile-measurement-corrected.json proves its transparent pseudo-element hit area is 44 px with elementFromPoint hits at both edges on every route. mobile-measurement-initial.json retains the first measurement, which incorrectly included two border pixels and reported 46 px and a false lower-edge miss. Correcting the padding-box origin yields 44 px and two successful edge hits; no source was changed for that diagnostic correction.

The 404 performance deduction conservatively retains Chromium's expected failed-document resource console entry. Application errors and CSP violations remain zero; this expected 404 entry is separately counted rather than suppressed. The /software craft deduction carries the known moderate small-type/internal-label film finding to D4. Minor craft deductions carry the named Spanish review input and the separately prepared legal date/session-fact corrections. They are not represented as fixed in this proof.

## Craft critique

The studio headline and reserved work frame establish the subject first. Pricing follows the two approved offers and one booking action. Software retains its product voice and an explicitly closed enrollment state. Auth and status screens preserve context, explain the available recovery and remain readable with enlarged text.

| Usability finding                                                                       | Severity           | Disposition                                                                            |
| --------------------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------------- |
| Auth inputs escaped their cards under doubled text before the repair                    | Moderate, repaired | minmax(0, 1fr) tracks and bounded input width; six true failing-to-passing regressions |
| Existing software film type is small on a phone and includes an internal label          | Moderate           | D4 P1/P0 replacement or documented discard; unchanged here                             |
| Spanish reviewer remains unnamed                                                        | Minor              | Existing owner input; no new Spanish                                                   |
| Advertising date and privacy session description need narrowly authorized factual edits | Minor              | Prepared owner packs; legal visitor wording unchanged                                  |

Hierarchy stays restrained: the main heading, action and exact prices lead; quieter legal and account information follows. Footer text now has the same readable floor on all public families. Colors and spacing come from the existing system. Native video controls remain operable through Chromium's accessibility tree; internal Pause, timeline, full-screen and More controls were tested with keyboard focus rather than judging only the host VIDEO element.

## Accessibility, keyboard and measurements

The reports retain names, roles and landmarks for WCAG 1.3.1 and 4.1.2; axe contrast checks cover 1.4.3 and 1.4.11; keyboard and skip-link checks cover 2.1.1, 2.4.3 and 2.4.7. The 44 px skip hit test applies the rubric's target floor. This is browser/accessibility-tree evidence, not a claim of testing NVDA or VoiceOver.

All sixteen routes complete a keyboard traversal with visible, on-screen focus and wrap to the first control. Enter on the skip link reaches the main target. The changed login wordmark reaches home through keyboard activation. Home media Play/Pause and reduced-motion still/status behavior pass. The existing software film has actual playback, pause and four caption-time observations, with native control focus checked through CDP accessibility nodes.

At 375, unthrottled local lab LCP is 100 ms on / (poster IMG), 128 ms on /es (poster IMG), 168 ms on /software (VIDEO), 100 ms on /login, 124 ms on /advertising and 68 ms on the 404. Remaining routes range from 84 to 152 ms. CLS is zero in all measured cells. The studio poster-LCP requirement applies to the studio routes; software's measured VIDEO element is reported literally. Trusted scripted web-vitals INP samples are 40/64 ms for home, 80/88 ms for software and 48 ms for the changed login link, all below 200 ms. These are local lab samples, not field percentiles or real-device results. No form submission performance is claimed.

## Regressions, headers and limits

focused-before.json and its excerpt record exit 1 with 40 failed and 39 passed tests before the new implementation; failures include missing modules as well as changed assertions. focused-after.json records exit 0 with all 90 tests passing. Corrected doubled-text BEFORE records six actual failures, exit 1; AFTER records six passes, exit 0. The earlier uncorrected test included hidden server-action inputs and is retained as a diagnostic, not the accepted reproduction.

author-gates.json records all seven author commands exiting zero, including agent:verify at 18:54:50.9143838Z, 61 database files / 1181 assertions and production-build cache-boundary verification. cache-boundary-final.json proves sixteen guest/session-cookie responses and twelve actual Node HTTP Host redirects. fetch-host-driver-diagnostic.json explains why fetch's normalized Host was unsuitable; wire-www.json and the final Node HTTP probes supply the real redirect evidence. extended-headers-local-final.json covers fourteen public documents, generated SEO files and five media/poster/track resources; all 22 pass.

The first proof-copy helper stopped after copying the captures, reports, receipts, owner packs and two excerpts because the zoom receipts have no Log field. Existing copies were preserved. An explicit helper used the actual retained zoom log filenames and completed the three missing excerpts. This was an evidence-preparation error, not a validator crash or failed product gate.

Parent 48d74b8ca575233b88a370c6913c38139e344aa9 subsequently passed fresh C4 and seventeen connected journeys. Its real signed-in production check exposed a Zod eval probe; signed-in-csp-repair/README.md retains the failure, narrow bootstrap repair, three failing-then-passing validation regressions, four passing real-session widths and sixty-four fresh guest cells. Renewed exact-head gates and C5 review are required for the repaired source. Staging/production proof remains a separate release step. primary-flows and release-smoke stay pending.
