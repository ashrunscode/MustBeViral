# Browser proof, 2026-10-02, follow-up run

Driver: the shared Playwright MCP server (Chromium). Origin: the local harness
(`node packages/db/scripts/start-platform-knowledge-local.mjs`, web `127.0.0.1:3111`, Core
Miniflare `127.0.0.1:8789`, local Supabase) running the same source as the follow-up pull request.
The narrative and the results are in `../follow-up-2026-10-02.md`; `studio-probes.json` holds the
public-frame measurements.

## Public studio frame

| File                                                                         | What it shows                                                                                                              |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `studio-m375.jpg`, `studio-t768.jpg`, `studio-d1280.jpg`, `studio-w1920.jpg` | `/` at 375, 768, 1280 and 1920: the frame with the lead, the action and both offers; `-full` variants carry the whole page |
| `studio-es-*.jpg`                                                            | `/es` at the same four widths, locked lines only                                                                           |
| `studio-keyboard-focus.jpg`                                                  | the 2px signal ring on the second action after tabbing through the page                                                    |
| `studio-forced-colors-d1280.jpg`, `studio-forced-colors-m375.jpg`            | forced colours: CanvasText borders, ButtonFace action                                                                      |
| `studio-reduced-motion-m375.jpg`                                             | reduced motion: nothing animates                                                                                           |

## Signed-in product on the local harness

| File                                                                       | What it shows                                                               |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `signed-in-01-first-screen-d1280.jpg`                                      | first sign-in: create a studio                                              |
| `signed-in-02-studio-home-empty-d1280.jpg`                                 | the studio home before any brand                                            |
| `signed-in-03-studio-home-one-brand-d1280.jpg`, `-m375.jpg`                | the studio home with one brand: attention, approvals, brands, one calm line |
| `signed-in-04-brand-home-d1280.jpg`                                        | the brand home: knowledge, campaigns, one calm line                         |
| `signed-in-05-brief-empty-d1280.jpg`, `signed-in-06-brief-ready-d1280.jpg` | the brief before and after its sections, attestation and packshot           |
| `signed-in-07-plan-d1280.jpg`                                              | the plan opened from the validated brief                                    |
| `signed-in-08-stale-revision-conflict-d1280.jpg`, `-m375.jpg`              | the checkpoint refused on a stale revision with "Reload latest revision"    |
| `signed-in-09-stale-revision-recovered-d1280.jpg`                          | the plan after reloading the latest revision                                |
| `signed-in-10-wrong-workspace-refused-d1280.jpg`                           | a link mixing workspace A's plan with brand B, refused with no data         |
| `signed-in-11-workspace-tools-d1280.jpg`                                   | API keys under the studio that owns a brand in the workspace                |
| `signed-in-12-budget-blocked-switch-d1280.jpg`, `-m375.jpg`                | the budget step with runs switched off: no quote created, nothing charged   |
