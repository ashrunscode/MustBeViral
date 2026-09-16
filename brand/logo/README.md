# Must Be Viral — logo system

status: draft · owner_approval: required · created: 2026-09-15 · design brief: `brand/BRAND.md` · GTM facts: `brand/context.md` · tokens: `packages/ui/src/tokens.ts`

The brand had no mark before this change (`brand/context.md` section 5; `brand/BRAND.md` "Imagery and logo"). These files are that mark. Open `preview.html` in a browser to judge every file at real size on light and on dark.

The public name is **Must Be Viral**, three words, in the wordmark and in every public string. The repository, package names and code identifiers stay `MustBeViral` / `mustbeviral` and are not renamed.

## Files

| File                    | What it is                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `mark.svg`              | The mark. Frame in `currentColor`, play shape in the accent `#3182D4`.                                            |
| `mark-mono.svg`         | The mark in one colour, all `currentColor`. The default for product UI, print, stamping and anything one-colour.  |
| `mark-reverse.svg`      | Knockout. Carries its own solid ink plate with the mark punched out in paper, so it is correct on any background. |
| `wordmark.svg`          | "Must Be Viral" as drawn lettering. All `currentColor`.                                                           |
| `lockup-horizontal.svg` | Mark left, wordmark right. Clear space baked into the viewBox.                                                    |
| `lockup-stacked.svg`    | Mark above, wordmark below. Clear space baked into the viewBox.                                                   |
| `favicon.svg`           | The mark redrawn for small sizes: thicker frame, larger play shape, wider gaps.                                   |
| `preview.html`          | Self-contained specimen sheet. Inlines every file above; loads no font, no stylesheet, no image.                  |

Every SVG carries a `viewBox`, a short `<title>`, no `width` or `height` attribute, and no font reference. Colour is `currentColor` wherever the artwork is one colour, so the mark inherits ink from its context.

## The mark

A **play triangle inside a frame that is also a speech bubble**: three straight-edged shapes, no curves, no gradients, no shadows.

- The frame is a rectangle taller than it is wide — a shot, held.
- One corner of it drops into a tail, which turns the frame into a spoken message.
- Inside sits a play triangle.

It carries both halves of what the studio does: it films, and what it films is somebody saying something. It survives 24 px because it is three shapes with hard edges, and it is reproducible in one colour by anyone, anywhere — a sign painter could cut it.

Geometry sits on a 24-unit grid with every edge on an integer, so at 24 px and 48 px every edge lands on a whole pixel. The frame is 16 × 18 units with a 2-unit border; the play shape is 7 × 8.

## The wordmark

**Drawn, not set.** The wordmark is constructed geometric monoline lettering — straight lines, circular and elliptical arcs, one dot — on a fixed grid: cap height 20, x-height 14, monoline weight 2.6, bowl radius 6, round overshoot 0.3. Caps are `M`, `B`, `V`; the `a` is single-storey.

There is no `<text>` element and no font reference, which is deliberate:

- The repository has no font files. Geist arrives at build time through `next/font/google` (`apps/web/app/layout.tsx`), so a `<text>` wordmark could not be outlined here and would silently fall back to a different face wherever Geist was absent.
- A logotype should be a fixed shape, identical in every renderer, at every size, offline.

**This does not change the type system.** Running text, UI copy and the text wordmark in the product stay Geist and Geist Mono per `brand/BRAND.md`. The drawn lettering is used only as a logo.

## Clear space

**Clear space = the height of the mark's frame** (the mark's cap height, tail excluded). On all four sides, around the whole lockup.

Both lockup files already contain it — 23.4 units of padding inside a viewBox whose artwork is 179.6 × 28.6 (horizontal) or 147.1 × 60.6 (stacked). The padding is part of the asset. Do not crop it, do not add a tighter bounding box, and do not place anything inside it. `preview.html` draws the artwork bounds so you can see what belongs to the artwork and what belongs to the clear space.

When placing `mark.svg`, `mark-mono.svg` or `wordmark.svg` on their own, add the same clear space yourself: one frame-height on all four sides.

## Minimum sizes

Measured as the rendered size of the file, clear space included. Every figure here is a design decision, not an owner fact.

| Asset                       | Minimum     |
| --------------------------- | ----------- |
| `mark.svg`, `mark-mono.svg` | 24 px       |
| `favicon.svg`               | 16 px       |
| `wordmark.svg`              | 96 px wide  |
| `lockup-horizontal.svg`     | 175 px wide |
| `lockup-stacked.svg`        | 150 px wide |

**A lockup is only as small as the smallest thing inside it**, so the two lockup minimums are derived, not chosen: each is the rendered file width at which both embedded elements still clear their own standalone minimum. Inside both lockups the mark is drawn at `scale(1.3)` on its own 24-unit grid, so it occupies 31.2 units, and the wordmark is drawn at its own 147.1-unit width.

- `lockup-horizontal.svg`, viewBox 226.4 wide — mark: 24 × 226.4 ÷ 31.2 = 174.2 px; wordmark: 96 × 226.4 ÷ 147.1 = 147.8 px. The mark binds, so the minimum is **175 px**.
- `lockup-stacked.svg`, viewBox 193.9 wide — mark: 24 × 193.9 ÷ 31.2 = 149.2 px; wordmark: 96 × 193.9 ÷ 147.1 = 126.5 px. The mark binds again, so the minimum is **150 px**.

Below those widths do not shrink a lockup: use `mark-mono.svg` on its own, or `favicon.svg` below 24 px. Below 24 px use `favicon.svg`, never a scaled-down `mark.svg`.

## Approved colour pairs

Three. Nothing else.

| Pair                          | Values                                   | Tokens                                   |
| ----------------------------- | ---------------------------------------- | ---------------------------------------- |
| Ink on paper                  | `#262626` on `#FAFAFA` (or on `#FFFFFF`) | `--ink-strong` over `--paper` / `--card` |
| Paper on ink                  | `#FAFAFA` on `#262626`                   | `--paper` over `--ink-strong`            |
| Accent on the play shape only | frame `#262626`, play shape `#3182D4`    | `--signal`                               |

Exact token names, from `packages/ui/src/tokens.ts` and the `lightfieldCssVariables` export:

`--paper` `#fafafa` · `--paper-2` `#f5f5f5` · `--card` `#ffffff` · `--ink-strong` `rgba(0,0,0,0.85)` · `--line` `rgba(0,0,0,0.12)` · `--signal` `#3182d4`

`#262626` is not a new token. It is `--ink-strong` composited over `--paper`: `250 × 0.15 = 37.5 ≈ 0x26`. An SVG cannot carry an alpha ink over an unknown background without the background bleeding through, so the logo files use the composite. In a page that already has `--paper` behind it, set `color: var(--ink-strong)` and let `currentColor` do the work.

**Use `mark-mono.svg`, not `mark.svg`, anywhere in the product UI.** `--signal` is reserved for the one primary action on the current screen (`.superdesign/brand-id.md`; `brand/BRAND.md`); a blue logo would compete with the confirm control. The accent pair belongs to studio marketing surfaces that carry no signal-blue action.

## Forbidden

- Recolouring outside the three pairs above. No second blue, no brand green, no white mark on a mid-grey.
- Stretching, squashing, or scaling the mark and wordmark by different amounts. Scale uniformly or not at all.
- Rotating, skewing, mirroring, or tilting. The 6–8° tilted-paper flourish in `brand/BRAND.md` applies to product screenshots, never to the mark.
- Effects: gradients, drop shadows, glows, strokes, outlines, bevels, blurs, animation of the mark itself.
- Redrawing, re-tracing, re-spacing, or rebuilding the lockups by hand. Use `lockup-horizontal.svg` or `lockup-stacked.svg`.
- Substituting type for the wordmark, or the wordmark for type. Do not set "Must Be Viral" in Geist and call it the wordmark.
- Placing any variant on a busy photograph. On photography use `mark-reverse.svg`, or put a solid `--paper` or `--ink-strong` plate behind the lockup first. No semi-transparent scrim.
- Enclosing the mark in a circle, a rounded square, or any container it did not come with.
- "MustBeViral" or "Must be viral" in the wordmark or in public copy. Three words, `Must Be Viral`, with those capitals.

## Open items for the owner

Recorded, not resolved. Add to `brand/context.md` section 13.

1. **Trademark clearance.** `[OWNER-INPUT-NEEDED]` — Have the name "Must Be Viral" and this mark been cleared for use as a trademark, and is a filing planned? Nothing here is a legal opinion.
2. **Shipped UI wordmark contradicts the name decision.** `apps/web/app/globals.css` (`.studio-wordmark`) and `apps/web/src/components/landing-page.tsx` render the string "MustBeViral Studio". The owner decision of 2026-09-15 sets "Must Be Viral" for every public string. This is a defect in the shipped copy; the fix is a copy change in those files, out of scope for this change and not made here.
3. **Palette divergence stays open.** The logo uses the shipped token values — `--signal` `#3182d4` and `--paper` `#fafafa` from `packages/ui/src/tokens.ts`. It does not use `#2E6BE6` (`.superdesign/brand-id.md`) or `#F4F4F2` (`.superdesign/brand-detail.md`). The divergence between the identity documents and the shipped tokens is recorded and deliberately not reconciled (`brand/BRAND.md`, "Recorded divergence").
4. **No dark theme exists in the token set.** `packages/ui/src/tokens.ts` has one set, light. The paper-on-ink pair above is defined by this logo system. `[OWNER-INPUT-NEEDED]` — if a dark theme is ever added, confirm the reverse pair against it.
5. **Raster exports do not exist.** SVG only: no `.ico`, no PNG favicon set, no social or OG image, no app-icon set. `[OWNER-INPUT-NEEDED]` — which raster sizes and formats are needed, and for which surfaces? There is also no `apps/web/public/` directory yet, so nothing is wired into a route.
6. **Print and merchandise use is unspecified.** `[OWNER-INPUT-NEEDED]` — one-colour spot ink, embroidery, and vehicle or signage use each need a minimum size and a substrate decision before the mark is sent to a supplier. `mark-mono.svg` is the file to start from.
