# Browser proof, 2026-10-02, public site

Taken against code head `043c13338c6eba4ed0d9457662c1840240b4db15` (the last commit that changes
source on branch `codex/public-site-finish`; the footer's unpublished-street-address line and the
final legal copy are in it). Local harness (`node packages/db/scripts/start-platform-knowledge-local.mjs`:
web `127.0.0.1:3111`, Core `127.0.0.1:8789`), driven through the shared Playwright MCP server,
Chromium, device pixel ratio 1, signed out. Captures are JPEG; the 375px and 1920px captures are
full page, the 1280px captures the first viewport. Measurements in `public-probes.json`.

## Ten routes, four widths

`/`, `/es`, `/pricing`, `/software`, `/software/pricing`, `/privacy`, `/terms`, `/advertising`,
`/login` and `/signup` at 375 by 812, 768 by 1024, 1280 by 800 and 1920 by 1080, forty cells:

- No horizontal scroll in any cell. One `main` on every page. The h1 measures 28px everywhere.
  No console error and no page error across the run.
- The one footer is on every one of the forty cells with the entity, the `tel:` and `mailto:`
  links, "Houston, Texas", "Street address not yet published." and the three legal links; the
  studio footer adds `/pricing` and names the software in one line, the software footer names the
  studio in one line, the legal and signed-out screens link both. Every footer link measures at
  least 44 by 44px; the only controls under 44px anywhere are the skip links, off screen until
  focused.
- Headers: `/` and `/pricing` carry Español alone, `/es` English alone, `/software` Plans alone,
  `/software/pricing` Software alone, the legal pages the wordmark alone, the signed-out screens
  no header.
- Home, 375px: the action at 227px and both prices in the frame at 398px and 473px of an 812px
  viewport, before any included line; the same on `/es`. Six composed rows on `/`, none on `/es`.
  One JSON-LD block on `/`, `/es`, `/pricing` and `/software`, none on the other pages.

## Reduced motion, forced colours, keyboard

Under `prefers-reduced-motion: reduce` the studio page runs no animation and its visible text is
the same length as without the preference (2300 characters at 375px): every word stays. Under
`forced-colors: active` the add-on rows and the footer borders resolve to the system text colour
(`home-forced-colors.jpg`, `pricing-forced-colors.jpg`). Tabbing through `/` visits fifteen stops,
`/pricing` twelve and `/privacy` nine; every stop shows the 2px ring.

## Earlier in the same run

An earlier pass on the same routes, before the footer line and the final legal copy, measured the
offers packed to the top of their columns from 768px (offer at 408px, price at 459px, list at
500px on the wide home page) and `sitemap.xml` with the eight public pages; those parts of the page
did not change afterwards. Preview journeys 112 passed and 40 skipped; connected journeys 17
passed, both on the working tree that became `79134f9`.
