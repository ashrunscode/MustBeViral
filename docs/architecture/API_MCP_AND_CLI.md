---
doc_id: api-mcp-cli
---

# API, MCP, and CLI

## One command layer

Browser routes, REST handlers, MCP tools, and the later CLI are adapters over the same typed command/query handlers. Adapters authenticate, parse, validate, authorize, call one handler, and serialize the result; they cannot contain graph, provider, billing, or tenancy policy.

Zod schemas are the source for TypeScript types and OpenAPI 3.1. Breaking wire changes create a new `/vN` surface while supported versions coexist through an announced migration window.

## HTTP contract

- Base URL: `https://api.mustbeviral.com/v1`; staging uses `https://api-staging.mustbeviral.com/v1`.
- Authentication: `Authorization: Bearer <Supabase JWT>` in P0/P1a; scoped OAuth/API keys begin P1b.
- Every request receives `X-Request-Id`; a safe caller-supplied ID may be accepted but never trusted for authorization.
- Every state-changing request from an authenticated client (browser, REST, MCP, CLI) requires `Idempotency-Key`. Same key and canonical input returns the stored result; changed input returns `409 IDEMPOTENCY_CONFLICT`. Signed provider webhooks are exempt from this header: they authenticate through raw-body signature verification and deduplicate through the verified provider event identity recorded under a durable unique key before acknowledgement.
- JSON success shape: `{ "data": ..., "meta": { "request_id": "..." } }`.
- JSON error shape: `{ "error": { "code": "...", "message": "...", "request_id": "...", "retryable": false, "details": ... } }`.
- Errors never contain secrets, SQL, provider headers, internal stack traces, or another tenant’s identifiers.
- List endpoints use opaque cursor pagination ordered by stable timestamp plus ID; default 20, maximum 100.

## P0 command/query surface

| Method and path                  | Shared operation     | Notes                                                   |
| -------------------------------- | -------------------- | ------------------------------------------------------- |
| `POST /workspaces`               | create workspace     | creates owner membership                                |
| `GET /workspaces/{id}`           | get workspace        | tenant-scoped                                           |
| `POST /workspaces/{id}/projects` | create project       | state-changing/idempotent                               |
| `GET /projects/{id}`             | get project          | includes current campaign status                        |
| `POST /projects/{id}/canvases`   | create canvas        | creates initial revision                                |
| `GET /canvases/{id}`             | get canvas context   | head revision plus safe catalog context                 |
| `POST /canvases/{id}/patches`    | apply graph patch    | requires `expected_revision_id`                         |
| `POST /canvases/{id}/validate`   | validate graph       | returns issues and affected descendants                 |
| `POST /canvases/{id}/quotes`     | quote run            | pins revision and price versions                        |
| `POST /quotes/{id}/runs`         | start run            | requires explicit confirmation flag and unexpired quote |
| `GET /runs/{id}`                 | get run              | branch progress, artifacts, costs, recovery             |
| `POST /runs/{id}/cancel`         | request cancellation | reports accepted versus confirmed cancellation          |
| `POST /artifacts/uploads`        | create signed upload | exact object purpose and bounds                         |
| `GET /artifacts/{id}`            | get artifact         | metadata and short-lived access when authorized         |
| `POST /runs/{id}/exports`        | create export        | immutable input set, recoverable generation             |
| `GET /models/{id}`               | explain model        | capability, operational and price explanation           |
| `GET /runs/{id}/receipt`         | get usage receipt    | immutable provider/model/cost/lineage view              |
| `POST /webhooks/fal`             | ingest fal event     | raw-body signature verification and deduplication       |

Live collaboration adds `POST /canvases/{id}/collaboration-tickets`: a browser-session-only query that writes nothing, needs no `Idempotency-Key`, and returns a short-lived signed ticket for the collaboration Worker. Core re-checks canvas access and active membership for every ticket, and clients request a new one for every connection and reconnect. The trust boundary, revocation window and limits are defined in `DATA_AUTH_AND_TENANCY.md`.

The collaboration Worker is not part of `/v1`. It serves `GET /canvases/{id}/snapshot` and the WebSocket `GET /canvases/{id}/ws` (subprotocol `mbv-collab.v1`). Client messages are `presence.join`, `presence.leave`, `comment.create`, `comment.update`, `comment.delete`, `text.draft.upsert`, `text.draft.clear`, `lease.acquire`, `lease.release` and `snapshot.request`; the legacy `comment.upsert` still parses and is handled as a create. Server messages are `snapshot`, `comment.result` (with the server-assigned `comment_id`), `lease.result`, `text.draft.result`, `text.draft.clear.result` and `error` with a typed `code` (`FIELD_TOO_LARGE`, `PAYLOAD_TOO_LARGE`, `CANVAS_LIMIT_REACHED`, `RATE_LIMITED`, `SNAPSHOT_TOO_LARGE`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`), optional `request_type`, `client_request_id` and `details`. Leases are named by `node_id`; the Worker derives the lease id. A client sends `presence.join` once per socket and no heartbeat: the member stays present while a joined socket is open and within its lifetime. Close code `4401` means the socket reached its 600-second lifetime and the client should reconnect with a fresh ticket; `1008` means no valid identity or sustained abuse, and the client should not reconnect. Socket opens over a per-canvas or per-actor cap and snapshot reads over the actor's rate limit return HTTP 429. Oversized and invalid frames spend extra rate-limit tokens and strikes. Deploy the Worker before the web app; the older-client losses are listed in `DATA_AUTH_AND_TENANCY.md`.

Stripe webhook ingestion is added in P1a at `POST /webhooks/stripe`. Provider webhook endpoints acknowledge only after durable deduplication/evidence recording or return a retryable error.

## Stable error codes

Initial codes include `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_FAILED`, `REVISION_CONFLICT`, `IDEMPOTENCY_CONFLICT`, `QUOTE_EXPIRED`, `QUOTE_STALE`, `BUDGET_EXCEEDED`, `INSUFFICIENT_BALANCE`, `GRAPH_INVALID`, `MODEL_UNAVAILABLE`, `PROVIDER_REJECTED`, `PROVIDER_AMBIGUOUS`, `ARTIFACT_NOT_READY`, `RUN_NOT_CANCELABLE`, `RATE_LIMITED`, and `INTERNAL_ERROR`. HTTP status and `retryable` are defined per code in contracts; callers never infer retry safety from status alone.

## Private P0 MCP proof

P0 exposes exactly five private operations through the Core Worker:

1. `get_canvas_context`
2. `apply_canvas_patch`
3. `quote_run`
4. `start_run`
5. `get_run`

MCP input/output schemas reuse the same Zod contracts. `start_run` requires quote ID, explicit `confirmed: true`, and idempotency key; the tool description cannot imply autonomous spending. Tools return structured safe errors rather than transport exceptions. MCP Inspector plus two real clients must prove the same revision, validation, quote, run, and error semantics as REST.

Production OAuth, broader tools, discoverable public documentation, revocation, scopes, and audit UX ship in P1b.

## CLI contract

The CLI begins in P1b and is a thin API client. It supports machine-readable JSON by default in automation, human tables when interactive, explicit environment selection, secure browser/device authentication, scoped credentials in the OS credential store, idempotency keys for mutations, and non-zero stable exit codes. It cannot read provider or database secrets and cannot bypass confirmation for paid execution.

## Version and parity proof

Every operation has one contract test vector executed against the handler and each shipped adapter. Parity covers success, validation, authorization, conflict, expiry, idempotent replay, rate limit, provider ambiguity, and safe error details. Generated OpenAPI and MCP catalogs must match registered handlers before merge.
