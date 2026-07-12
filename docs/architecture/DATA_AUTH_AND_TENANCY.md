---
doc_id: data-auth-tenancy
---

# Data, authentication, and tenancy

## Identity and tenant boundary

Supabase Auth issues user sessions and JWTs. The web application uses supported server/client Supabase helpers. Core validates bearer JWTs against Supabase JWKS, rejects unexpected issuer/audience/expiry, and carries a typed actor containing `user_id`, request ID, and authentication method.

Workspace is the tenant, billing, spend-cap, and deletion boundary. Every tenant-owned row includes `workspace_id` directly or is reachable through a constrained parent with tested RLS. P0 enables one owner per workspace; later roles are additive and cannot weaken existing policies.

Unauthenticated access is limited to health, signed provider webhooks, and explicit public marketing routes. Webhook identity comes from provider signature verification, not a user claim.

## Core relational model

- `workspaces`, `workspace_memberships`, `projects`, `brand_kits`
- `canvases`, `canvas_revisions`
- `runs`, `run_nodes`, `attempts`, `provider_jobs`
- `artifacts`, `artifact_lineage`
- `skills`, `skill_versions`
- `model_routes`, `price_catalog_versions`
- `quotes`, `cost_reservations`, `ledger_transactions`
- `audit_events`, `outbox_events`, `idempotency_records`

Use UUID primary keys, timestamptz timestamps, explicit foreign keys, checks for all state/value domains, unique constraints for idempotency, and indexes derived from actual workspace/time/status query shapes. Raw SQL migrations are reviewed authority; generated database types are outputs.

## Immutable graph revision model

`canvases.head_revision_id` points to the current accepted revision. Each `canvas_revision` stores:

- canvas/workspace identity and immutable revision ID
- parent revision ID when present
- graph schema version
- one validated JSONB graph snapshot
- canonical SHA-256 hash of normalized graph data
- actor type/ID, reason, and creation time

The graph snapshot contains typed nodes, typed edges, deterministic ordering rules, node parameter schema versions, and no runtime/provider secrets. It is the sole durable graph authority; mutable node/edge tables are not permitted.

Every patch supplies `expected_revision_id`. The transaction rejects a stale head with `REVISION_CONFLICT`; it never applies a best-effort merge. A caller may replay non-conflicting intent against the new head and create another revision. History restore also creates a new child revision.

Runs pin a revision ID and hash. Subsequent canvas edits cannot change an existing run.

## RLS contract

- Enable and force RLS on every user-visible tenant table.
- Authenticated policies derive actor identity from the validated Supabase JWT and require active workspace membership.
- Reads outside membership return no row; mutations additionally enforce allowed role/action and immutable-column restrictions.
- Users cannot insert or mutate ledger entries, provider jobs, audit events, outbox events, model prices, or machine-owned state directly.
- Security-definer functions are exceptional, schema-qualified, use a fixed safe `search_path`, validate the actor and workspace inside the transaction, expose only necessary arguments, and revoke public execution.
- Service and migration roles are not accepted as application user identities.
- Cross-tenant tests exercise every table, view, function, storage policy, and pooled connection path.

## Data access paths

The default user-scoped path is Supabase Data API/RPC using the original JWT so native RLS sees the caller. Core may call hardened RPC functions for authoritative multi-row commands.

Hyperdrive is not automatically trusted for user commands. It is enabled for the barrier only after a dedicated staging spike proves all of the following:

1. The login role is not an owner, superuser, service role, or `BYPASSRLS` role.
2. Transaction-local claims and role are set only after authentication and are cleared after commit, rollback, timeout, and error.
3. Reused pooled connections cannot observe the prior user/workspace identity.
4. Barrier functions recheck membership, expected revision, quote, and spend caps inside the transaction.
5. The path is at least 20% faster than the Data API/RPC baseline on the same workload.
6. Warm/cold p95 is ≤250ms and p99 ≤500ms under representative concurrency and conflict rates.

If any condition fails, user-scoped barriers remain on Data API/RPC. Hyperdrive may serve narrowly privileged background operations through a separate least-privilege machine role. A coordination store cannot become authority for money, permissions, or revisions.

## Barrier transaction

The start-run barrier accepts actor, workspace, canvas, expected revision, quote, and idempotency key. In one short transaction it:

1. verifies membership and workspace state;
2. locks/checks the current revision and quote;
3. verifies quote expiry, price version, wallet and all spend caps;
4. creates the run pinned to revision/hash;
5. creates the cost reservation and initial run-node/attempt records;
6. creates one unique outbox event and idempotency result;
7. commits before any external publication or provider request.

Any failure rolls back every row. Duplicate idempotency keys with the same input return the original result; reuse with different input returns conflict.

## Migration and deletion rules

- Migrations are forward-only in production with a tested restore/repair path; destructive changes use expand/backfill/contract phases.
- Staging runs the exact production migration sequence against representative data before production approval.
- Deleting a workspace revokes access immediately, schedules policy-compliant artifact/data erasure, and preserves only legally required accounting/audit evidence in a de-identified form.
- Backups, exports, logs, and telemetry follow the same tenant and retention boundary and never contain secrets or provider payloads unnecessarily.
