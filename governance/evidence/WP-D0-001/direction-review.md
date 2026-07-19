# d0-004 direction review evidence

Date: 2026-07-19. Reviewer: Claude (team lead), from the actual rendered captures under `captures/`.
Shared representative content: `lumen-skin-launch-pack-v1` (Lumen Skin brief, launch-pack graph,
$4.20 quote pinned to rev 7f3a, partial static failure with no-charge retry, QA notes, receipt data).

## System conformance (all four renders)

Dark tokens held (`#090A0D` field, `#111318` surfaces, hairline borders); violet reserved for
active/selected and primary actions; green appears only on verified records; amber on attention;
red on the failure and its recovery; Geist-style mono used for every identifier, price, seed,
timestamp, and model label. No glassmorphism, no gradients, no ornamental glow, no gold in any
render. All renders are working-tool compositions, not landing pages.

## Per-branch findings

### Calm-Density Console (`calm-density`)

- Docked quote strip (`QUOTE $4.20 REV 7f3a CONFIRM`) achieves quote-always-visible with zero chrome cost.
- Activity stream as a true ledger table (timestamp / node / event / cost) including the red
  `ASPECT_RATIO_MISMATCH` line and per-event costs — the strongest execution-evidence surface.
- Inspector as mono key-value rows (provider, temp, seed, tokens) reads as an operations console.
- Watch item: compact node cards drop inline metadata at 62% zoom; edge rendering nearly invisible
  at that zoom — needs lineage emphasis rules at low zoom in high fidelity.

### Canvas Legibility (`canvas-legibility`)

- Largest node typography with clean directional lineage arrows; calmest chrome; graph-first
  hierarchy achieved.
- Live telemetry rail with the token-limit alert keeps recovery visible without panel weight.
- Watch item: sparsest content of the three (three primary nodes rendered); density of real
  12-node graphs must be proven in high fidelity before this direction can carry P0 screens.

### Review Approval Confidence (`review-approval-confidence`)

- Best trust fidelity: full-width confirmation bar with pinned revision `REV_0524_C`, model route
  `kimi-2.6 + flux-2-klein` (matches the catalog contract), quote expiry `14:32`, and a confirm
  control that names the amount (`Confirm $4.20 run`).
- QA notes rendered as an amber panel with per-note `JUMP_TO_ASSET` links; failed branch shows
  `Retry (no charge) — retains 2 verified statics` — the recovery-is-local principle verbatim.
- Version comparison (current vs prior) and batch approvals with a green APPROVED record.
- Watch items: right panel clips slightly at 1440px (overflow discipline needed); the red retry
  button is louder than the destructive-precision rule intends.

## Dimension verdicts

- accessibility: noted — color always paired with icon/text; contrast visually consistent with
  tokens; focus-visible rings and reduced-motion cannot be proven from static captures and are
  mandatory checks at high fidelity.
- density: pass — Calm-Density proves the ceiling; no branch crowds below the 4px grid.
- legibility: pass — Canvas Legibility proves the floor; mono evidence readable in all renders.
- responsive: noted — desktop-only at this gate by design; tablet/mobile flows extend from the
  chosen branch per the experience contract.

## Content-fidelity notes carried to high fidelity

The initial draft and two branches display placeholder model names (`GPT-4o`, `Claude 3.5 Sonnet`,
`OpenAI.GPT4o`) instead of the enabled-catalog route; one shows a `$1,240.00` estimate outside the
quote contract. These are render-content drifts, not direction properties; the high-fidelity packet
must pin all model labels and money figures to contract values (as the Review Approval Confidence
branch already does).
