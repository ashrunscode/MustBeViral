---
doc_id: glossary
---

# Glossary

| Term                      | Meaning                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MustBeViral Studio        | Customer-facing product for managing brands, planning, creating, approving, publishing, collaborating and measuring content.                            |
| ViralGraph                | Internal graph, execution, lineage, and cost engine. It is not a separate customer-facing brand.                                                        |
| Launch customer           | A single-business operator or multi-brand client studio working across local services and e-commerce.                                                   |
| Meta Campaign Launch Pack | The existing creative engine workflow, retained within the broader platform.                                                                            |
| Workspace                 | Top-level tenant and billing boundary.                                                                                                                  |
| Project                   | Campaign work container within one workspace.                                                                                                           |
| Canvas                    | User-visible graph workspace whose current durable state points to one immutable revision.                                                              |
| Graph snapshot            | Canonical JSON representation of nodes and edges at one revision.                                                                                       |
| Canvas revision           | Immutable, validated graph snapshot with schema version, canonical hash, parent, actor, reason, and timestamp.                                          |
| Graph patch               | Schema-validated command that proposes deterministic changes against an expected revision.                                                              |
| Node                      | Typed unit in a graph, such as brief, planning, generation, QA, or export.                                                                              |
| Edge                      | Typed dependency, data, or artifact connection between nodes.                                                                                           |
| Affected descendants      | Downstream executable nodes invalidated by an input or configuration change.                                                                            |
| Run                       | User-confirmed execution of a pinned graph revision and quote.                                                                                          |
| Run node                  | Materialized execution record for one executable graph node.                                                                                            |
| Attempt                   | One owned execution attempt for a run node.                                                                                                             |
| Provider job              | External provider request and its normalized lifecycle.                                                                                                 |
| Artifact                  | Private, immutable media or data output stored under MustBeViral control.                                                                               |
| Lineage                   | Evidence connecting an artifact to inputs, graph revision, attempt, model, provider, price, and policy versions.                                        |
| Model route               | Versioned mapping from a capability to a transport, provider model, driver, and operational policy.                                                     |
| Price catalog             | Versioned model economics and customer-price inputs used for quotes.                                                                                    |
| Quote                     | Fifteen-minute, immutable maximum price for one pinned run.                                                                                             |
| Cost reservation          | Temporary wallet allocation created when the user confirms a run.                                                                                       |
| Ledger transaction        | Immutable integer-micro accounting event such as reserve, capture, release, or refund.                                                                  |
| Outbox event              | Durable post-transaction instruction that makes asynchronous dispatch recoverable and idempotent.                                                       |
| Barrier transaction       | Short authoritative transaction that verifies revision, membership, budgets, and invariants while creating run, reservation, attempt, and outbox state. |
| Skill                     | User-visible reusable workflow instruction. Each published version is immutable.                                                                        |
| Transport                 | Provider-family integration for authentication, submission, polling, cancellation, and webhook verification.                                            |
| Model driver              | Model-specific validation, request encoding, output normalization, quote logic, and idempotency policy.                                                 |
| Semantic outline          | Accessible table/tree representation with command parity for essential canvas operations.                                                               |
| Work packet               | One bounded, reviewable delivery slice with allowed paths, acceptance evidence, rollback and one next action.                                           |
| Authority topic           | Named subject owned by exactly one accepted document in the manifest.                                                                                   |

## Platform objects

| Object           | Meaning                                                                                                                     |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Studio           | The operator's portfolio, team, assignments, saved views, and permitted aggregate reporting.                                |
| Client workspace | Durable tenant, ownership, access, data export/deletion, and ledger boundary. Existing workspaces remain this boundary.     |
| Brand            | A business identity with its own knowledge, voice, assets, audience, offers, and publishing policy.                         |
| Location         | A branch, store, service area, language, hours, inventory, or local variation of a brand.                                   |
| Channel          | A specific connected social account, with exact external identity and verified capabilities.                                |
| Campaign         | A business objective, audience, offer, period, budget, content plan, channels, collaborators, and outcome definition.       |
| Content item     | An idea or deliverable, with immutable revisions, source evidence, creative assets, and approvals.                          |
| Channel variant  | The caption, media, metadata, locale, format, and timing tailored to one destination.                                       |
| Publication      | A controlled delivery attempt to one account, with provider acknowledgment and eventual publication evidence.               |
| Creator/partner  | A person or organization with verified identity, fit evidence, relationship history, permissions, and campaign obligations. |

A studio can access multiple client workspaces through explicit grants. A client workspace may contain several related brands. A person owning unrelated brands can keep them in separate workspaces while managing them through the same studio. Portfolio visibility must never imply unrestricted access to every client's assets, messages, or billing.

Brand is not a color palette attached to a campaign. It is the reusable context governing all future work. Campaigns reference a specific approved brand version so historical outputs remain explainable.
