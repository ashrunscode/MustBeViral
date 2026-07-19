---
doc_id: experience-contract
---

# Experience contract

## Experience outcome

MustBeViral Studio should make a small growth team feel in control of a complex creative system. The interface exposes what will happen, what it will cost, what changed, what failed, and which output came from which input without forcing the user to understand provider infrastructure.

The user must always be able to answer five questions: Where am I? What is ready? What is blocked? What will this action change or cost? How do I recover?

## Lightfield paper-and-ink identity

- Surfaces use paper `#fafafa` (`z0`) for the primary field, paper `#f5f5f5` (`z1`) for secondary fields and wells, and white `#ffffff` for cards and raised panels.
- The black ink-alpha ladder is the neutral system: `t0 .02`, `t1 .04`, `t2 .06`, `t3 .08`, `t4 .12`, `t5 .16`, `t6 .25`, `t7 .35`, `t8 .50`, `t9 .60`, `t10 .75`, and `t11 .85`. Semantic mapping is primary `.85`, headings `.75`, body `.60`, captions `.50`, disabled `.25`, moderate borders `.12`, and subtle borders `.06`.
- The single blue accent family is content-brand `#80bfff` and brand-strong `#3182d4`. Brand-strong marks the one primary action per screen. Selection uses a content-brand border with a 12% content-brand wash (`#80bfff1f`). Blue never becomes a section fill or a second competing action.
- Status colors are success `#49bf4c`, error `#f55434`, and amber attention. They appear only as small icon-and-text chips; color is never the only status cue and status color never fills a large surface.
- The primary face is Untitled Sans (licensed target) with Geist Sans as the interim implementation face; the evidence face is DM Mono. Untitled Sans uses weight 400 throughout the product scale: h1 `28px/1.2` at `-.03em`, h2 `24px/1.25` at `-.02em`, h3 `21px/1.25` at `-.015em`, h4 `19px/1.3` at `-.01em`, large `17px/1.5`, body `15px/1.5`, small `13px/1.5`, xs `12px/1.45`, and xxs `11px/1.45`.
- DM Mono monocaps carry all evidence, including identifiers, prices, timings, revisions, model routes, seeds, hashes, receipts, timestamps, counts, labels, and table headers. The two monocaps sizes are `10px/1em` and `9px/1em`, both with `+1px` tracking and weight 500.
- Four pixels is the spacing base; common gaps are 8/12/16/24/32px. Compact controls are 32–36px tall, primary controls are at least 40px, and touch targets are at least 44×44px.
- Radii are 4px for controls, 6px for inputs, 8px for cards, and 10px for floating panels, with pill geometry reserved for status dots. Use borders and surface hierarchy before shadows; reserve a soft, tight shadow for floating or transient layers.

### Work-motion language

- While a node executes, a 2px indeterminate filament travels along its top edge on a `1.6s ease-in-out` loop and remains paired with a text state.
- While output moves between nodes, the connecting edge uses flowing brand-colored dashes animated through `stroke-dashoffset` travel. The edge settles to its static lineage state when transfer finishes.
- On arrival, the receiving node's border warms for 180ms and then settles without bounce or scale.
- Reduced motion replaces filament and edge travel with a static directional gradient plus a text state. Motion communicates causality only and never decorates or delays input.

### Ratified Review Approval composition

Review Approval is the approved direction. It requires a named-amount confirm bar with pinned revision, model route, and expiry; QA findings with per-note jump links and approve/reject controls; a free-retry affordance that names retained work; an immutable receipt ledger; version comparison; and batch approvals. The recorded watch items—1440px inspector overflow discipline, full 12-node graph density proof, and quiet retry styling—are high-fidelity obligations, not optional polish.

## Interaction principles

1. **Brief before canvas.** Onboarding progressively captures product truth, brand constraints, audience, offer, and claim rules; the system explains why each required field matters.
2. **Plan before spend.** Agent-proposed graph changes appear as a readable patch with reasons. Provider spend begins only after validation, quote, and explicit confirmation.
3. **Progressive disclosure.** Default views show task, outcome, status, and cost. Provider IDs, hashes, model versions, and lineage remain one action away.
4. **Partial value is visible.** Completed static branches become reviewable while motion or a failed branch continues. Global progress never hides branch state.
5. **Recovery is local.** Errors identify the affected node, retained work, safe retry action, cost consequence, and whether operator reconciliation is required.
6. **Destructive actions are precise.** Confirmation names the affected revision, artifacts, spend, or descendants; generic warning dialogs are not acceptable.
7. **No false completion.** Success requires verified private artifacts and durable state, not merely a provider success response.

Every interactive component defines default, hover when applicable, focus-visible, pressed, disabled, loading, error, and success states. Optimistic UI is allowed only when rollback is deterministic and no money/provider action is implied.

## SuperDesign approval gate

Production UI implementation is blocked until the clean Next scaffold exists and `.superdesign/init/` contains the required repository analysis. For this new product:

1. Capture requirements from the accepted product and UX contracts.
2. Direction exploration is complete: the Lightfield paper-and-ink foundation and exact product constraints are recorded in `.superdesign/design-system.md`.
3. The MustBeViral Studio project and initial paper-studio foundation are complete.
4. Branch exploration is complete across calm density, canvas legibility, and review/approval confidence; the operator ratified Review Approval as the approved direction.
5. Extend Review Approval into campaign brief, canvas, quote/run, output comparison, receipt, and responsive review flows while resolving its recorded high-fidelity obligations.
6. Present rendered URLs and named desktop/tablet/mobile captures to the user.
7. Record explicit user approval of the high-fidelity goldens before production components or pages are implemented.

Approved visual goldens become test fixtures. Later changes branch from the approved draft; a replacement is reserved for a single small approved correction.

## Accessibility contract

- Meet WCAG 2.2 AA for every shipped flow; target 7:1 text contrast where practical.
- Provide a skip link, logical headings and landmarks, a persistent 2px brand-strong `#3182d4` focus-visible outline with a 2px offset, predictable tab order, and focus recovery after dialogs, node deletion, route changes, and errors.
- All essential canvas actions—select, inspect, connect, reorder, configure, validate, and delete—must be possible through the semantic outline/table without pointer gestures.
- Announce agent patches, quote changes, run transitions, progress, partial results, and failures through appropriately scoped live regions without repeated noise.
- Respect reduced motion, forced colors/high contrast, 200% zoom, browser text resizing, and screen magnification.
- Icons have accessible names when actionable and are hidden when decorative. Status always includes text plus icon/shape.
- Generated images require user-editable descriptive text before approval/export.

## Responsive contract

- Desktop at 1280px and wider provides full graph authoring and multi-panel layout.
- Tablet from 768–1279px provides review, canvas navigation, comments, approval, and limited parameter edits using drawers rather than simultaneous side panels.
- Mobile below 768px provides review, comment, approve/reject, receipt, and export. It never presents full graph authoring as usable.
- Unsupported actions remain visible with a short explanation and a desktop continuation link; they are not silently removed.

## Performance budgets

- At least 55 FPS during ordinary pan/zoom with 100 visible nodes on the reference test device.
- A 500-node stress graph remains navigable through level-of-detail rendering and viewport virtualization.
- p75 LCP ≤2.5s, INP ≤200ms, and CLS ≤0.1 on the agreed production measurement segment.
- List and canvas views load thumbnails or metadata, not full-resolution media.
- Route and panel skeletons reserve final geometry; no fake progress percentages are shown.
