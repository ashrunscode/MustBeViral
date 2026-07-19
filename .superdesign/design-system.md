# MustBeViral Studio — Precision Creative Studio design system

Authority: derived from `docs/ux/EXPERIENCE_CONTRACT.md` (accepted) and `docs/ux/CANVAS_AND_SCREEN_STATES.md` (accepted). Structural foundation: `neural-noir-interface-style` dark-interface discipline, with **every** visual token below overriding that foundation. Every design branch must preserve these fonts, palette, spacing, and component rules; branches vary composition and emphasis only.

## Identity

A professional creative-operations studio for DTC growth teams: dense but calm, evidence-forward, quiet confidence. The interface answers at all times: Where am I? What is ready? What is blocked? What will this action change or cost? How do I recover?

**Prohibited:** decorative glassmorphism, noisy gradients, ornamental glow, gold/bronze luxury accents, theatrical 3D, fake progress. Motion communicates causality only.

## Color tokens (dark studio)

| Token        | Value     | Use                                |
| ------------ | --------- | ---------------------------------- |
| `bg`         | `#090A0D` | app background                     |
| `surface`    | `#111318` | panels, cards                      |
| `elevated`   | `#171A21` | popovers, raised surfaces          |
| `border`     | `#292E39` | hairline borders, dividers         |
| `text`       | `#F5F7FB` | primary text                       |
| `text-muted` | `#A7AFBF` | secondary text, captions           |
| `violet`     | `#806BFF` | active/selected, primary actions   |
| `blue`       | `#5A96FF` | links, secondary active            |
| `green`      | `#35D08A` | verified success only              |
| `amber`      | `#F2B84B` | attention, reconciliation, partial |
| `red`        | `#F06B7A` | destructive, failed                |

Color is never the only status cue — pair with icon/shape/text. Contrast: WCAG 2.2 AA minimum, 7:1 for text where practical.

## Typography

- **Geist Sans** — all product text. Weights 400/500/600; headings tight (-0.01em), UI labels 12–13px, body 14px, section titles 16–18px.
- **Geist Mono** — identifiers, prices, timings, model labels, hashes, execution evidence. Never for prose.
- No serif, no italic display faces.

## Spacing, sizing, radius

- 4px base grid; common gaps 8/12/16/24/32.
- Controls: compact 32–36px tall; primary ≥40px; touch targets ≥44×44px on touch surfaces.
- Radius: 6px (inputs, chips), 8px (cards, buttons), 12px (panels, dialogs). No pill shapes except status dots/badges.
- Depth: borders and surface hierarchy first; one soft shadow reserved for transient overlays only.

## Motion

- 120ms local feedback · 180ms panel state · 240ms route/major layout. Easing `cubic-bezier(0.2, 0, 0, 1)`.
- Motion never delays input; respect `prefers-reduced-motion`.

## Application shell

Left tool rail (icon column, 48–56px) · central infinite canvas · right inspector (320–360px, collapsible) · top project/run controls bar · collapsible bottom activity/output panel. Tablet: drawers instead of simultaneous side panels. Mobile: review/approve/receipt/export only, with visible "continue on desktop" affordances for authoring actions.

## Component state rules

Every interactive component defines: default, hover (pointer only), focus-visible (2px violet outline offset 2px — including canvas nodes), pressed, disabled, loading, error, success. Optimistic UI only where rollback is deterministic and no money/provider action is implied.

## Canvas language

- Nodes: `surface` cards, 8px radius, 1px `border`; selected = violet border + focus ring; running = animated amber top edge (plus label); verified output = green check chip; failed = red chip + local recovery affordance.
- Edges: 1.5px `border`-colored bezier; active lineage highlighted violet.
- Status chips always icon + text. Costs and model labels in Geist Mono.
- Level-of-detail rendering ≥55 FPS at 100 visible nodes; 500-node stress stays navigable.

## Trust surfaces

- Quote before spend: quote panels show pinned revision, model route, price basis, expiry; the confirm control names the amount.
- Receipts: immutable, mono-typography evidence blocks.
- Partial value visible: completed static branches reviewable while motion/failed branches continue; global progress never hides branch state.
- Destructive confirmations name the affected revision, artifacts, spend, or descendants — never generic warnings.

## Screen inventory for direction exploration

Shared representative content across all branches: one DTC skincare brand ("Lumen Skin"), one campaign brief, a 12-node launch-pack graph (brief → 3 angles → selected direction → statics/copy/motion → QA → export), one quote ($4.20), one partial-failure state, one receipt.

Branch focus definitions:

1. **calm-density** — maximum information density without noise: tighter rail, compact inspector rows, data-table bias.
2. **canvas-legibility** — graph readability first: larger node typography, stronger lineage emphasis, quieter chrome.
3. **review-approval-confidence** — the trust moments amplified: quote/confirm, comparison, approval, and receipt surfaces given prominence.
