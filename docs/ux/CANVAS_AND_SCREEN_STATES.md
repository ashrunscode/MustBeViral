---
doc_id: canvas-screen-states
---

# Platform screens and creative canvas

The accepted platform screen model extends the existing creative execution screens. A specified screen is not evidence that it is implemented or connected.

## Information architecture

| Scope             | Primary surfaces                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Studio            | Overview, Brands, Calendar, Approvals, Tasks, Creators/Partners, Reports, Team, Settings.     |
| Brand             | Overview, Brand Intelligence, Assets, Channels, Campaigns, Content, Calendar, Inbox, Results. |
| Campaign          | Overview/brief, Plan, Content, Collaborators, Approvals, Calendar, Results, Budget.           |
| Content item      | Source/brief, Editor, Channel previews, QA, Comments, Approval, Publishing history.           |
| Advanced settings | Billing, API access, reusable agent workflows, integrations, audit, export, ownership.        |

Keep brand avatar/name and workspace context visible. Use breadcrumbs and real durable identifiers. Search and quick switching must handle many brands without accidental changes to the wrong account.

## Required screen states

All screens require loading, empty, permission-denied, unavailable, error and useful recovery states. Editable screens also require draft, saving, saved and conflict states. Brand context remains visible through navigation, reload and session expiry. Unknown balances and metrics are not zero.

- Onboarding: source entry, durable draft, bounded analysis, partial findings, corrections, missing facts/assets and approved version.
- Assets: resumable upload, processing/quarantine, rights review, searchable library, expired rights and lineage.
- Connections: ready, reconnect, missing permissions, provider review pending, unsupported, manual completion and temporarily unavailable.
- Campaign/content: plan, edit, revision comparison, QA, request changes, approval and exact-variant publication history.
- Calendar: unscheduled, scheduled, submitting, confirmed, failed, canceled and reconciliation required; local time and DST resolution.
- Portfolio/client: scoped brand selection, assignments, reviews, partial bulk results, revocation and offboarding.
- Results/billing: available, stale, unavailable, permission denied, true zero, low balance and blocked.

## Advanced creative canvas composition

- **Top bar:** breadcrumb, revision status, undo/redo for the mutable draft, validate, quote/run, viewport controls, and a clearly separated overflow menu.
- **Left rail:** add/search nodes, templates allowed by phase, semantic outline toggle, and help. Dragging is optional; keyboard insertion is first-class.
- **Center:** infinite canvas, minimap when useful, selection and dependency emphasis, branch grouping, and level-of-detail behavior.
- **Right inspector:** selected node purpose, inputs, parameters, constraints, model route, estimated cost, validation, lineage, and actions. Unsaved edits are explicit.
- **Bottom panel:** activity, branch progress, outputs, warnings, logs safe for customers, and provider evidence in an advanced disclosure.

Panels preserve user sizing per device class. Canvas position is saved per user, never treated as graph authority.

## Node visual grammar

Each node displays type, concise name, outcome preview, status word, status icon/shape, cost when known, and input/output ports. The border conveys selection; a separate rail/icon conveys execution state so selection and status cannot be confused.

| State          | Required presentation                            | Allowed actions                                    |
| -------------- | ------------------------------------------------ | -------------------------------------------------- |
| Draft          | neutral border, “Draft” label                    | configure, connect, delete                         |
| Invalid        | red issue count, readable reason                 | inspect, repair, delete                            |
| Ready          | blue ready mark                                  | quote, inspect, change                             |
| Queued         | clock icon and queue text                        | inspect, request cancel when supported             |
| Running        | bounded activity indicator and elapsed time      | inspect, request cancel when supported             |
| Succeeded      | green verified mark and output count             | inspect, compare, approve, rerun descendants       |
| Partial        | amber split-state mark                           | inspect completed output, retry failed branch      |
| Failed         | red failure mark with owner and recovery         | inspect, retry when safe, reconcile when ambiguous |
| Canceled       | neutral canceled mark and captured/released cost | inspect, duplicate into a new run                  |
| Reconciliation | amber lock and “Needs verification”              | inspect; no blind retry                            |
| Superseded     | dimmed with newer revision link                  | inspect history, restore through new revision      |

## Graph editing commands

- Add a node from search, keyboard command palette, outline action, or drag.
- Connect only compatible typed ports. Rejected connections explain expected and actual types.
- Reorder independent branches without changing execution meaning; dependency changes create a new patch.
- Delete previews affected descendants and retained artifacts before confirmation.
- Configure changes remain in a local draft until validated and checkpointed as an immutable revision.
- Apply-agent-patch shows additions, removals, updates, rationale, affected descendants, and estimated cost impact before acceptance.
- Undo/redo operates on the local draft. Restoring history always creates a new immutable revision rather than modifying history.
- A stale `expected_revision_id` opens a conflict view with current head, local patch, non-conflicting replay option, and safe discard/export choices.

## Semantic outline parity

The semantic outline is a hierarchical tree/table ordered topologically. Rows expose type, name, upstream/downstream counts, status, validation, model, estimated/actual cost, and output count. Keyboard users can insert before/after, choose typed connections, move within independent ordering, edit parameters, validate, inspect impact, and delete. Every canvas-only gesture has an outline command or documented non-essential status.

## Quote and confirmation

Quote displays pinned revision, included branches, model routes, maximum charge, reservation amount, expiry countdown, spend-cap impact, and price-change explanation. Confirmation uses an explicit action labeled with maximum price. On expiry or revision change, confirmation disables and requires a fresh quote; it never silently requotes and submits.

## Progress and recovery

- Overall progress is derived from branch states and named stages, never invented percentages.
- Static outputs appear immediately after artifact verification even if motion remains active.
- Failure messages state what succeeded, what failed, whether spend was accepted, what was retained, and the single safest next action.
- Retry previews which node/descendants will run and the new maximum charge.
- Ambiguous submission disables normal retry and opens reconciliation status.
- Cancel clearly distinguishes request accepted, provider cancellation confirmed, work already billable, and reservation released.

## Approval and export

The existing launch-pack Review retains its concept and placement grouping. Platform approval applies to the exact content/channel variant, with pinned brand, media, account and rights versions. Editing material content invalidates the affected approvals; timing-only changes follow workspace policy.

Approval pins artifact versions and captures actor, timestamp, optional note, and required accessibility description. Concept approve maps onto the existing approval operation for that concept’s artifacts. Reject requires a reason category plus optional note and is not durable until a reject operation exists; the control must not imply a recorded rejection before then.

Superseding an approved artifact preserves its approval history.

Export lists every expected file before creation, reports missing/failed items, and never labels an incomplete bundle complete. Downloads use expiring signed URLs and provide regeneration without changing the underlying receipt.
