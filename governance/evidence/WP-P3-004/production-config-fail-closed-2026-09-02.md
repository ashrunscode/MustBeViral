# Production configuration fails closed — WP-P3-004

Recorded: 2026-09-02

## Corrections

- Removed the unresolved `api.mustbeviral.com` custom-domain route from the
  production Core configuration.
- Removed the fake all-zero production Hyperdrive ID. Hyperdrive remains
  disallowed because WP-P3-002 deferred G1-G6 and Supabase Data API/RPC remains
  the user path.
- Kept the intended V2 production names while leaving Core production
  unrouted and undeployed.
- Added `governance/tests/production-release-config-gate.test.mjs` to detect
  placeholder IDs, an ungoverned route, ungated Hyperdrive, and legacy resource
  names in either production Worker configuration.

## Verification

- `node --test governance/tests/production-release-config-gate.test.mjs` — 2 passed.
- `pnpm --filter @mustbeviral/core typecheck` — passed; generated Worker types are current.
- Production Wrangler dry-run used `--x-provision=false --x-auto-create=false` and exited without
  remote mutation. It exposed only the intended missing V2 R2 binding and service metadata.

The dry-run still reports the known top-level development Hyperdrive
non-inheritance warning. The production environment has no Hyperdrive binding;
the regression test locks that intentional absence.
