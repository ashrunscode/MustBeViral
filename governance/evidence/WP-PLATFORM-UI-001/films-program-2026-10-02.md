# Films program, 2026-10-02

Owner directive of 2026-10-02, second of the day, recorded verbatim in
`owner-directive-2026-10-02b.md`. The director's note it asked for first is
`director-note-2026-10-02.md`. Worktree: the clean clone `C:\dev\mbv-ui-20261001` on `main` at
`origin/main` `20b6e1e51420e0213fd4122201afe95e7173fce8`. The canonical checkout was not used and
nothing under `briefs/` or `.playwright-mcp/` is committed.

## Act 1, the note

Written and pinned before any component was opened. It names, for the studio, the first three
seconds (Houston daylight across a counter, a camera on a gimbal, two hands, the locked line), the
price ($700 and $3,500 as titles in the frame) and the tap (one "Book a test shoot." that dials the
number); for the software, the object that moves (`photo.jpg`, a flat well with its filename) and
the dollar it lands on (the receipt line, and the confirm control that names the quoted amount).

## Act 2, the films

**No Higgsfield call was made and nothing was spent.** Before any call the credentials were looked
for by name only: the vault lists no `HF_API_KEY_ID` or `HF_API_KEY_SECRET`, the vault inbox holds
neither, no user or machine environment variable names them, and no `.env` under `C:\dev` does.
The brief's stop rule 1 and the directive both put the first call after the credentials are in the
owner's environment, so the program stops at the pipeline. The one sentence that clears it: save
`HF_API_KEY_ID` and `HF_API_KEY_SECRET` into `%USERPROFILE%\.agent-secrets\inbox\` (one secret per
file), ingest them, and run the runner through `load.mjs --run higgsfield`. Neither value belongs in
chat or in any file.

What exists, under `briefs/hero/films/` (the owner's brief folder, never committed):

- `higgsfield-run.mjs`: check, upload, estimate, submit, poll and run. It re-reads the live model
  page the day it runs and refuses to send a field the page no longer documents; sends only
  `image_url`, `end_image_url`, `prompt`, `duration` 5, `resolution` 1080p and
  `generate_audio` false; quotes every shot through the estimate endpoint before submitting; uses a
  new `Idempotency-Key` per distinct body and attempt; allows one retry per shot; downloads the
  master the moment a request completes; logs request ids, credits, statuses and local paths only.
- `shots.json`: the brief's 14 product shots.
- `keyframes.html` and `frames/*.png`: 28 keyframes (start and end of every shot) at 1920 by 1080,
  device pixel ratio 1, in the brief's paper-and-ink system with Geist and Geist Mono loaded, no
  overflow, no unwanted wrap. Words and prices are set in HTML; no model redraws them.
- `README.md`: the state above, the live-page facts read on 2026-10-02 (Seedance 2.5
  image-to-video schema, upload flow, billing and retention) and the assembly commands.

The studio masters S0, S0-ES and S1 are blocked by the same sentence: no owned plate exists and no
credential exists to generate a wordless still. The studio pages therefore keep the composed frame
without footage, as released on `0b9f578`.

The software film on `/software` is the P0 master made on 2026-09-29 from the same keyframe system
and shipped on `59a3618`; it is unchanged.

## Acts 3 and 4, the public pages

- Studio, English: the frame is unchanged (locked lines, one action, the two offers with their
  prices as titles). Under it, in order: the cadence sentence; the six kinds of work in the owner's
  words, each as the situation the buyer recognises and then what we do; the objection "Already
  posting?" with its answer under all six; the close. No price, claim or Spanish was added.
- Studio, Spanish: unchanged lines. The six kinds wait for the named fluent reviewer, so the
  Spanish page does not carry them.
- Software: the film keeps its poster as the one priority image; the four beats now sit beside it
  as an ordered list whose times are the caption cue times, the running beat carries the 2px
  attention edge while the film plays, and each beat is a control that seeks the film to it (under
  reduced motion that is the visitor's request to play). Enrollment is closed; the mail link reads
  "Request access by email" so it does not pretend a form exists.
- Pricing: the catalog with "Charging is not on." beside the provisional sentence, fuller plan
  lines (active brands, operator seats, connected accounts, storage), the reviewer-seat fact, and
  sign in as the one action. No buy button.

### Search and agents

- `robots.txt`: the public pages open, the app, auth screens and API disallowed, the sitemap named
  when the public origin is known.
- `sitemap.xml`: the four public pages, the English and Spanish studio pages as each other's
  peer with `x-default`.
- `llms.txt`: a plain-text summary built from the same copy module the pages render (locked lines,
  section 7 offers, tagline, provisional catalog with charging named as off, closed enrollment,
  phone and mail). It cannot drift from the pages.
- JSON-LD: the studio as a `LocalBusiness` serving Houston with the two offers at their exact
  prices, the phone and the mail address and no invented street address; the software as a
  `SoftwareApplication` with no offer, since the catalog is provisional.
- Open Graph and Twitter cards on the four pages, with four paper-and-ink text cards rendered from
  the brief's type scale at twice the size (`public/og/`), and `hreflang` with `x-default`.

## Act 5, the signed-in instrument

A read-only audit of every signed-in route against the five questions produced twelve ranked
findings. Applied in this change:

| Finding                                                              | Change                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Review rendered $0.00 before the read and when no reservation exists | The receipt summary waits for the read; a run with no reservation says "No reservation is recorded for this run. Nothing was charged."                                                                                                    |
| Review conflict leaked "run state" and had no exit                   | `RUN_NOT_APPROVABLE` reads "This run is no longer approvable. Nothing was approved. Reload to see its current state." with the reload control; a revision conflict names the current revision and offers "Reload the review"              |
| Compare approve had no in-flight guard; prior output said "v1"       | One decision at a time; the live prior tile reads "Prior output recorded in lineage" or "No prior output"                                                                                                                                 |
| Composed ad carried a fixed "Shop now"                               | Removed; the footer shows the headline and description the copy artifact carries                                                                                                                                                          |
| Re-quote could be sent twice                                         | Guarded while pending                                                                                                                                                                                                                     |
| "Validate brief" under-named a mutation                              | "Validate and open the plan"; the ready state says validation creates the campaign project and its first plan revision and that nothing is quoted or charged                                                                              |
| Campaign approvals claimed a send-back that does not exist           | "Each concept is approved there. Sending a concept back with a reason is not part of this release yet."                                                                                                                                   |
| Engine and internal names in customer copy                           | "Core", "ViralGraph canvas", "P1a", "Stripe test mode", "authoritative" and the dash-joined wallet states replaced by plain sentences that say what happened and what was kept; the preview billing intro reads "Charging is turned off…" |
| Presence showed "0 live" while unknown and the raw socket status     | "Presence unknown" until a snapshot exists; the status reads Connecting, Live, Disconnected, Unavailable or Not connected                                                                                                                 |
| Fixture text prefilled a live form; dashes stood for missing values  | The Skill publish form starts empty; "Not published" where the dash sat; the access heading is "API keys" until an audit list exists                                                                                                      |
| Slogan headings; a time-zone claim the calendar does not keep        | "Choose a studio.", "Studio overview", "This request did not complete. Nothing changed."; the calendar descriptions no longer name a workspace time zone                                                                                  |

Not changed, and why: the receipt's "Named quote" still formats a missing reservation as $0.00
because the field is typed as a number across the export port and its tests; the campaign-step
dead ends keep their sentence because the step navigation above them is the recovery action. Both
stay on the list.

## Gates

Branch `codex/platform-ui-003`, pull request ashrunscode/MustBeViral#61, base `20b6e1e`. The first
code head was `95cacc6c71acac0638a0686bff9fc6629e50cbc0`; the review repair is
`76245d1ae5709192f81dab6d99c2bfa18b397491`, which changes `review-flow.tsx`, `review-port.ts` and
adds `review-flow.worker.test.tsx`. Every commit after `76245d1` changes only evidence.

On `76245d1`:

| Gate                                                                           | Environment                                                                         | Exit                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Web unit tests                                                                 | author clone `C:\dev\mbv-ui-20261001`                                               | 349 passed (61 files)                                                                                      |
| Web typecheck, lint, repository `format:check`                                 | author clone                                                                        | 0                                                                                                          |
| `corepack pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm supabase:test` | fresh single-worktree clone `C:\dev\mbv-verify-76245d1` at `76245d1`, branch `main` | 0, 0 and 0; database tests 61 files, 1181 tests, against the local database that holds canvases, not reset |

On `95cacc6`, which differs from `76245d1` only by the repair above:

| Gate                                                                                                                                                 | Environment                                                                           | Exit                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `pnpm agent:verify` (format, governance, governance tests, security, task graph, lint, typecheck, unit, integration, build, design, `supabase:test`) | author clone `C:\dev\mbv-ui-20261001`, local database holding this session's canvases | 0; database tests 61 files, 1181 tests                                                                     |
| Web unit tests                                                                                                                                       | author clone                                                                          | 346 passed                                                                                                 |
| Web typecheck and lint                                                                                                                               | author clone                                                                          | 0                                                                                                          |
| Preview journeys, desktop and mobile projects                                                                                                        | author clone, `PLAYWRIGHT_PORT=3113`                                                  | 112 passed, 40 skipped (connected specs skip there)                                                        |
| Connected journeys                                                                                                                                   | author clone against the local harness                                                | 17 passed                                                                                                  |
| `corepack pnpm install --frozen-lockfile`, `pnpm verify`, `pnpm supabase:test`                                                                       | fresh single-worktree clone `C:\dev\mbv-verify-95cacc6` at `95cacc6`, branch `main`   | 0, 0 and 0; database tests 61 files, 1181 tests, against the local database that holds canvases, not reset |

## Browser proof

`browser-proof-2026-10-02c/README.md` and `public-probes.json`, on the local harness. The four
public pages at 375, 768, 1280 and 1920: no horizontal scroll, one `main`, h1 28px, the studio
action and price inside the first fold at every width, six kinds on `/` and none on `/es`, the
search surfaces answering, no console error. The film starts muted, the running beat follows it,
choosing a beat seeks it, and under reduced motion nothing plays until asked. Forced colours keep
the borders and the action legible. Every keyboard stop on the studio pages shows the 2px ring.
Signed in on the harness: the renamed headings and actions are on screen, the Skill form starts
empty with its action disabled, and no screen scrolls sideways. Preview journeys 112 passed and 40
skipped; connected journeys 17 passed.

## Independent review

The read-only Codex review of the exact pull-request head, isolated as the directive prescribes
(fresh shell with credential-like variables removed, every tool and network surface disabled, a
detached clone of tracked files only), is recorded with its sha and verdict in
`merge-review-films-2026-10-02.md` once it has run. Nothing merges before a PASS.

## Release

Recorded in `release-films-2026-10-02.md`. The pull request merged as `95deda5` at
2026-10-02T18:05:39Z. From a clean clone of that commit, staging received
`dpl_HK4J6VQAPKx8Hp8ymxjGUwsLfXbg` and passed its twelve route checks, eighteen build markers,
Core health and a browser pass; production then received `dpl_Bw8Txy9Atvk8yoBocUxv3AEZW5EN` and
passed the same. `https://mustbeviral.com` and `https://www.mustbeviral.com` answer with that
production deployment; the domain was already attached to the production project and nothing about
it was changed. Rollback targets `dpl_5skrFZb2nnZSog6DYhCd82pB7phL` (staging) and
`dpl_3atvTZx8YU5ioq4rkvskGyKvxoVj` (production) stay Ready and unused.

## Not crossed

No Higgsfield call, no spend, no key printed, no customer file uploaded; no DNS, domain, traffic or
cutover change; no Worker setting; no new variable and no environment value copied or printed; no
production database write; no signup collection, generation, charging, posting or provider spend;
no new Spanish; the locked lines and prices unchanged; no price, claim, address or hour that
`brand/context.md` sections 4 and 7 do not state; no deletion of data, branches, backups or another
session's work; nothing under `briefs/` or `.playwright-mcp/` committed.
