---
doc_id: adr-0003-fal-first
---

# ADR-0003: Use fal first behind provider-neutral interfaces

## Status

Accepted on 2026-07-12.

## Decision

Implement `FalTransport` first. Preserve separate provider transport and model driver interfaces, and enable only 3–5 curated launch-pack models. Copy verified output immediately to private R2.

## Rationale

One transport accelerates the product-validation spike across several capabilities. Model schemas, economics, licensing, safety, and idempotency still differ, so a claimed universal model adapter would be unsafe. The split preserves a clean path to direct high-volume integrations.

## Consequences

- Every model has a versioned driver and catalog evidence.
- Provider URLs are temporary inputs, never product storage.
- Direct adapters are introduced only when measured margin, volume, control, or SLA justifies migration.
- User-visible commands and receipts remain stable across transport changes.
