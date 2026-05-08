# Cloudflare Build Strategy

## Foundation

Use `react-router-hono-fullstack-template` as the base. Use `agents-starter`, Workflows examples, R2 examples, D1 examples, and OpenAuth/session templates only as references.

## Bindings

Keep:
- `ASSETS`
- `DB`
- `MEDIA_BUCKET`
- `CACHE`
- `AI`
- `BROWSER` behind a verified service/fallback boundary
- `MARKETING_AGENT`
- `MUSTBEVIRAL_MCP`
- seven Workflow bindings
- `POST_PUBLISH_QUEUE` only when used

Defer or remove:
- `worker_loaders`
- `ANALYTICS_INGEST_QUEUE`
- `Vectorize`

## Config Rules

- `compatibility_date` is pinned and never decreased.
- `nodejs_compat` is enabled because Stripe and supporting libraries may need it.
- Production scheduler default remains `manual` until a provider is verified.
- Placeholders are allowed locally only when documented and not required for build.
- `scripts/cf-bootstrap.ts` must be dry-run capable and idempotent.
