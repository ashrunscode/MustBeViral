---
doc_id: experience-contract
---

# Experience contract

## Experience outcome

MustBeViral Studio should make a small growth team feel in control of a complex creative system. The interface exposes what will happen, what it will cost, what changed, what failed, and which output came from which input without forcing the user to understand provider infrastructure.

The user must always be able to answer five questions: Where am I? What is ready? What is blocked? What will this action change or cost? How do I recover?

## Precision Creative Studio direction

- Near-black neutral canvas and panels with restrained violet/blue emphasis; avoid decorative glass, noisy gradients, and ornamental glow.
- Geist Sans for product text and Geist Mono for identifiers, prices, timings, model labels, and execution evidence.
- Dense but calm layout: left tool rail, central infinite canvas, right inspector, top project/run controls, and collapsible bottom activity/output panel.
- Semantic colors: violet/blue active, green verified success, amber attention or reconciliation, red destructive or failed. Color is never the only status cue.
- Base palette for prototype exploration: background `#090A0D`, surface `#111318`, elevated `#171A21`, border `#292E39`, primary text `#F5F7FB`, secondary text `#A7AFBF`, violet `#806BFF`, blue `#5A96FF`, green `#35D08A`, amber `#F2B84B`, red `#F06B7A`. Final tokens must preserve contrast when approved through SuperDesign.
- Four-pixel spacing base; common gaps 8/12/16/24/32; compact controls 32–36px tall; primary controls at least 40px; touch targets at least 44×44px.
- Radius scale 6/8/12px. Use borders and surface hierarchy before shadow; reserve a soft shadow for transient overlays.
- Motion durations 120ms for local feedback, 180ms for panel state, and 240ms for route/major layout transition. Motion communicates causality and never delays input.

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
2. Search SuperDesign style prompts once, select the closest dark-studio foundation, and write `.superdesign/design-system.md` using the approved product constraints.
3. Create the MustBeViral Studio project and one initial Precision Creative Studio draft.
4. Create three explicit dark-studio branch variations focused on: calm density, canvas legibility, and review/approval confidence. All branches must preserve the design-system fonts, palette, spacing, and component rules.
5. Extend the chosen branch into campaign brief, canvas, quote/run, output comparison, receipt, and responsive review flows.
6. Present rendered URLs and named desktop/tablet/mobile captures to the user.
7. Record explicit user approval before production components or pages are implemented.

Approved visual goldens become test fixtures. Later changes branch from the approved draft; a replacement is reserved for a single small approved correction.

## Accessibility contract

- Meet WCAG 2.2 AA for every shipped flow; target 7:1 text contrast where practical.
- Provide a skip link, logical headings and landmarks, persistent focus visibility, predictable tab order, and focus recovery after dialogs, node deletion, route changes, and errors.
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
