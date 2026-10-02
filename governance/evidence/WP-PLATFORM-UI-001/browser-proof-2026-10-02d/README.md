# Browser proof, 2026-10-02, public site

Local harness (`node packages/db/scripts/start-platform-knowledge-local.mjs`: web `127.0.0.1:3111`,
Core `127.0.0.1:8789`), driven through the shared Playwright MCP server, Chromium, device pixel
ratio 1, signed out. Captures are JPEG; the 375px and 1920px captures are full page, the 1280px
captures the first viewport.

## Ten routes, four widths

`/`, `/es`, `/pricing`, `/software`, `/software/pricing`, `/privacy`, `/terms`, `/advertising`,
`/login` and `/signup` at 375 by 812, 768 by 1024, 1280 by 800 and 1920 by 1080, forty cells:

- No horizontal scroll in any cell. One `main` on every page. The h1 measures 28px everywhere.
  No console error and no page error across the run.
- The one footer is on every one of the ten routes with the three legal links, the `tel:` and
  `mailto:` links and Houston, Texas; the studio footer adds `/pricing` and names the software in
  one line, the software footer names the studio in one line, the legal and signed-out screens link
  both. Every footer link measures at least 44 by 44px.
- The studio header carries Español alone (`/`, `/pricing`) and English alone (`/es`); the software
  header carries Plans alone and the plans page Software alone; the legal pages carry the wordmark
  alone.
- Home, 375px: the action at 227px and both prices in the frame at 398px and 473px of an 812px
  viewport, before any included line. At 768, 1280 and 1920 both prices sit beside the lead in the
  first viewport. Six composed rows on `/`, none on `/es`.
- The two offers in full on `/`, `/es` and `/pricing`, packed to the top of their columns from
  768px (offer at 408px, price at 459px, list at 500px on the wide home page).
- `canonical` on every public page; one JSON-LD block on `/`, `/es`, `/pricing` (`LocalBusiness`)
  and `/software` (`SoftwareApplication`); none on the legal pages. `sitemap.xml` lists the eight
  public pages with the studio pair as `hreflang` peers; `llms.txt` carries the add-on ranges, the
  pricing page, the entity, the unpublished street address and the three legal pages.
- The only controls under 44px are the skip links, which are off screen until focused.

## Reduced motion, forced colours, keyboard

Under `prefers-reduced-motion: reduce` the studio page runs no animation and its visible text is
the same length as without the preference (2266 characters at 375px): every word stays. Under
`forced-colors: active` the add-on rows and the footer borders resolve to the system text colour
(`home-forced-colors.jpg`, `pricing-forced-colors.jpg`). Tabbing through `/` visits fifteen stops
(skip link, wordmark, Español, the action and the phone twice, the pricing link, the footer's
phone, mail, four pages and the software line), `/pricing` twelve and `/privacy` nine; every stop
shows the 2px ring.
