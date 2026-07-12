---
doc_id: glossary
---

# Glossary

| Term                      | Meaning                                                                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MustBeViral Studio        | Customer-facing product for planning, generating, reviewing, and exporting campaign creative.                                                           |
| ViralGraph                | Internal graph, execution, lineage, and cost engine. It is not a separate customer-facing brand.                                                        |
| Launch customer           | A US, English-language, Shopify-first DTC/e-commerce brand with a 1–5 person growth or creative team.                                                   |
| Meta Campaign Launch Pack | The first end-to-end job: structured brief to angles, static concepts, channel adaptations, copy, motion, QA, receipt, and export.                      |
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
| Work packet               | Locked, 2–6 hour implementation slice with allowed paths, acceptance evidence, and one next action.                                                     |
| Authority topic           | Named subject owned by exactly one accepted document in the manifest.                                                                                   |
