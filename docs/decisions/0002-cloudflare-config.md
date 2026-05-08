# 0002 Cloudflare Config

Date: 2026-05-07

## Status

Accepted for the local build foundation.

## Decision

Use `wrangler.jsonc` with Cloudflare-native bindings for the Phase 1 architecture:

- Worker entrypoint: `src/server/index.ts`
- D1: `DB`
- R2: `MEDIA_BUCKET`
- KV: `CACHE`
- Workers AI: `AI`
- Browser Rendering: `BROWSER`, behind a feature flag and safe service boundary
- Durable Objects: `MarketingAgent`, `MustBeViralMCP`
- Workflows: seven product workflows
- Queue: `POST_PUBLISH_QUEUE`
- Static assets: `ASSETS`

## Deferred

- `worker_loaders`
- `ANALYTICS_INGEST_QUEUE`
- `Vectorize`

## Safety Notes

Resource IDs use syntactically valid local placeholders so `wrangler types`, typecheck, and build can run before Cloudflare provisioning. These values are not deployable production IDs. `scripts/cf-bootstrap.ts` must patch real D1/KV IDs before staging or production deploys. Production scheduler defaults to `manual`; Vista Social and Buffer stay disabled until verified.
