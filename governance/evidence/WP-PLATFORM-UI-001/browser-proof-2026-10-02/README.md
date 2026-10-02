# Browser proof, 2026-10-02

Packet `WP-PLATFORM-UI-001`, steps `ui-005-sweep` and `ui-006-browser-proof`. Driver: the shared
Playwright MCP server (Chromium, isolated profile). Public pages and the signed-in shell were proven
against the local harness (`node packages/db/scripts/start-platform-knowledge-local.mjs`: web
`127.0.0.1:3111`, Core Miniflare `127.0.0.1:8789`, local Supabase) with a synthetic owner
(`ui-program-owner@synthetic.example.test`). Campaign screens whose live states need a provider run
were proven in the preview fixture mode (`MBV_LOCAL_GOLDEN_PREVIEW=1`, `/studio/lumen-skin/*`) and,
where the local Core allows it, live.

Each cell below was probed for horizontal overflow, sub-44px targets without a hit area, serious or
critical axe violations (WCAG 2.0/2.1/2.2 A and AA tags), kill-list words, arrows and middle dots,
and one `main` landmark. `probes.json` beside this file holds the raw probe output; the PNGs are
viewport captures unless named `-full`.

## Public pages

| Route               | 375 | 768 | 1280 | 1920 | Notes                                                                |
| ------------------- | --- | --- | ---- | ---- | -------------------------------------------------------------------- |
| `/`                 | yes | yes | yes  | yes  | Reserved hero frame, two offers, cadence, objection, booking line.   |
| `/es`               | yes | yes | yes  |      | Locked Spanish only; `html lang="es"` from the server.               |
| `/software`         | yes | yes | yes  |      | Film hidden until it can play; reduced-motion play button.           |
| `/software/pricing` | yes | yes | yes  |      | Provisional catalog, no buy button, tabular prices.                  |
| `/login`            | yes |     | yes  |      | Notices and errors separated; invalid field focused after an answer. |
| `/signup`           | yes |     | yes  |      | Collects nothing; request access by mail.                            |
| `/maintenance`      | yes |     | yes  |      | Status screen.                                                       |
| `/unauthorized`     | yes |     | yes  |      | Status screen.                                                       |

## Signed-in shell (live harness)

| Screen                                               | 375 | 768 | 1280 | States captured                                                 |
| ---------------------------------------------------- | --- | --- | ---- | --------------------------------------------------------------- |
| Studio chooser `/studio`                             | yes |     | yes  | empty (no studios), success                                     |
| Studio overview                                      | yes | yes | yes  | attention list from real findings, empty approvals and channels |
| Studio brands, calendar, approvals, tasks, team      | yes | yes | yes  | empty and success                                               |
| Studio creators, reports, settings                   | yes |     | yes  | honest empty, success                                           |
| Brand overview, draft, intelligence                  | yes | yes | yes  | not-started knowledge, saved draft                              |
| Brand campaigns, calendar, assets, channels, content | yes |     | yes  | honest empty with the one action                                |
| Brand inbox, results, locations, settings            | yes |     | yes  | honest empty, owner settings and grants                         |
| Workspace billing                                    | yes |     | yes  | missing profile, charging off                                   |
| Campaign brief (live)                                | yes | yes | yes  | first use, filled, upload refused by switch, upload accepted    |
| Campaign plan (live)                                 | yes |     | yes  | loaded, stale revision conflict, recovered after reload         |
| Campaign budget (live)                               | yes |     | yes  | provider switch (503 with reason), billing block (402)          |
| Collaborators, campaign calendar, campaign approvals | yes |     | yes  | studio team listed, honest empty                                |

## Campaign screens (preview fixtures)

| Screen            | 375 | 1280 | States                                         |
| ----------------- | --- | ---- | ---------------------------------------------- |
| Budget (quote)    | yes | yes  | ok, expired, cap exceeded, revision conflict   |
| Run               | yes | yes  | running to complete, failed with recovery      |
| Content (review)  | yes | yes  | artifact groups, approval, QA findings         |
| Compare           | yes | yes  | comparison pairs                               |
| Results (receipt) | yes | yes  | verified export, approval incomplete, conflict |

## Totals

| Measure                                            | Result |
| -------------------------------------------------- | ------ |
| Cells captured (route by width)                    | 97     |
| Cells with horizontal overflow                     | 0      |
| Cells with more or fewer than one `main`           | 0      |
| Cells with a kill-list word or internal phase name | 0      |
| Cells with an arrow or middle dot in live copy     | 0      |
| axe runs (375 and 1280 cells)                      | 80     |
| axe serious or critical violations                 | 0      |

Sub-44px boxes that remain are compact controls carrying the 44px pseudo-element hit area the UI
package already uses (`.mbv-button`, the quote's back link, the campaign step links and skip links).

## Forced colors, reduced motion, keyboard

Recorded in `probes.json` under `forcedColors`, `reducedMotion` and `keyboard`. With
`forced-colors: active` the studio overview, the brand draft and the blocked quote keep their
borders and text (three captures named `*-forced-colors-d1280.jpg`). With
`prefers-reduced-motion: reduce` the studio overview and the live plan report no running
animations other than sub-200ms opacity transitions. Tabbing from the top of the studio overview
visits 18 controls in reading order, every one on screen with the 2px signal outline, and the skip
link moves focus to the main landmark.

## Journeys

- Preview journeys (`final-ui`, `campaign-resume-recovery`, `cleanroom`, `operator-self-session`,
  `canvas-stress`): 55 passed, 1 skipped (`e2e-preview-final.log`).
- Connected journeys (`platform-connected`, `platform-knowledge-connected`) against the harness:
  17 passed after the spec premises moved to the new shell (brand creation lands on the draft,
  switching keeps the section, the studio query is built from the id, revoking asks first).
- Live campaign path: brief filled, packshot uploaded against the fixture bindings, plan opened
  with the context in the link, a stale revision forced from a second tab and recovered through
  "Reload latest revision", and the budget step naming the generation switch as a setting with no
  charge (`campaign-budget-switch-*.jpg`).

## Session expiry and tenancy

- A studio page opened without a session redirects to `/login?next=<path>` on the server; a
  request that loses its session mid-page renders the "Your session ended" recovery with a sign-in
  link that returns to the exact screen.
- A forged workspace or brand id renders the "unavailable or your access has changed" recovery and
  never another account's data (connected journey `hides forged identities`).
- Switching brands keeps the section and the studio; a repeated `view` parameter falls back to the
  overview.

## Repeated submits

- `create_studio`, `start_brand_draft` and the invitation form send a fixed idempotency slug per
  mount and disable their fieldset while pending; a second click neither double-writes nor
  re-enables the form until the server answers.
- `quote_run`, `start_run`, `approve_artifacts`, `cancel_run` and `create_export` carry
  idempotency keys from `createMutationIdempotencyKey`; the run start reuses one key per quote id.

## Decisions recorded here

- Studio voice counts stay as words ("four to eight") and prices stay as the locked strings; the
  lint rule asking for numerals and `Intl.NumberFormat` was declined for locked brand copy.
- The studio hero media branch is unreachable in this release (`studioHeroMedia` is `null`); the
  panel overlapping native video controls in that branch is parked with the poster work.
- The preview billing fixture keeps its sample labels; it renders only in the local preview.
- The campaign nav keeps the current step reachable even when its inputs are missing from the
  link, so a refresh never strands a screen.
- The signed-in shell's element defaults use zero-specificity selectors so workflow modules and UI
  primitives keep their own styles inside the frame.

## Parked, with reproduction

- `supabase/tests/database/00003_p0_barrier_and_invariants.test.sql` updates every row of
  `public.canvases` without a workspace filter. On any local database that has ever held a canvas
  the file aborts with a head-revision foreign-key error before its first assertion, and
  `canvas_revisions` is immutable by trigger so the rows cannot be removed. Reproduce: create one
  canvas through the brief, then `pnpm supabase:test`. The file is outside this packet's paths; the
  gate was run against a freshly reset local database (see the gate record).
- Collaboration presence shows "Error" on local canvases because the collaboration Worker is not
  configured in the harness; the refusal copy is the honest state.
