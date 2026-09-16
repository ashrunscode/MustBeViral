# Must Be Viral — design brief

status: draft · owner: operator (role-only in public; named public face: Ashley Ansons) · updated: 2026-09-15 · tokens: `packages/ui/src/tokens.ts` (live source) · fonts: `apps/web/app/layout.tsx` · logo: `brand/logo/` · GTM facts: `brand/context.md`

This is the brief every design pass obeys. Where it pins a direction, follow it exactly; where it leaves an axis free, do not spend that freedom on an item from the Never list.

**Two surfaces, one design system.** The **studio** surface sells done-for-you content production and social management to Houston businesses; the **product** surface is the agentic software that runs the work behind it (`brand/context.md` section 1). They share the tokens, the type scale, the radius hierarchy and the Never list. They do not share voice, headline, hero form or CTA — see `brand/context.md` section 1c, the never-mix rule. A surface is one or the other, never both.

**Name form.** Every visible string reads **"Must Be Viral"**, three words. Code identifiers stay `MustBeViral` / `mustbeviral`. The shipped `.studio-wordmark` text still reads the one-word form and is tracked as an open item in `brand/context.md` section 13.

**There is no `brand/tokens.css` and no `brand/fonts.ts` in this repository, by design.** The tokens already exist as `packages/ui/src/tokens.ts` (the `lightfield` object), emitted as CSS custom properties by `packages/ui/src/styles.css` and loaded through `@mustbeviral/ui/styles.css` in `apps/web/app/layout.tsx`. That file is the single source of truth for every value below. Change a value there, never here and never in a component. The deeper written system lives in `.superdesign/design-system.md`, and the accepted UX authority is `docs/ux/EXPERIENCE_CONTRACT.md`.

## Subject and audience — studio surface

- Subject: a Houston content studio. We come to a business, film it, edit it, and hand back posts with a calendar (`brand/context.md` sections 1a and 7).
- Audience: owners and marketing leads of Houston-metro businesses with 3–100 employees — med spas, restaurants and bars, gyms and studios, auto, home services, real estate teams (`brand/context.md` section 2). Mostly on a phone, often between other jobs, in English or Spanish.
- Primary job of the studio surface: get a first-time visitor to **book a test shoot**. One CTA. Nothing else competes.
- Languages: English-first, with a Spanish variant of the same page. The Spanish page is a peer, not a footer link — same layout, same prices, same CTA, natively written copy (`brand/context.md` section 3c).

## Studio surface (marketing page, Spanish variant, social)

The studio page is video-first. It is not the product page and must not borrow the product's canvas, receipts, mono evidence rows or quiet-authority headline.

- **Hero: the work, not a diagram.** The hero is a poster frame from real delivered footage, full-bleed or near it, with the H1 "We film Houston." and the sub-headline over or directly beneath it. Delivered client footage appears only with written permission on file (`brand/context.md` section 4c); until permission exists, the hero uses our own studio-produced footage.
- **One accent.** `--signal` stays the single primary action, and the primary action is "Book a test shoot." Ink for everything else. No second blue button, no coloured section fills.
- **The price is on the page.** $700 Test Shoot and $3,500/month Full Package appear as plain text near the top, not behind a "contact us". Retail figures only, exactly as written in `brand/context.md` section 7. Never a cost, a margin or a discount device — no strike-through prices, no badges, no countdowns.
- **Single CTA.** One "Book a test shoot" as the primary action, repeated at most twice down the page, with the phone number as the only secondary. No newsletter box, no chat bubble, no exit popup.
- **Mobile first.** Design at 375 px and scale up. 16 px minimum body on the studio surface (the product's 15 px floor is for the app, not for a marketing page read on a phone in daylight). 44 px targets. The price and the CTA are both reachable without a horizontal scroll or a pinch.
- **Reduced motion.** Nothing animates on scroll. The hero video, where one plays, is paused entirely under `prefers-reduced-motion: reduce` and the poster frame stands in. Any carousel has visible controls and does not auto-advance.
- **LCP: the poster image is the LCP element, never the video.** Ship a real `next/image` poster with explicit dimensions and `priority`, preload it, and let any video load after. Video is `preload="none"` or `metadata`, `playsInline`, muted, never `autoplay` as the LCP element, and never the only way to understand the offer. Reserve the hero's aspect ratio in CSS so the poster swap costs no layout shift. Captions or a text summary carry the same information for anyone who never plays it.
- **Proof section.** Delivered work in a plain grid — no tilted cards, no lightbox theatrics, no vanity metrics overlaid. Reach, view and follower numbers are banned (`brand/context.md` section 4b).
- **Never on this surface:** the product tagline, agents, runs, quotes, receipts, lineage, canvas imagery, the word "platform", emoji in body copy, or any language from the kill-list in `brand/context.md` section 3f.

## Subject and audience — product surface

- Subject: a visual operating system for DTC creative production. A structured campaign brief becomes an immutable, versioned graph that people and agents plan, quote, execute, inspect, refine and export (`README.md`; `docs/product/PRODUCT_CONTRACT.md`).
- Audience: US, English-language, Shopify-first DTC brands with a 1–5 person growth or creative team — a founder, Head of Growth or Performance Creative lead, on desktop for authoring and on phone or tablet for review (`docs/decisions/ADR-0001-DTC-FIRST.md`; `docs/ux/EXPERIENCE_CONTRACT.md` responsive contract).
- Primary job of the product surface: get an invited operator from a validated brief to a confirmed, named-amount run and then to a reviewable set of composed Meta ads.
- Primary job of the signed-out surface: make the launch pack understandable and let an invited person sign in; enrollment is closed and nothing else is collected (`apps/web/src/components/landing-page.tsx`; `apps/web/app/signup/page.tsx`).
- Signed-in surfaces: calm frame, persistent header and workflow navigation, 44 px touch targets, honest state labels, no fake progress (`apps/web/app/globals.css`; `docs/ux/EXPERIENCE_CONTRACT.md`).

## Palette (already shipped — values read from `packages/ui/src/tokens.ts`)

Paper and ink, not a theme. One ink at many pressures; grey hex values are never introduced.

| Role             | Token                                | Value                                   | Use                                              |
| ---------------- | ------------------------------------ | --------------------------------------- | ------------------------------------------------ |
| Canvas           | `--paper`                            | `#fafafa`                               | primary application ground                       |
| Canvas, recessed | `--paper-2`                          | `#f5f5f5`                               | secondary fields, wells, workflow nav            |
| Card             | `--card`                             | `#ffffff`                               | raised cards and panels only                     |
| Wash             | `--wash` · `--wash-faint`            | `rgba(0,0,0,0.04)` · `rgba(0,0,0,0.02)` | hover fills, alternate rows, canvas field        |
| Ink, strong      | `--ink-strong`                       | `rgba(0,0,0,0.85)`                      | titles, emphasised values                        |
| Ink, heading     | `--ink-head`                         | `rgba(0,0,0,0.75)`                      | page and panel headings                          |
| Ink, body        | `--ink`                              | `rgba(0,0,0,0.60)`                      | body and labels                                  |
| Ink, muted       | `--ink-muted`                        | `rgba(0,0,0,0.50)`                      | large-text captions only (AA fails below)        |
| Ink, faint       | `--ink-faint`                        | `rgba(0,0,0,0.25)`                      | placeholders, disabled                           |
| Line             | `--line`                             | `rgba(0,0,0,0.12)`                      | hairline borders and dividers                    |
| Signal           | `--signal`                           | `#3182d4`                               | THE one primary action of the current moment     |
| Signal, soft     | `--signal-soft` · `--selection-wash` | `#80bfff` · `#80bfff1f`                 | selected border and its wash, active lineage     |
| Success          | `--ok`                               | `#1f9d63`                               | small icon-and-text chips only                   |
| Attention        | `--attention`                        | `#b87e14`                               | small icon-and-text chips, running edge filament |
| Failure          | `--fail`                             | `#c4404d`                               | small chips and 2 px left edges only             |

- The one bold element allowed per screen: the `--signal` primary action, usually the confirm control that names the amount. Everything else is ink. Selected state uses a `--signal-soft` border over `--selection-wash`, not a second blue button.
- Status colour is never the only cue and never fills a large surface; it marks chips, dots and edges (`docs/ux/EXPERIENCE_CONTRACT.md`).
- White text appears only on a `--signal` or status fill.
- **Recorded divergence — do not reconcile unilaterally.** The identity documents were written from the live study before the tokens were finalised and carry different values: `.superdesign/brand-detail.md` gives paper `#F4F4F2`, `.superdesign/brand-id.md` gives the accent as `#2E6BE6`, and `docs/ux/EXPERIENCE_CONTRACT.md` gives success `#49bf4c` and error `#f55434`. `packages/ui/src/tokens.ts` and `.superdesign/design-system.md` agree on the table above and are what actually ships, so build against the table. The divergence is logged in `brand/context.md` section 13 for the owner.

## Type (already shipped)

- Text and display: **Geist** via `next/font/google`, exposed as `--font-sans` (`apps/web/app/layout.tsx`). One family for the whole product scale.
- Evidence: **Geist Mono**, exposed as `--font-mono` (`apps/web/app/layout.tsx`). Every identifier, price, timestamp, revision, model route, seed, hash and receipt line is mono. Mono caps labels are 10px/1em, weight 500, +1px tracking, uppercase (`packages/ui/src/styles.css`, `.mbv-monocaps`).
- Licensed target faces, not yet in the repository: Untitled Sans for text and DM Mono for evidence, with Geist as the interim implementation face (`.superdesign/brand-detail.md`; `docs/ux/EXPERIENCE_CONTRACT.md`). Do not switch faces without the licence and an owner decision.
- Weight: 400 everywhere. 500 only for the wordmark, mono caps and emphasised table values. **Headings are never bold** (`.superdesign/design-system.md`).
- Scale, fixed px, no fluid clamp (`docs/ux/EXPERIENCE_CONTRACT.md`): h1 `28px/1.2` at `-0.03em` · h2 `24px/1.25` at `-0.02em` · h3 `21px/1.25` at `-0.015em` · h4 `19px/1.3` at `-0.01em` · large `17px/1.5` · body `15px/1.5` · small `13px/1.5` · xs `12px/1.45` · xxs `11px/1.45`. Product UI never exceeds 28px, at any breakpoint. The shipped surfaces so far use only 28 / 17 / 15 / 13 / 12 px (`apps/web/app/globals.css`); the unused steps are the rest of the same scale, not licence for a different one.
- Hierarchy comes from space and ink pressure, not from size shouting.
- Line length: 70ch or less for body. The signed-out shell is `min(760px, 100%)` and auth cards `min(440px, 100%)` (`apps/web/app/globals.css`).

## Layout

- Alignment: left-aligned text. Centring is reserved for a single-line status screen or an empty state.
- Grid: 4 px base; gaps 8 / 12 / 16 / 24 / 32 px. Compact controls 32–36 px, primary controls at least 40 px, touch targets at least 44 × 44 px (`docs/ux/EXPERIENCE_CONTRACT.md`).
- Radius, one hierarchy, no per-component values: `--radius-control` 4 px · `--radius-input` 6 px · `--radius-card` 8 px · `--radius-floating` 10 px. Pill geometry is for status dots only.
- Surfaces: hairline `--line` borders everywhere; use borders and surface hierarchy before shadows, and reserve one soft, tight shadow for floating or transient layers (drawer, dialog).
- Breakpoints: desktop 1280 px and wider gets full graph authoring; 768–1279 px gets review and navigation through drawers rather than simultaneous side panels; below 768 px gets review, comment, approve or reject, receipt and export, and never presents full graph authoring as usable. Unsupported actions stay visible with a short explanation and a desktop continuation link (`docs/ux/EXPERIENCE_CONTRACT.md`).
- Structure encodes information: a border, a number, a divider or an eyebrow appears only when it means something.

## Motion

- Durations and easing come from the tokens: `--motion-local` 120 ms · `--motion-panel` 180 ms · `--motion-route` 240 ms · `--motion-ease` `cubic-bezier(0.2, 0, 0, 1)`. No millisecond literals in components.
- Motion communicates causality only. The signature moments, and the only non-user-triggered motion allowed (`docs/ux/EXPERIENCE_CONTRACT.md`, work-motion language):
  1. A running node carries a 2 px `--attention` filament along its top edge on a 1.6 s ease-in-out loop, always paired with a text state.
  2. Output moving between nodes animates as brand-coloured dashes travelling the connecting edge, which then settles to its static lineage state.
  3. On arrival the receiving node's border warms for 180 ms and settles — no bounce, no scale.
- Reduced motion replaces the filament and the edge travel with a static directional gradient plus the text state; `packages/ui/src/styles.css` already collapses animation and transition durations to 0.01 ms under `prefers-reduced-motion: reduce`.
- No `transition: all`, no scroll-triggered entrance on every section, no hover motion on every card, and never a loader that implies progress the system does not know.

## Imagery and logo

- The only imagery is the real product UI, presented as evidence: the real canvas, real receipts, real QA panels (`.superdesign/brand-detail.md`). No stock photography, no illustration library, no abstract 3D.
- Signature flourish, marketing and large empty states only, used sparingly: product cards tilted 6–8° as floating paper (`.superdesign/design-system.md`).
- Reference captures in `.superdesign/reference/` are study material for the visual north star. They are never shipped as assets and never reproduced as design.
- Generated images require user-editable descriptive text before approval or export (`docs/ux/EXPERIENCE_CONTRACT.md`).
- Logo: **`brand/logo/` is the source of the mark, and the files are delivered in this change** — `mark.svg`, `mark-mono.svg`, `mark-reverse.svg`, `wordmark.svg`, `lockup-horizontal.svg`, `lockup-stacked.svg`, `favicon.svg`, the specimen sheet `preview.html`, and `brand/logo/README.md` for clear space, minimum sizes, the three approved colour pairs and the forbidden uses. They are `status: draft` and await owner approval (`brand/context.md` section 13). Separately, the shipped UI wordmark is still the text form at 15 px, weight 500, `-0.01em`, in `--ink-strong` (`apps/web/app/globals.css`, `.studio-wordmark`), which renders the stale one-word name and is tracked in `brand/context.md` section 13. Clear space is 1× the mark height; minimum sizes are per asset in `brand/logo/README.md`. Use `mark-mono.svg` in product UI, never the accent version. Never recolour, stretch, redraw, outline or add effects to the mark, and never substitute a second mark for the studio surface — one brand, one mark, used on both.
- Studio imagery: real Houston businesses, real people with releases on file, daylight where possible, no identifiable minors, no stock clichés. Client footage and stills are portfolio only under the permission rule in `brand/context.md` section 4c.

## Copy voice (full voice rules in `brand/context.md` section 3)

**Pick the register from the surface and never mix the two on one page** (`brand/context.md` section 1c).

- **Studio:** warm, local, concrete, priced, first person plural. Locked H1 "We film Houston." / sub "Weekly content for Houston businesses — Reels, photos, and a posting schedule you actually keep."; Spanish "Filmamos Houston." / "Contenido semanal para negocios de Houston: Reels, fotos y un calendario de publicación que sí se cumple." Primary CTA "Book a test shoot." / "Agende un test shoot." No emoji in body copy.
- **Product:** the quiet-authority register from `.superdesign/brand-id.md`. Locked tagline "You brief. Agents produce. You approve every dollar." — product surface only.
- Sentence case everywhere, including buttons and navigation.
- CTAs name the outcome and, where money moves, the amount: "Confirm $4.20 run", "Sign in to Studio", "Book a test shoot". Never "Submit", never "Learn more".
- The same verb carries through a flow: "Approve" leads to "Approved".
- Errors say what happened, what was retained, what it costs and what to do next. Empty states are calm fields inviting one action, never skeleton noise.
- Numbers are exact and mono. No exclamation marks, no filler, no accented single word in a headline.

## Images (technical)

- `next/image` with explicit `width` and `height`, or `fill` plus `sizes`; exactly one `priority` image per route, the LCP element. On the studio surface that one image is the hero **poster frame** — a video is never the LCP element (see Studio surface above).
- Formats avif or webp, quality 75 by default.
- List and canvas views load thumbnails or metadata, never full-resolution media (`docs/ux/EXPERIENCE_CONTRACT.md`).
- Customer media is private by default and is served through short-lived signed operations; a bucket is never exposed publicly (`docs/architecture/SYSTEM_OVERVIEW.md`).

## Never

Merged from the `brand-context` never-list and this repository's own elevation bar (`.superdesign/design-system.md`). Legitimate only when this brief asks for one explicitly.

Palette and surface

- Gradients, glass, glow or dark drama as a way to look premium; decoration in place of information
- Warm cream page with a terracotta or warm-clay accent; near-black page with one acid-green or vermilion accent
- Tinted near-black standing in for black; grey hex values mixed into the ink ladder
- Blue as a section fill, a background wash or a second competing action
- Status colour filling a large surface, or status conveyed by colour alone
- The big-number plus small-label plus gradient-accent hero as the default opener

Structure

- Content chopped into identical rounded cards with one radius and the same soft grey shadow under each
- Hairline rules with zero radius in dense newspaper columns
- `01 / 02 / 03` markers on content that is not a sequence
- Outlines, borders, eyebrows, dividers and labels used as decoration rather than information
- Density for its own sake

Typography

- Bold headings, or any heading above 28 px inside the product
- Tracked-out ALL-CAPS eyebrow above every heading; all caps for labels in general beyond the defined mono caps role
- Accenting a single word in a headline with italic, bold or a different colour
- Meta strings joined with middle dots, and labels built as `WORD - fragment` with a spaced dash
- A monospace face for anything that is not evidence

Motion

- Fade-and-slide-up entrance on every section; a hover transition on every card
- Non-user-triggered motion outside the three work-motion moments above
- Theatrical loaders, spinner blobs, pulsing fills, and any percentage the system does not actually know

Copy and links

- An arrow glyph appended to link or button text
- Exclamation marks, "magic", "supercharge", "unleash", discount language, fake urgency
- Templated placeholder copy ("Lorem", "your one-stop solution", "elevate your …")

Imagery

- Stock-cliché photography (handshake, laptop-on-desk, smiling headset, abstract network lines), 3D blobs, identifiable minors
- Recolouring, stretching or redrawing any mark

Studio surface specifically

- An autoplaying video as the LCP element, a hero with no poster frame, or a hero whose meaning is lost with the sound off
- Discount devices of any kind: strike-through prices, "was/now", badges, countdowns, launch offers
- Reach, view, follower, engagement or ROI numbers anywhere on the page
- Client work shown without written permission on file; a testimonial without attribution and date
- Emoji in body copy; a second CTA competing with "Book a test shoot"; a newsletter box, chat bubble or exit popup
- Spanish produced by machine translation, or a Spanish page that is a cut-down of the English one

## QC before shipping (every item must pass)

- Instantly reads as Must Be Viral — paper and ink, one signal moment, mono evidence on the product surface; the work itself carrying the studio surface — not as a template
- The surface is one register, not two: no product tagline on a studio page, no studio headline or pricing on a product page (`brand/context.md` section 1c)
- Every visible string reads "Must Be Viral", three words; code identifiers untouched
- Values come from `packages/ui/src/tokens.ts` through the CSS custom properties; no hex, `rgb()`, font name or millisecond literal in a component
- 375 / 768 / 1440 checked; no horizontal scroll; 44 px targets; 15 px body minimum in the app, 16 px on the studio surface
- Studio surface only: the LCP element is the poster image with `priority`, not a video; video is muted, `playsInline`, not autoplaying as LCP, and paused under reduced motion; the hero ratio is reserved so nothing shifts; the price and the single CTA are visible without scrolling sideways or pinching
- Studio surface only: prices match `brand/context.md` section 7 exactly, no tier below Full Package is shown, and no discount device appears; no reach, view or result numbers anywhere
- The Spanish variant is natively written, uses _usted_, and has been reviewed by the named fluent reviewer before publish
- Keyboard focus visible as a 2 px `--signal` outline at 2 px offset, including canvas nodes; every essential canvas action reachable without a pointer gesture
- Reduced motion, forced colors, 200% zoom and text resizing honoured; WCAG 2.2 AA met, 7:1 body contrast targeted
- One `priority` LCP image per route; zero console errors
- Copy passed the voice rules and the claims rules in `brand/context.md`
