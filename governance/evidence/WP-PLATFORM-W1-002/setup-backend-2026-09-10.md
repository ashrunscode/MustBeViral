# Saved onboarding and invitation backend

Implemented under W1-002 step 1. No remote or paid execution was performed.

- Fourteen setup operations join the existing authoritative platform registry, with generated
  REST, OpenAPI, typed client, MCP and CLI projections and original caller JWT authorization.
- Additive migrations 20260910150000–20260910170000 persist unapproved brand drafts and exact
  recipient invitations, support existing-brand onboarding, and resolve legacy project mappings.
  Existing brand/workspace record formats, execution commands, tenant ledgers and receipt formats
  remain compatible. Draft/invitation tables force RLS and prohibit direct authenticated writes.
- Start and save retries use durable idempotency. Concurrent edits use versions; workspace
  settings use the current database timestamp. Selected-studio portfolio access requires that
  studio's explicit grant, including when the caller owns a brand through another studio.
- Invitations do not send mail or grant access until acceptance by the exact verified recipient.
  Expiry, owner/member revocation, stale changes and accepted replay cannot restore old access.

Local verification:

- 61 new pgTAP assertions: 46 saved-setup and 15 resource-resolution cases. Both pass against the
  actual local Supabase/Postgres schema. Tests roll back their synthetic fixtures.
- 37 contract tests and 54 Core port/REST/CLI/MCP parity tests pass. All 35 platform operations
  retain common validation and denial semantics. Unavailable reads fail rather than returning
  fabricated empty records.
- Six separate-connection journeys pass in `verify-platform-setup-connected.mjs`: concurrent
  start, competing saves, lost acknowledgement replay, fresh-connection two-brand recovery,
  invitation revocation during acceptance, concurrent acceptance and member revocation during
  save (the six printed outcomes group related cases). Actual database lock contention is
  observed before committing each revocation. Only a uniquely named, schema-only synthetic test
  database is created and removed; the primary database and existing volumes are preserved.
- Contracts, Core, database and CLI strict typechecks pass; contracts/Core/database lint passes.

Evidence level: implemented and locally verified. Connected staging and authorized production
verification remain pending. Desktop/mobile UI, billing and complete packet acceptance are not
claimed here; they are the following steps.
