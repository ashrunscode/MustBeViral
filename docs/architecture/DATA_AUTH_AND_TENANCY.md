---
doc_id: data-auth-tenancy
---

# Data, authentication, and tenancy

## Identity and tenant boundary

Supabase Auth issues user sessions and JWTs. The web application uses supported server/client Supabase helpers. Core validates bearer JWTs against Supabase JWKS, rejects unexpected issuer/audience/expiry, and carries a typed actor containing `user_id`, request ID, and authentication method.

Workspace is the tenant, billing, spend-cap, and deletion boundary. Every tenant-owned row includes `workspace_id` directly or is reachable through a constrained parent with tested RLS. P0 enables one owner per workspace; later roles are additive and cannot weaken existing policies.

Unauthenticated access is limited to health, signed provider webhooks, explicit public marketing routes, and signed artifact-access capabilities. Webhook identity comes from provider signature verification, not a user claim. An artifact-access capability is a server-minted HMAC token naming exactly one object with its content hash, byte size, mime type, and expiry pinned inside the signed payload; it exists because provider image fetchers send no headers, it is short-lived, and the bucket itself keeps zero external readers - the Worker remains the only reader and serves bytes only against a valid capability.

### Collaboration trust boundary

The collaboration Worker has no database access and trusts no identity a client sends. Core issues a collaboration ticket at `POST /v1/canvases/{id}/collaboration-tickets` only to a Supabase browser session that passes the same checks as the other canvas endpoints: the canvas read through the caller's JWT and RLS, then an active workspace membership. Scoped API keys and OAuth tokens are refused. A ticket is `base64url(claims).base64url(HMAC-SHA256)` over canonical JSON claims `v`, `aud` (`collaboration`), `canvas_id`, `sub` (the Supabase user id), `name`, `color`, `iat` and `exp`. It lives 60 seconds; the verifier rejects any signed lifetime above 120 seconds and allows 15 seconds of clock skew. Core and the collaboration Worker share the signing key `COLLABORATION_TICKET_SECRET` per environment. The display name is a label derived from the user id, never an email address or provider profile field, because no profile or membership name exists yet.

The Worker reads a ticket only from `Authorization: Bearer` on snapshot reads and from the WebSocket subprotocol offer `mbv-collab.v1, <ticket>` on upgrades, never from the URL, because invocation logs record URLs. It answers a missing, forged, expired, wrong-audience or other-canvas ticket with 401, and every canvas request with 503 when the key is absent or shorter than 32 characters; `/health` stays open. After verification it passes the identity to the canvas's coordination object in an internal header that it deletes from every incoming request first. The object stores that identity on the socket attachment, so it survives hibernation, and acts as that identity for presence, comment authorship, draft authorship, lease holding and release, and draft clearing, ignoring identity fields in message payloads. A ticket can be replayed until it expires.

### Collaboration revocation window

Core re-checks the canvas read and the active membership for every ticket, including every reconnect. An open socket is not re-checked, so the coordination object bounds how long one can live: 600 seconds after the `iat` of the ticket that opened it, taking the earlier of `iat` and the object's clock at acceptance, so an issuer clock running ahead within the 15-second skew allowance cannot extend it. The expiry is stored in the socket attachment, and a Durable Object alarm set for the earliest expiry closes the socket with close code `4401`, including after hibernation. Until the alarm runs, an expired socket's messages are not processed (the object closes it instead) and broadcasts skip it. The web client treats `4401` as "reconnect with a fresh ticket": it requests a new ticket at once, without backoff (a `4401` within 30 seconds of opening gets the normal backoff instead, so a faulty server cannot cause a request loop), keeps the last snapshot and queues up to 16 messages for at most 10 seconds meanwhile. If Core refuses that ticket the client stops. It treats close code `1008` (no valid identity, or sustained abuse) as final.

The residual window is therefore bounded, not zero: after a member is removed or a workspace is deleted, a socket opened with a ticket issued just before that change keeps reading and writing drafts on that canvas for at most 600 seconds after the ticket's issue time, plus up to 15 seconds of clock skew between Core and the Worker. The same ticket can be used for snapshot reads or to open further sockets only until it expires, at most 75 seconds after issue. Ten minutes trades that window against reconnect cost (one Core ticket request and one full snapshot per member every ten minutes), and collaboration state is draft-only: it holds no revision, billing or provider authority. Drafts, comments and leases already written stay in the coordination object after removal or workspace deletion; nothing erases them yet, and no one can read them without a new ticket.

### Collaboration limits and abuse resistance

The collaboration Worker rejects over-limit input with a typed error and never truncates it. All values live in `packages/collaboration/src/limits.ts` and `apps/collaboration/src/rate-limit.ts`.

| Limit                                                  | Value                                                | Reason                                                                                                       |
| ------------------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Comment body                                           | 1-4,000 characters                                   | A review note of about 600 words                                                                             |
| Text draft body                                        | 0-4,000 characters                                   | A generation prompt or configuration note                                                                    |
| Node, anchor, comment, revision and client request ids | 128 characters                                       | Existing id bound; server comment ids are 36-character UUIDs                                                 |
| Field path                                             | 128 characters                                       | Paths such as `parameters.prompt`                                                                            |
| Draft id and lease id                                  | 1,543 and 1,551 characters                           | The longest JSON keys `textDraftKey` and `leaseIdForActor` produce from ids at their limits                  |
| Draft ids per checkpoint clear                         | 64                                                   | Equal to the per-canvas draft cap                                                                            |
| Client WebSocket message                               | 32 KiB (UTF-8), checked before parsing               | A comment or draft at its field limits is under 28 KiB even with every character escaped                     |
| Comments                                               | 200 per canvas and 192 KiB; 50 and 48 KiB per member | Review threads on one canvas; one member can use at most a quarter                                           |
| Text drafts                                            | 64 per canvas and 192 KiB; 32 and 96 KiB per member  | Unsaved fields are meant to be checkpointed; one member can use at most half                                 |
| Leases                                                 | 32 per canvas and 64 KiB; 4 and 8 KiB per member     | A member edits one leased node at a time; one member can use at most an eighth                               |
| Presence                                               | 32 members, 48 KiB                                   | Concurrent viewers of one canvas; one row per member, so no per-member budget is needed                      |
| Open sockets                                           | 64 per canvas, 4 per actor                           | A few tabs per member; refused with HTTP 429                                                                 |
| Snapshot message                                       | 512 KiB                                              | Section budgets total 496 KiB; far below the 32 MiB Workers WebSocket limit, and under the earlier 1 MiB one |

Byte budgets count the UTF-8 JSON of stored rows, so a snapshot at every cap stays under its ceiling even when every character escapes to six bytes. Every write is checked against the member's own row cap and byte budget before the canvas budget, and the per-member budgets are the same fraction of the canvas budget as the per-member row caps, so one member can never fill a section and deny it to everyone else: without them, 47 comments of 4,000 characters, or 9 escape-heavy drafts on a node the member leases (which no one else can clear), filled the canvas. Each member's share can still be used up only by that member, who can delete their own comments or checkpoint their own drafts; the object also refuses to send any snapshot above the ceiling (`SNAPSHOT_TOO_LARGE`). Errors are `FIELD_TOO_LARGE` (with field, limit and unit), `PAYLOAD_TOO_LARGE`, `CANVAS_LIMIT_REACHED` (with resource, scope, unit and limit), `RATE_LIMITED` (with scope and `retry_after_ms`), `FORBIDDEN`, `NOT_FOUND` and `VALIDATION_FAILED`; none echoes message content. Rows stored before these limits are checked once, when an object first loads schema version 2: rows that fail the current limits are dropped, every lease stored under the old joined id is dropped, and the rest are trimmed fairly, first each member to their own row cap and byte budget keeping their newest rows, then the canvas caps round-robin across members from each member's newest row, so one member's rows never evict another's. The check runs once; later wakes keep leases and rows. Every read also validates each stored row against the current schema and quarantines a row that fails, such as one an older Worker wrote after a rollback: it stays in storage but is never sent, counted or acted on, only a per-section count is logged, and a new write to the same draft or lease key replaces it, so one bad row cannot break a canvas.

Every message spends one token (a snapshot request five) from its socket's bucket, 30 burst and 10 per second, and from its actor's bucket across that actor's sockets on the canvas, 60 burst and 20 per second; snapshot reads and socket opens spend five from the actor's bucket. A refused message returns `RATE_LIMITED` and adds one strike to the socket. Frames that fail before doing any work are not free: an oversized frame spends 10 tokens and adds 5 strikes, and a frame that is not JSON or fails the protocol schema spends 5 tokens and adds 2 strikes, even though it gets its typed error. Strikes drain at one per second and a socket with more than 20 undrained strikes is closed with `1008`, so one oversized frame a second closes a socket within five seconds. Clients check the same limits before sending and never send such frames. Broadcasts are coalesced to at most one full snapshot per canvas every 100 ms, so fan-out is bounded by 10 snapshots a second of at most 512 KiB to at most 64 sockets, whatever members send; sending changes instead of full snapshots would lower that bound further and is not built. The buckets live in object memory, so an eviction can hand a client one fresh burst; an object is evicted only after it is idle.

The web client shows every refusal (limits, rate limit, a draft refused because another member holds the lease, and input over a limit it catches before sending) as a short alert in the collaboration panel until the next accepted change.

Comment ids are generated by the object (`crypto.randomUUID()`) and returned in `comment.result`; a client-sent id is never used, including on the legacy `comment.upsert`, which is handled as a create. Only a comment's author can update or delete it. Lease ids are the injective `JSON.stringify(["lease", node_id, actor_id])` derived by the object from the bound actor, so no two node and actor pairs share an id; the legacy joined id is accepted only as a check against the caller's own node and releases only the caller's own lease.

Deploy the collaboration Worker before the web app. The new web client sends `comment.create`, `comment.update`, `comment.delete` and node-only lease messages, which an older Worker rejects. An older web client still works against the new Worker (legacy `comment.upsert` and legacy lease ids are accepted, and `4401` is an ordinary reconnect for it), with these losses until it updates: comments of 4,001 to 8,000 characters and text drafts of 4,001 to 32,000 characters are refused, and because that client ignores `error` frames the text silently fails to sync; a client that keeps syncing such a draft sends invalid frames and is closed with `1008`, then reconnects with its own backoff; and a `text.draft.result` with reason `limit_reached` sets its status to error.

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
- Deleting a workspace revokes access immediately, schedules policy-compliant artifact/data erasure, and preserves only legally required accounting/audit evidence in a de-identified form. Collaboration sockets that are already open are the one bounded exception; see "Collaboration revocation window".
- Backups, exports, logs, and telemetry follow the same tenant and retention boundary and never contain secrets or provider payloads unnecessarily.
