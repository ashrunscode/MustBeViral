# Collaboration Wrangler dry-run — WP-P3-003

Recorded: 2026-09-02  
Wrangler: repository-pinned 4.110.0

## Staging

Command:

`pnpm exec wrangler deploy --config apps/collaboration/wrangler.jsonc --env staging --dry-run --outdir apps/collaboration/dist/staging --x-provision=false --x-auto-create=false`

Result: passed. Wrangler reported `env.CANVAS_COORDINATION
(CanvasCoordination)` and the three expected non-secret variables, including
`APP_ENV=staging`. It emitted no environment-inheritance warning.

## Production configuration validation

Command:

`pnpm exec wrangler deploy --config apps/collaboration/wrangler.jsonc --env production --dry-run --outdir apps/collaboration/dist/production --x-provision=false --x-auto-create=false`

Result: passed. Wrangler reported `env.CANVAS_COORDINATION
(CanvasCoordination)` and the two expected non-secret service variables. It
emitted no environment-inheritance warning. This was a dry-run only; no
production Worker was created or deployed.
