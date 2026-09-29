# Collaboration environment binding parity — WP-P3-003

Recorded: 2026-09-02  
Branch: `codex/viralgraph-cleanroom`

## Change

`apps/collaboration/wrangler.jsonc` now declares the
`CANVAS_COORDINATION` Durable Object binding with class
`CanvasCoordination` in the default, staging, and production configurations.
The class migration remains top-level and unchanged.

`governance/tests/collaboration-environment-bindings.test.mjs` locks the three
exact Worker names, binding parity, staging `workers_dev` containment, and the
absence of custom routes.

## Verification

- `node --test governance/tests/collaboration-environment-bindings.test.mjs` — 2 passed.
- `pnpm --filter @mustbeviral/collaboration-worker test` — 13 passed.
- `pnpm --filter @mustbeviral/collaboration-worker typecheck` — passed.
- `pnpm --filter @mustbeviral/collaboration-worker types:generate` — generated a required,
  non-optional `CANVAS_COORDINATION` binding for the base, staging, and production environments.

No route, client connection, production deployment, or legacy dependency was
added by this change.
