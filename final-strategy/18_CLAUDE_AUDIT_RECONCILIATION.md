# Claude Audit Reconciliation

## Accepted Findings

- Current codebase is none / greenfield.
- Use Cloudflare `react-router-hono-fullstack-template`.
- Auth is undefined and must be decided first.
- Kimi is external, not Workers AI.
- FLUX model IDs must not be hardcoded as required.
- SSRF guard and prompt-injection sanitizer are P0.
- Stripe webhook signature verification is P0.
- SchedulerProvider is missing and must be locked early.
- MarketingAgent and workflows are currently only spec intent.

## Applied Changes To Plan

- Custom D1-backed auth is chosen.
- Production scheduler remains manual until provider verification.
- Browser Run is behind a service boundary and safe fetch fallback.
- Vectorize is deferred.
- Analytics ingest queue is deferred.
- Worker loaders are removed from MVP config.

## Remaining Audit-Driven Risks

- Need current package/template validation.
- Need Workers-compatible auth hashing verification.
- Need generated Wrangler types after config exists.
- Need real Cloudflare resource IDs before any deploy.
