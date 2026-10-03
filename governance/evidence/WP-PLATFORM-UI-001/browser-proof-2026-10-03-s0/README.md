# S0 studio hero browser proof, October 3, 2026

Driver: Playwright MCP, isolated signed-out Chromium contexts, production `next start` build at `http://127.0.0.1:3115`. Source is the S0 product change containing this evidence, based on `c0b39c989a68b6be05f00eff883e288eb5e68cc0`. The pull request records the exact candidate commit and fresh-clone gates. These captures prove local rendering and playback, not a production release or real-user performance.

Owner directive `owner-directive-2026-10-02d.md` A8 approves the English wordless plate. A11 selects a poster-only Spanish route: decorative alt, no playback control, no video and no track. The new description and the exact A8 disclosure are English with `lang="en"`, outside the picture. The locked Spanish strings are unchanged. No form, telephone link or email link was activated.

## Design QA

One iteration, scored against design-qa-loop with the procedure's stricter 90-point gate. All unique screenshot contents were inspected; byte-identical captures share that visual inspection. `screenshot-identities.json` lists every PNG hash and its equivalent captures.

| Route        | Accessibility /25 | Responsive /15 | Theming /10 | Motion /10 | Lab performance /20 | Craft /20 | Total | Gate |
| ------------ | ----------------- | -------------- | ----------- | ---------- | ------------------- | --------- | ----- | ---- |
| /            | 25                | 12             | 10          | 10         | 20                  | 19        | 96    | Pass |
| /es          | 25                | 12             | 10          | 10         | 20                  | 19        | 96    | Pass |
| /advertising | 25                | 12             | 10          | 10         | 20                  | 20        | 97    | Pass |

Responsive deducts three points on every route for the existing 15 px body/footer text. Studio main content is 16 px. This finding is carried to D3's explicit footer correction; no readability finding is hidden by the score. The single minor craft deduction on each studio route is desktop letterboxing: the capped frame retains the whole approved 16:9 composition rather than cropping its hands and gimbal.

| Route        | 375 light/dark | 768 light/dark | 1280 light | 1920 light | 1440 light/dark | Reduced | Forced colors | Zoom emulation | Text 200% |
| ------------ | -------------- | -------------- | ---------- | ---------- | --------------- | ------- | ------------- | -------------- | --------- |
| /            | Pass           | Pass           | Pass       | Pass       | Pass            | Pass    | Pass          | Pass           | Pass      |
| /es          | Pass           | Pass           | Pass       | Pass       | Pass            | Pass    | Pass          | Pass           | Pass      |
| /advertising | Pass           | Pass           | Pass       | Pass       | Pass            | Pass    | Pass          | Pass           | Pass      |

All 24 normal cells and 12 special-state cells have no horizontal overflow, no serious or critical axe violation, no incomplete axe result and no console error. All normal cells have one main, one h1 at 28 px and the exact visible disclosure. The site intentionally uses the existing fixed paper theme: dark preference was actually requested and verified, while the effective color scheme remains light. `theme-confirmation.json` clarifies that the first matrix's `colorScheme` field recorded effective CSS instead of the requested preference; the capture filenames identify the request.

200% desktop zoom is emulated by a 640 × 450 CSS viewport with device scale factor 2 for a 1280 × 900 display. It is not a claim of native browser zoom. Text-only zoom doubles computed font and line-height values at 1280 CSS px. Neither method lost content or produced text overflow.

## Accessibility and behavior

- Complete tab orders: 16 stops on `/`, 14 on `/es`, nine on `/advertising`; every stop has visible focus and scrolls into view. The skip link bypasses the header; Enter followed by Tab reaches the main booking action or the first legal-content contact link. The existing skip-link pseudo-element provides a hit-tested 44 px target on all three routes (`touch-targets.json`). The smaller anchor border-box alone is not the target size.
- `keyboard-perf.json` and `playback-states.json` contain the accessibility trees for the initial, playing, loading and failure states. The external control exposes its pressed state, controlled frame and live status. No native text/control overlay appears on the picture.
- A trusted keyboard Enter starts the real H.264 clip; another Enter pauses it and restores the poster. Event Timing records Play at 56 ms and Pause at 32 ms. Session INP is 56 ms in this unthrottled local sample (`control-latency.json`); separate next-paint probes are 52.4 ms and 3.7 ms. These are lab observations, not field percentiles.
- Delaying the local MP4 response by 1.2 seconds exposes `Loading the film…`. Canceling during that delay keeps it paused after the response arrives. Changing reduced motion while playing unmounts the clip, disables Play and announces why; changing back requires a fresh request.
- An explicitly synthetic local 503 response unmounts the broken video, retains the poster and announces the retry. Removing the fault and selecting Play fetches a fresh video and resumes successfully. That injected failure produces one expected network console error; normal playback produces zero. This is a recovery test, not a live production incident.
- Empty, permission-denied, stale, draft, saving and conflict states do not apply to these immutable signed-out media/legal surfaces. Unavailable media is covered by the injected-error recovery. There is no quote, metric, editable draft or customer-data state here.

## Performance

Fresh 375 px samples in `keyboard-perf.json`: home LCP 108 ms, Spanish LCP 108 ms, advertising LCP 80 ms; CLS 0 on each. The poster is the IMG LCP element on both studio routes, with a priority preload, reserved geometry and no initially mounted video. An earlier independent home sample was 188 ms with CLS 0 (`initial-poster.json`). In that 375 × 812 normal cell, the booking action ends at 524.4 px and both headline prices end at 760.6 px, inside the first screen.

## Craft critique

First impression: the approved poster leads directly into the locked Houston headline, booking action and prices. The description makes the generated scene explicit without obscuring the picture. Reading order and one blue primary action match the studio direction. The advertising page keeps its plain legal hierarchy and changes only the approved S0 disclosure.

| Finding                         | Severity                           | Recommendation                                                                                                                       |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Existing 15 px footer/body text | Minor; responsive rubric deduction | Apply the already specified D3 typography change, with its own regression and captures.                                              |
| Desktop image letterboxing      | Minor; one craft point             | Retain the approved composition; any later composition improvement must preserve its full content and measured first-fold hierarchy. |

Geist, shipped tokens, border hierarchy and 44 px actions remain consistent. Axe and forced-color cells confirm readable contrast. There is no decorative entrance animation, gradient treatment, badge or invented result. Human legal and Spanish review remain in the existing Owner queue; this browser proof supplies neither approval.

## Tool diagnostics and limits

Two MCP file-loader attempts were rejected before executing because the outside helper path is not in its file-loader roots. The unchanged self-authored helper was then passed through the documented inline-code API; neither server configuration nor canonical checkout changed. A first playback diagnostic used an unavailable sandbox timer and reported a ReferenceError; its full retry used Playwright's timer and completed. These are harness invocation diagnostics, not application failures or crashed repository validators.

The preliminary touch measurements in `control-latency.json` included the anchor border in the pseudo-element's reference box, overstating its height and missing its bottom hit. `touch-targets.json` corrects that diagnostic using the padding box: all three actual 44 px targets pass both hit tests. No application change was needed.

The JSON observations and all 45 screenshots are retained here. Production C8 media URLs, alias identities and poster LCP must be recorded after the guarded release. `public-surfaces` remains pending until that evidence exists.
