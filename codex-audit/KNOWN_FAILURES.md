# Known Failures And Warnings

## Local Node / Wrangler Typecheck Warning
- Observed: 2026-05-09 (reconfirmed Run 16)
- Command: `npm run typecheck`
- Result: command exits 0. In some shells Wrangler reports `Wrangler requires at least Node.js v22.0.0. You are using v20.18.0.`. In the Run 16 shell the active runtime was already on the bundled Node 24 path so the floor warning was not surfaced and the type chain ran cleanly.
- Impact: the default shell typecheck is not trustworthy for Cloudflare type generation when the active Node is v20.x; trustworthy when on Node 22+ or the bundled Codex Node 24.
- Workaround: run `wrangler types`, `react-router typegen`, and `tsc -b` through `C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` if the floor warning appears.
- Status: Open environment issue; repo validation passes with bundled Node 24. The repo `.node-version` pins to `24.14.0`.

## Cloudflare MCP / Wrangler Auth — Partially Resolved
- Observed: 2026-05-09 (reconfirmed Run 17, Run 18 used MCP for resource creation + migration apply)
- Commands/tools:
  - Cloudflare API MCP (`mcp__baade926-..._accounts_list`, `_d1_databases_list`, `_kv_namespace_get`, `_r2_bucket_get`)
  - `npm run cf:readiness`
  - bundled Node 24 `wrangler whoami`
- Result:
  - **Run 17 (NEW): Cloudflare API MCP is now authenticated.** Account `d2897bdebfa128919bd89b265e6a712e` confirmed via `accounts_list`. Production resources verified read-only:
    - D1 `mustbeviral-production` (`b9a428e0-038a-4df7-a59d-3a5ddde54550`) ✅
    - KV `mustbeviral-production-cache` (`ff374abd8ca141e8af086afb593e8a8a`) ✅
    - R2 `mustbeviral-production-media` (creation 2026-05-08T04:07:40Z, ENAM, Standard) ✅ — supersedes the Run 14 false-negative "no matching bucket".
    - **Run 18 (NEW): staging Cloudflare resources now provisioned via API MCP.** D1 `mustbeviral-staging` (`04b2303a-d7b1-4773-8fd7-cb44bbff88cb`, ENAM), KV `mustbeviral-staging-cache` (`158d36f839a54e5baac85bdcbcff8555`), R2 `mustbeviral-staging-media` (ENAM, Standard). Migrations 0001 + 0002 applied via MCP `d1_database_query` (multi-statement multi-batch). Verified `sqlite_master` count = 38 tables / 39 indexes.
  - **Wrangler CLI still reports `Not logged in`** in this shell (`Failed to fetch auth token: 400 Bad Request`). `npm run cf:readiness` continues to exit 1 because the inventory script depends on Wrangler CLI auth, not the API MCP.
  - Logs written to `C:\Users\ernij\.wrangler\logs\wrangler-2026-05-09_*.log`.
- Impact: Cloudflare read-only discovery is unblocked at the API layer; production resource verification is now possible without restoring CLI auth. Staging resources remain absent — provisioning is gated on explicit user authorisation. The `cf:readiness` script itself is still red until CLI auth is restored.
- Workaround: For verification, use the Cloudflare API MCP. To unblock `cf:readiness` specifically, restore Wrangler CLI auth via interactive `wrangler login` or provide `CLOUDFLARE_API_TOKEN` env. Do not create R2/staging resources, deploy, or run remote migrations without explicit confirmation.
- Status: Partially resolved. API MCP works; CLI gate is still red; no mutations have been attempted in Runs 14-17.

## Stripe Read-Only Discovery
- Observed: 2026-05-09
- Tool: Stripe MCP read-only list calls.
- Result: customer/subscription lists were empty; existing products/prices are non-MustBeViral products.
- Impact: MustBeViral Stripe test-mode products/prices are not confirmed.
- Workaround: prepare product/price creation plan only; do not create resources or write secrets without explicit user confirmation.
- Status: Open operational setup item.
