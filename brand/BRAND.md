# MustBeViral Studio — design brief

status: draft · owner: operator · updated: 2026-09-15 · tokens: `packages/ui/src/tokens.ts` (live source) · fonts: `apps/web/app/layout.tsx` · GTM facts: `brand/context.md`

This is the brief every design pass obeys. Where it pins a direction, follow it exactly; where it leaves an axis free, do not spend that freedom on an item from the Never list.

**There is no `brand/tokens.css` and no `brand/fonts.ts` in this repository, by design.** The tokens already exist as `packages/ui/src/tokens.ts` (the `lightfield` object), emitted as CSS custom properties by `packages/ui/src/styles.css` and loaded through `@mustbeviral/ui/styles.css` in `apps/web/app/layout.tsx`. That file is the single source of truth for every value below. Change a value there, never here and never in a component. The deeper written system lives in `.superdesign/design-system.md`, and the accepted UX authority is `docs/ux/EXPERIENCE_CONTRACT.md`.

## Subject and audience

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
| Ink, muted       | `--ink-muted`                        | `rgba(0,0,0,0.50)`                      | captions, secondary meta                         |
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
- Logo: there is no logo file in this repository. The wordmark is the text "MustBeViral Studio" at 15 px, weight 500, `-0.01em`, in `--ink-strong` (`apps/web/app/globals.css`, `.studio-wordmark`). A real mark is an open item in `brand/context.md` section 13; do not draw one.

## Copy voice (full voice rules in `brand/context.md` section 3)

- Sentence case everywhere, including buttons and navigation.
- CTAs name the outcome and, where money moves, the amount: "Confirm $4.20 run", "Sign in to Studio". Never "Submit", never "Learn more".
- The same verb carries through a flow: "Approve" leads to "Approved".
- Errors say what happened, what was retained, what it costs and what to do next. Empty states are calm fields inviting one action, never skeleton noise.
- Numbers are exact and mono. No exclamation marks, no filler, no accented single word in a headline.

## Images (technical)

- `next/image` with explicit `width` and `height`, or `fill` plus `sizes`; exactly one `priority` image per route, the LCP element.
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

## QC before shipping (every item must pass)

- Instantly reads as MustBeViral Studio — paper and ink, one signal moment, mono evidence — not as a template
- Values come from `packages/ui/src/tokens.ts` through the CSS custom properties; no hex, `rgb()`, font name or millisecond literal in a component
- 375 / 768 / 1440 checked; no horizontal scroll; 44 px targets; 15 px body minimum
- Keyboard focus visible as a 2 px `--signal` outline at 2 px offset, including canvas nodes; every essential canvas action reachable without a pointer gesture
- Reduced motion, forced colors, 200% zoom and text resizing honoured; WCAG 2.2 AA met, 7:1 body contrast targeted
- One `priority` LCP image per route; zero console errors
- Copy passed the voice rules and the claims rules in `brand/context.md`
