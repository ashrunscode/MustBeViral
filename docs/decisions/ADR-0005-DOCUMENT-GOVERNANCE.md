---
doc_id: adr-0005-document-governance
---

# ADR-0005: Make Git the documentation database

## Status

Accepted on 2026-07-12.

## Decision

Use repository Markdown for human contracts, YAML/JSON Schema for machine state, generated references for code-owned truth, and Git/PRs for history. `MANIFEST.yaml` assigns one accepted authority per topic. Do not create a second documentation database or an active archive.

## Rationale

Agent continuity fails when current status, plans, implementation truth, and historical prose compete. A small registered authority graph plus automated validation is easier to trust than many “final” documents.

## Consequences

- Markdown frontmatter contains only `doc_id`; lifecycle and ownership live in the manifest.
- One active work packet defines bounded execution and one next action.
- Generated references are never manually edited.
- Old generations remain in Git evidence, not active-tree folders.
- CI rejects conflicting authorities, unregistered docs, placeholder markers, stale generated output, forbidden paths/names, and legacy fingerprints.
