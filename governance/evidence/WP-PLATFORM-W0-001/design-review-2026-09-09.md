# Full-platform design review

State: **OWNER VISUAL DIRECTION APPROVED; IMPLEMENTATION EVIDENCE IS LOCAL DESIGN ONLY.** Desktop and mobile artifacts implement an interactive, local walkthrough. They do not implement persistent studio/brand APIs, website crawling, asset uploads, publication, or real approval.

Frames: `.superdesign/hifi/platform-studio-desktop.html` and `.superdesign/hifi/platform-studio-mobile.html`, with shared `platform-studio.css` and `platform-studio.js`. Open either HTML file locally or use the local review server at `http://127.0.0.1:3110/platform-studio-desktop.html`. The server is session-local, loopback-only, and serves the design folder; no deployment exists.

## Walkthrough and visual inspection

1. Overview shows two clearly identified sample workspaces and actionable needs without fabricated metrics.
2. Brand draft captures name/site/context and continues to sample findings. The form is a design interaction, not persistence proof.
3. Findings distinguish owner input, unknown service hours, missing offers, corrections and proposed approval. No completed crawl is implied.
4. Asset library uses original WashBodega logo/storefront material and UnPile website imagery and wordmark font. Both preserve publication rights review. Workspace, campaign and operational records remain synthetic local fixtures.
5. Campaign plan separates ideas, drafts and an honestly empty scheduling lane.
6. Review shows a 4:5 composition with original image/logo and distinct text layers. Approval stays disabled because facts, rights and publishing account are not verified.
7. Recovery covers source loading, empty work, interrupted upload, expired connection, unavailable billing, stale approval and revoked workspace access.

Sixteen checks passed after the owner-requested UnPile revision: seven screens at 1440px and 390px, plus second-brand review at both widths. Captures are `prototype-<screen>-<width>.png` and `prototype-unpile-review-<width>.png`; measurements are in `prototype-check-2026-09-09.json`. Checked zero page errors/external requests, loaded images and UnPile font, no document overflow, 4:5 creative ratio, disabled approval, and absence of WashBodega media/text or its 24/7 claim in UnPile review. These are fixture checks, not security/RLS proof. Overview and UnPile mobile review screenshots were visually inspected after capture.

The paper/ink surfaces, fixed heading scale, restrained blue accent, visible context, focus outlines, 44px controls and reduced-motion behavior follow Lightfield. Drafts use the platform system sans fallback when Geist is unavailable and a generic monospace fallback when DM Mono is unavailable. The light-blue primary fill with dark text is presented for review; production implementation must resolve exact approved font assets and final control tokens. No WCAG certification or owner approval is inferred from screenshot checks.

## Source material

Copied only these existing public-site assets, byte-for-byte, into `.superdesign/hifi/platform-assets/`:

| Asset                           | Owner repository source                                                                                 | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `washbodega-logo.webp`          | `C:/dev/WashBodega/public/brand/logo-system/wash-bodega-logo-transparent.webp`                          | `d929e5a55c2cb35a18d78151384601d76188164b7cd9bb78a0901f5a53f8ce0d` |
| `washbodega-storefront.webp`    | `C:/dev/WashBodega/public/images/wash-bodega-open-24-7-storefront-w-bellfort-2026.webp`                 | `85e514bf810d177eee8389f59f2cb25000174a1e0176caa5736392fcc3b484ab` |
| `unpile-resolved-room.webp`     | `C:/dev/UnPile Work/unpile-mockup/public/photography/responsive/unpile-hero-resolved-room-v2-1440.webp` | `ee59ca62888ac0b1d5c8770aa37dcd348f438659a9223ce2c772b31ebf4bc00e` |
| `unpile-display-latin-v1.woff2` | `C:/dev/UnPile Work/unpile-mockup/public/fonts/unpile-display-latin-v1.woff2`                           | `5d618c462b7a5b74f442e1548880086af71764d9cc7d35c16ab45353da934621` |

Owner operating guidance supplies the distinction between 24/7 customer access and separately confirmed service/counter hours. No price, new promotion or affiliation was invented. Public availability and ownership context do not replace publication rights approval.

UnPile's wordmark is the existing website text `Unpile`, rendered using its exact local display font, weight 400, tracking -0.055em and ink #20251f from `HomeV4Header.tsx`, `HomeV4.module.css` and `app/globals.css`. The existing website hero is retained unchanged; no claim about its original production method is made. Pickup/delivery is source-backed positioning. Prices, address eligibility, pickup windows and publication rights are not verified by this prototype. No other repository was changed.

The user reviewed the first walkthrough and requested: “use unpile for second brand not lumen skin”. This revision is implemented throughout the new walkthrough and W1 pilot acceptance. After seeing the revised desktop/mobile walkthrough at `http://127.0.0.1:3110/platform-studio-desktop.html?brand=unpile#review`, the user explicitly answered **“Approve revised visual direction”** on 2026-09-09. The accepted UX contract records this approval. It covers these frames and visual direction, including the displayed control treatment, while production font assets, accessibility and behavior still require implementation verification. It does not authorize live publication, charges, paid provider runs or remote mutations. `approved-design-inputs-2026-09-09.json` records the local frame, style, script and media hashes at approval.

Next action: restore and verify the W0 database baseline before activating W1; its UI successor can implement this approved visual direction.
