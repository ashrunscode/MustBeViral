---
doc_id: adr-0004-immutable-graph-revisions
---

# ADR-0004: Store immutable JSONB graph revisions

## Status

Accepted on 2026-07-12.

## Decision

Store each accepted canvas revision as one validated, canonical JSONB graph snapshot with schema version, SHA-256 hash, parent, actor, reason, and timestamp. `canvases.head_revision_id` points to the current revision. Never maintain a second mutable node/edge authority.

## Rationale

Immutable snapshots make provider execution, lineage, quote comparison, conflict detection, restoration, and audit reproducible. For the bounded P0 graph size, snapshot simplicity and integrity outweigh normalized incremental storage.

## Consequences

- Every patch requires `expected_revision_id` and stale writes fail explicitly.
- Runs pin revision ID/hash and cannot change after submission.
- History restore creates a new revision.
- P2 collaboration state is a mutable draft only; checkpoints emit the same revision format.
