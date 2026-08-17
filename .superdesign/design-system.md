# MustBeViral Studio — Design System (Lightfield-derived, v2)

Authority chain: operator brand directive (lightfield.app north star) → `brand-id.md` + `brand-detail.md`
→ this executable system. Composition authority: the unanimous 9/9/9 research verdict for the
**Review-Approval-Confidence** direction with grafts (ledger receipts, large-node canvas grammar,
docked quote strip). Live product frames and SuperDesign preview goldens must preserve these tokens exactly. The SuperDesign CLI is optional.

## Surfaces (paper, not theme — EXACT Lightfield tokens, see reference/lightfield-teardown.md)

| Token        | Value               | Use                                       |
| ------------ | ------------------- | ----------------------------------------- |
| `paper`      | `#fafafa` (z0)      | primary application background            |
| `paper-2`    | `#f5f5f5` (z1)      | secondary background, wells               |
| `card`       | `#FFFFFF`           | raised cards, panels (bg-tertiary)        |
| `wash`       | `rgba(0,0,0,0.04)`  | t1 — hover fills, quiet wells             |
| `wash-faint` | `rgba(0,0,0,0.02)`  | t0 — alternate rows, canvas field         |
| `hero-wash`  | `#E9EBEF → #fafafa` | subtle cool wash, large empty states only |

## Ink (one ink, many pressures — never gray hexes)

| Token        | Value              | Use                        |
| ------------ | ------------------ | -------------------------- |
| `ink-strong` | `rgba(0,0,0,0.85)` | titles, emphasized values  |
| `ink-head`   | `rgba(0,0,0,0.75)` | page/panel headings        |
| `ink`        | `rgba(0,0,0,0.60)` | body, labels               |
| `ink-muted`  | `rgba(0,0,0,0.50)` | captions, secondary meta   |
| `ink-faint`  | `rgba(0,0,0,0.25)` | placeholders, disabled     |
| `line`       | `rgba(0,0,0,0.12)` | hairline borders, dividers |

## Accent and status

- `signal` `#3182d4` (Lightfield blue-z8 brand-strong) — THE action accent: exactly one signal
  element per screen (Confirm run, Approve, Export). `signal-soft` `#80bfff` (blue-z5
  content-brand) for selected borders, active lineage, links. Selected states: `#80bfff1f` wash
  (blue-t2) + 1px `signal-soft` border.
- Status (small, always icon+text, mono labels): `ok` `#1F9D63` · `attention` `#B87E14` · `fail` `#C4404D`.
  Status colors never fill large areas; they mark chips, dots, and left-edges only.
- White text only ever sits on `signal` or status fills.

## Type (EXACT Lightfield scale — headings NEVER bold)

- **Untitled Sans** (license; interim: Geist Sans) — UI/product text, weight 400 everywhere
  (500 only for the wordmark and monocaps).
- **DM Mono** — all evidence: prices, timestamps, revisions, model routes, seeds, hashes, receipts,
  counts. Monocaps labels: 10px/1em, letter-spacing 1px, weight 500, uppercase (eyebrows, chips,
  table headers).
- Scale (fixed px, no fluid clamp): xxs 11 · xs 12/1.45 · sm 13/1.5 · base 15/1.5 · lg 17/1.5 ·
  h4 19/1.3/−.01em · h3 21/1.25/−.015em · h2 24/1.25/−.02em · h1 28/1.2/−.03em · d4 32/1.15/−.035em.
  All weight 400. Product UI never exceeds 28px; h1 stays 28px at every breakpoint.

## Geometry

- Radius: 4 controls · 6 inputs · 8 cards · 10 floating; pill for status dots only.
- Grid 4px; gaps 8/12/16/24/32; controls 36px, primary 40px, touch 44px.
- Hairlines everywhere; shadow (soft, tight, single) only on floating/transient layers.
- Signature (marketing/empty states only): 6–8° tilted paper-card compositions of the real UI.

## Motion

120ms local · 180ms panel · 240ms route; ease `cubic-bezier(0.2,0,0,1)`; respects reduced-motion;
motion communicates causality only — nothing decorative.

### Work-motion language (operator directive — causality made visible)

- **In-node working animation:** while a node executes, a 2px `attention` progress filament slides
  along the node card's top edge (indeterminate sweep, 1.6s ease-in-out loop), paired with the mono
  state label ("generating 2/3"). Calm, thin, paper-appropriate — never a spinner blob, never pulsing
  fills.
- **Edge flow animation:** when output moves from node N to node N+1, the connecting bezier carries a
  flowing motion: small `signal`-tinted dashes (or 3px dots) traveling along the path at ~80px/s,
  fading in at the source port and out at the target port, for the duration of the transfer; the edge
  then settles to its static state (active lineage `signal`, idle `line`). This is THE signature
  micro-interaction: work is visibly flowing through the graph.
- **Arrival:** the receiving node's border briefly (180ms) warms to `signal` at 0.4 then settles —
  confirmation of receipt, no bounce, no scale.
- Reduced-motion: filament and flow become a static directional gradient on the edge plus text state;
  no travel animation.

## Composition (research-locked)

- **Confirm bar** (hero of the run moment): full-width, `card` on `line` hairline, containing —
  pinned revision (mono), model route (mono), price basis, expiry countdown (mono), and the single
  `signal` button naming the amount: "Confirm $4.20 run". Never styled with urgency.
- **Docked quote strip** (graft A): slim persistent strip showing live `QUOTE $4.20 · REV 7f3a`
  whenever the confirm bar is off-screen.
- **Canvas** (graft B): `wash-faint` field; nodes = `card` hairline cards, 8px radius, 15px titles,
  12px mono meta; selected = `signal` border + focus ring; running = animated `attention` top edge +
  label; verified = `ok` chip; failed = `fail` chip + local "Retry (no charge) — retains N verified"
  affordance. Edges 1.5px `line` bezier with directional arrowheads; active lineage in `signal`.
- **QA panel:** `attention`-edged card listing findings with per-note mono JUMP_TO_ASSET links.
- **Receipt drawer** (graft A): immutable ledger table — TIMESTAMP / NODE / EVENT / COST — DM Mono,
  right-aligned amounts, per-event costs, full-statement link. Reads notarized.
- **Version comparison:** side-by-side `card` thumbnails, CURRENT vs PRIOR, mono captions.
- **Approvals:** per-artifact approve/reject with recorded identity ("APPROVED · BY SC" mono chips);
  batch approval affordance with progress "4 / 12".
- **Focus-visible:** 2px `signal` outline offset 2px — including canvas nodes. WCAG 2.2 AA minimum,
  7:1 target for body ink on paper.

## Shared representative content (unchanged)

Lumen Skin campaign · 12-node launch-pack graph · quote $4.20 pinned rev 7f3a · one partial static
failure with free retry · QA report with 2 notes · immutable receipt. Model labels always
`kimi-2.6 + flux-2-klein`. No `$1,240` figures anywhere — every money figure obeys the $8/run cap story.

## Elevation bar ("wow" defined)

Premium is achieved by: perfect paper/ink discipline, one signal moment per screen, notarized mono
evidence, vast calm in empty states, tilted-paper product storytelling, and flawless 1440px overflow
behavior. Never by: gradients, glass, glow, dark drama, density for its own sake, or decoration.
