# Supersession implementation verification

The owner-authorized amendment is committed at `81cf856`. Runtime application files and remote
resources are unchanged. The new `agent:supersede` command preserves unfinished acceptance in a
version 2 receipt while retaining the version 1 completion contract.

Verified locally on September 9, 2026 with Node 24.18.0 and pnpm 11.12.0:

- `pnpm agent:verify` passed, including design, governance, formatting, strict types, lint, unit
  and integration tests, and all 18 workspace builds. The builds reused valid Turbo cache entries.
- All 141 governance tests passed with zero failures, including actual supersession command
  integration, missing/uncommitted or inferred authorization, wrong revision/branch, invalid
  successor readiness, attempted external-authority expansion, duplicate execution and tampering.
- Transaction tests injected failure and interrupted recovery at all four supersession write
  boundaries; predecessor authority and history rolled back together without orphan receipts.
- Existing completion tests passed without weakening their acceptance preconditions; unfinished
  observation still prevents `agent:finish`.
- All 15 historical completion receipts passed validation. Supersession tests separately proved
  version 2 receipt identity, complete predecessor evidence coverage and preserved pending checks.

The Core integration harness reported its existing Vite shutdown warning after passing its tests;
the verification process exited successfully. Database pgTAP and live product journeys were not
run by this governance change. Their evidence remains separate.

Next action: commit the verified transition implementation and evidence, run the owner-authorized
supersession command, and activate the revised WP-P3-010 authority rebaseline.
