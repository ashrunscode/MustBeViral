# Final API Strategy

## Conventions

- Hono routes under `/api`.
- Standard success response: `{ "success": true, "data": ..., "meta": ... }`.
- Standard error response: `{ "success": false, "error": { "code", "message", "details", "requestId" } }`.
- Zod validation at every boundary.
- Auth required by default except health, signup, login, public assets, and Stripe webhook.
- Workspace and brand RBAC required for scoped routes.

## Route Groups

- `/api/health`
- `/api/auth/*`
- `/api/workspaces/*`
- `/api/brands/*`
- `/api/posts/*`
- `/api/assets/*`
- `/api/billing/*`
- `/api/webhooks/stripe`
- `/api/admin/*`
- `/mcp/*` read-only and admin-gated

## Webhooks

Stripe webhook must bypass JSON parsing, read raw body, verify signature, and insert into `webhooks_inbox` before side effects.
