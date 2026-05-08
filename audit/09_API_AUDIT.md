# 09_API_AUDIT.md

## Route Group Audit

| Route Group | Status | Auth | RBAC | Validation | Tests | Problems |
|---|---|---:|---:|---:|---:|---|
| auth (signup/login/logout/me) | spec only | n/a | n/a | spec'd Zod | none | No password storage column; no session table; no CSRF; no OAuth flow |
| workspaces | spec only | required | required | spec'd Zod | none | No invitation/membership routes spec'd |
| workspace_members | missing | n/a | n/a | n/a | none | Spec implies but doesn't define endpoints |
| brands | spec only | required | required | spec'd Zod | none | Soft delete query convention undefined |
| agents (call into MarketingAgent) | spec only | required | required | partial | none | Forwarding pattern not documented; per-call user injection missing |
| onboarding | spec only | required | required | spec'd Zod | none | Workflow start payload not typed in spec |
| profile | spec only | required | required | spec'd Zod | none | PATCH semantics for locked fields not defined |
| target-market | implied via brand-intelligence | required | required | n/a | none | No explicit endpoint; reuses `/brand-intelligence` |
| calendar | spec only | required | required | partial | none | "Generate calendar" vs "list calendar" routes both implied; only generate is shown |
| posts | spec only | required | required | partial | none | No pagination convention; no filters validation; status filter values undefined |
| approvals | spec only | required | required | spec'd Zod | none | No batch-approve endpoint though UX demands one |
| media | spec only | required | required | partial | none | Multipart upload constraints undefined (size, MIME) |
| dm-rules | spec only | required | required | spec'd Zod | none | Provider capability not validated server-side |
| analytics | missing endpoints | n/a | n/a | n/a | none | Snapshot ingest route not in spec |
| reports | spec only | required | required | spec'd Zod | none | List + detail endpoints not enumerated |
| growth | spec only | required | required | spec'd Zod | none | List + create-campaign action shown; mark-as-done missing |
| scheduler | implied | n/a | n/a | n/a | none | No public route — all scheduling goes through approve-then-schedule path |
| billing | missing endpoints | n/a | n/a | n/a | none | Stripe checkout-session create / portal / webhook routes absent |
| admin | spec only | required | admin only | n/a | none | `/api/admin/overview` only; failed-job retry not in spec |
| mcp | spec only | n/a (?) | n/a | n/a | none | Auth strategy for `/mcp` undefined |

## Missing API Routes

These are required by the product but not in `API_CONTRACTS.md`:

```
# auth
POST   /api/auth/login                  { email, password }
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/auth/oauth/:provider/start  // if OAuth chosen
GET    /api/auth/oauth/:provider/callback

# workspaces & members
GET    /api/workspaces
GET    /api/workspaces/:id
PATCH  /api/workspaces/:id
DELETE /api/workspaces/:id              // soft if applicable
GET    /api/workspaces/:id/members
POST   /api/workspaces/:id/invitations  { email, role }
POST   /api/invitations/:token/accept
DELETE /api/workspaces/:id/members/:userId

# brands
GET    /api/workspaces/:id/brands
GET    /api/brands/:brandId
PATCH  /api/brands/:brandId
DELETE /api/brands/:brandId             // soft

# agent realtime
GET    /api/brands/:brandId/agent       // upgrade to WebSocket

# onboarding
GET    /api/brands/:brandId/onboarding/status

# profile
GET    /api/brands/:brandId/profile/versions
POST   /api/brands/:brandId/profile/regenerate-field { fieldPath }

# calendar / posts
GET    /api/brands/:brandId/calendar
GET    /api/brands/:brandId/calendar/:calendarId
POST   /api/brands/:brandId/posts/batch-approve { postIds }
POST   /api/brands/:brandId/posts/batch-reject  { postIds, reason }
POST   /api/brands/:brandId/posts/:postId/lock-fields { fieldPaths }

# media
GET    /api/brands/:brandId/assets
GET    /api/assets/:assetId             // signed URL fetch
DELETE /api/assets/:assetId

# scheduling
GET    /api/brands/:brandId/scheduled
POST   /api/scheduled/:id/retry         // admin
POST   /api/scheduled/:id/cancel

# DM
GET    /api/brands/:brandId/dm-rules
PATCH  /api/brands/:brandId/dm-rules/:id
DELETE /api/brands/:brandId/dm-rules/:id
GET    /api/brands/:brandId/dm-events

# analytics
POST   /api/brands/:brandId/analytics/ingest          // queue producer
GET    /api/brands/:brandId/analytics/summary

# reports
GET    /api/brands/:brandId/reports
GET    /api/reports/:id
GET    /api/reports/:id/pdf            // signed R2 URL

# growth
GET    /api/brands/:brandId/growth-opportunities
PATCH  /api/growth-opportunities/:id   // status updates

# billing
POST   /api/billing/checkout-session   // returns Stripe session URL
POST   /api/billing/portal             // returns Stripe portal URL
POST   /api/webhooks/stripe            // signature-verified

# admin
GET    /api/admin/overview
GET    /api/admin/workflows
POST   /api/admin/workflows/:id/retry
GET    /api/admin/agent-runs
GET    /api/admin/usage
GET    /api/admin/audit-logs

# health
GET    /api/health
GET    /api/version
```

## Unsafe API Routes

Currently no routes exist, so risk is hypothetical, but these are the high-risk endpoints to design carefully:

| Endpoint | Risk | Mitigation |
|---|---|---|
| `POST /api/brands` | Triggers onboarding workflow → external scans → cost | Rate-limit per workspace; validate URL is public, http(s), not private IP; cost-guard |
| `POST /api/brands/:brandId/assets/upload` | Multipart upload to R2 | Enforce MIME allow-list, max size, virus scanning hook |
| `POST /api/brands/:brandId/assets/generate-image` | Workers AI cost | Cost-guard + per-brand daily image cap |
| `POST /api/posts/:postId/schedule` | Publishes to social provider | Re-verify post is `approved`; check brand autonomy; check provider config |
| `POST /api/brands/:brandId/dm-rules` | DM automation | Default `requires_approval=1`; no auto-publish to platform |
| `POST /api/webhooks/stripe` | Privileged subscription state mutation | Raw body HMAC verification; idempotency via `webhooks_inbox` |
| `GET /api/admin/*` | Privileged | `requireAdmin()` middleware; audit_log on every call |
| `/mcp` | Read access to brand data | Admin-only; no mutating tools |

## Response Shape Problems

Spec defines a clean `{ success, data | error }` envelope. Issues:

1. **No standard error code list.** Define an enum: `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `COST_LIMIT`, `PROVIDER_ERROR`, `WORKFLOW_FAILED`, `INTERNAL`. Map HTTP status codes consistently.
2. **No pagination shape.** Adopt: `{ data: T[], pageInfo: { nextCursor: string | null, total?: number } }`.
3. **No `traceId` in responses.** Add `meta.traceId` so users can report errors with a copyable identifier.
4. **No content-type guarantee.** Hono's default JSON behavior is fine, but Stripe webhook handler MUST receive raw body; ensure that route bypasses any global JSON middleware.

## Required API Refactor Plan

(Refactor of *spec*, not code, since no code exists.)

1. **Adopt OpenAPI 3.1** as the API contract source of truth. Use `chanfana` (recommended in `CLOUDFLARE_TEMPLATES_AUDIT.md`) or generate OpenAPI from Zod via `zod-to-openapi`. Either way, drift between docs and code is unacceptable.
2. **Centralize error handling** in a single Hono `app.onError` and `app.notFound`. Always emit the standard envelope.
3. **Centralize auth** in middleware: `auth()` populates `c.var.user`; downstream handlers read it.
4. **Centralize RBAC** in `requireWorkspaceMember(workspaceId)` and `requireBrandAccess(brandId)`. These accept the route param and the authenticated user, look up `workspace_members`, fail fast on miss.
5. **Centralize Zod validation** with `@hono/zod-validator`.
6. **Centralize idempotency** via middleware that checks `Idempotency-Key` header against `idempotency_keys` table and returns the prior response if present.
7. **Centralize audit logging** via middleware that writes audit_log on mutating routes (POST/PATCH/DELETE).
8. **Centralize cost guard** via middleware on AI-touching routes.
9. **Centralize rate limiting** via middleware backed by KV or DO.
10. **Document HTTP semantics**:
    - 200 for success
    - 201 for resource creation
    - 202 for accepted-and-running (workflow start)
    - 204 for empty success (rare here)
    - 400 invalid input, 401 unauthenticated, 403 forbidden, 404 not found
    - 409 conflict (slug collision), 422 unprocessable (state machine violation)
    - 429 rate limit, 451 cost limit, 500 internal, 502/504 provider error
