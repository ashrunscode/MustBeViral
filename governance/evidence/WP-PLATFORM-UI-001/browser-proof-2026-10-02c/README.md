# Browser proof, 2026-10-02, films program

Local harness (`node packages/db/scripts/start-platform-knowledge-local.mjs`: web `127.0.0.1:3111`,
Core `127.0.0.1:8789`, the local database holding this session's canvases), driven through the
shared Playwright MCP server, Chromium, device pixel ratio 1. Measurements in `public-probes.json`.
Captures are JPEG; the 375px captures are full page, the rest are the first viewport.

## Public pages, four widths

`/`, `/es`, `/software` and `/software/pricing` at 375 by 812, 768 by 1024, 1280 by 800 and 1920
by 1080, signed out:

- No horizontal scroll in any of the sixteen cells. One `main` on every page. The h1 measures 28px
  everywhere. No console error and no page error across the whole run.
- Studio pages: the "Book a test shoot." control and the first price sit inside the first viewport at
  every width (375px: control at 227px, price at 406px of 812). Four `tel:` links. The six kinds of
  work render on `/` (Med spa, Restaurant, Gym, Auto, Home services, Real estate team) and not on
  `/es`. No image and no video element, since no rights-cleared footage exists. The only control
  under 44px is the skip link, which is off screen until focused.
- Software page: the poster is preloaded as the one priority image; four beats as controls; the
  heading, film and beats share the first viewport from 1280px where the beats sit beside the film.
- Search surfaces: `canonical` on every page; `hreflang` en, es and x-default on both studio pages;
  `og:image` and `twitter:card` on all four pages; one JSON-LD block on each studio page
  (`LocalBusiness`, two offers, no address) and one on `/software` (`SoftwareApplication`, no
  offer); `/robots.txt` 200 text/plain, `/sitemap.xml` 200 application/xml, `/llms.txt` 200
  text/plain, the four social cards 200 image/png.

## The film and its beats

At 1280px the film starts muted on its own and the first beat is marked while it plays. Choosing
the third beat seeks the film to 8 seconds: the video's current time read 8.7s, the third beat
carried the running mark and the two beats before it read as done (`software-beat-3-running.jpg`).

Under `prefers-reduced-motion: reduce` the page mounts no video, shows the "Play the film" control
and runs no animation; choosing the second beat is the visitor's request, so the video then mounts
at 4 seconds and the second beat is marked. The studio page runs no animation under reduced motion
at 375px.

## Forced colours and keyboard

Under `forced-colors: active` the studio frame border and the action border resolve to the system
text colour and the action fills with the system button face (`home-forced-colors.jpg`,
`software-forced-colors.jpg`). Tabbing through `/` and `/es` visits eight stops each (skip link,
wordmark, two nav links, the action and the phone twice) and every stop shows a 2px ring. On
`/software` the fifteen stops include the four beats, the sign-in action and the mail link, all
ringed; the five stops inside the native video controls are drawn by the browser's own control
focus and report no CSS outline.

## Signed-in screens

Signed in as the synthetic owner on the local harness only. No horizontal scroll on any screen; no
console or page error.

| Screen              | Seen                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/studio`           | h1 "Choose a studio."                                                                                           |
| studio overview     | h1 "Studio overview"; the slogan is gone                                                                        |
| studio calendar     | "Times in …" names the zone shown; no "workspace time zone" claim                                               |
| brand home          | h1 "UnPile"                                                                                                     |
| brief, 1280 and 375 | primary action "Validate and open the plan"; "Validate brief" absent                                            |
| canvas              | the plan loads with its revision in the link; "Core" absent from the screen                                     |
| campaign approvals  | "Nothing to approve yet." with the brief as the action (no run in the link)                                     |
| access              | h1 "API keys"; "audit" absent                                                                                   |
| skills              | the publish dialog opens with three empty fields and "Publish version" disabled (`signed-in-skills-dialog.jpg`) |
| billing             | "Charging is turned off" present; "P1a" absent                                                                  |

## Journeys

Preview journeys, desktop and mobile projects (`PLAYWRIGHT_PORT=3113`): 112 passed, 40 skipped.
Connected journeys against this harness, desktop project: 17 passed.
