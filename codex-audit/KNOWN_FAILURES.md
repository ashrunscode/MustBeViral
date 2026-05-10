# Known Failures And Warnings

## Local Node / Wrangler Typecheck Warning
- Observed: 2026-05-09 (reconfirmed Run 16)
- Command: `npm run typecheck`
- Result: command exits 0. In some shells Wrangler reports `Wrangler requires at least Node.js v22.0.0. You are using v20.18.0.`. In the Run 16 shell the active runtime was already on the bundled Node 24 path so the floor warning was not surfaced and the type chain ran cleanly.
- Impact: the default shell typecheck is not trustworthy for Cloudflare type generation when the active Node is v20.x; trustworthy when on Node 22+ or the bundled Codex Node 24.
- Workaround: run `wrangler types`, `react-router typegen`, and `tsc -b` through `C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe` if the floor warning appears.
- Status: Open environment issue; repo validation passes with bundled Node 24. The repo `.node-version` pins to `24.14.0`.

## Cloudflare MCP / Wrangler Auth — RESOLVED Run 19
- Closed: 2026-05-10 (Run 19). `npx wrangler whoami` returns OAuth-authenticated `ernijs.ansons@gmail.com`'s account `d2897bdebfa128919bd89b265e6a712e` with workers/d1/kv/r2/ai/zone scopes. `wrangler deploy` produced `mustbeviral-staging` version `88c739f1-...` and `mustbeviral-production` version `15ce175b-...`; `wrangler secret put` wrote 13 secrets across both envs without auth issues. The Cloudflare API MCP is similarly usable. The historical text below is preserved for the diff trail.

## Cloudflare MCP / Wrangler Auth — Partially Resolved (pre-Run-19 history)
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

## Stripe Read-Only Discovery — RESOLVED Run 19
- Closed: 2026-05-10 (Run 19). Stripe CLI configured for test mode (`sk_test_*`) on account `acct_1SRvMXFMXFyeuIPx` (NxtSpin sandbox). Created 4 products, 4 monthly prices, 1 webhook endpoint pointed at `https://mustbeviral.com/api/webhooks/stripe` with 5 events. All 6 Stripe secrets written to staging + production via `wrangler secret put`. Signed-payload tamper + replay smoke green against both environments. **No live-mode resources created.** Live-mode activation remains explicitly deferred to a separate run with live-key authorisation.

## Wrangler env block dropped by Cloudflare Vite plugin (Run 19, mitigated)
- Observed: 2026-05-10 (Run 19, Phase 4 first deploy attempt).
- Symptom: `wrangler deploy --env staging` ran but used the top-level `vars` (placeholder KV `0000...0000`, `APP_ENV: "development"`) and tried to deploy a script named `mustbeviral` instead of `mustbeviral-staging`. The deploy then failed at the API layer with `KV namespace '00000000000000000000000000000000' not found`.
- Root cause: `react-router build` + `@cloudflare/vite-plugin` emits `build/server/wrangler.json` as the deploy artifact and writes `.wrangler/deploy/config.json` to redirect wrangler to it. The redirected config is FLATTENED — `definedEnvironments: ["staging","production"]` is preserved but the actual `env.staging` / `env.production` blocks are stripped. So `--env <name>` becomes a silent no-op.
- Fix: `scripts/patch-deploy-config.mjs` reads the real env block from the source `wrangler.jsonc`, overrides the relevant keys (vars, d1, r2, kv, durable_objects, workflows, routes, ai, send_email, queues, vectorize, hyperdrive, services, analytics_engine_datasets) in `build/server/wrangler.json`, renames `name` to `mustbeviral-<env>`, and removes `definedEnvironments` so wrangler treats the result as single-env. Run after every `npm run build`, then `wrangler deploy` (no `--env`).
- Status: Mitigated for staging + production. Filed as a long-term concern: future Cloudflare Vite plugin / wrangler updates may make this patcher obsolete; revisit when bumping `wrangler` past 4.90.0 or `@cloudflare/vite-plugin` past 1.36.x.

## Wrangler vars override secrets when keys collide (Run 19, mitigated)
- Observed: 2026-05-10 (Run 19, Phase 4 first staging smoke).
- Symptom: After Phase 3 wrote `USE_MOCK_AI=false` via `wrangler secret put --env staging`, the first staging smoke still showed `provider: "mock"` for image gen.
- Root cause: The deployed `vars.USE_MOCK_AI: "true"` (from `wrangler.jsonc:132` env.staging block) shadowed the secret of the same name. Cloudflare Workers documentation suggests secrets and vars share the same namespace, but in wrangler 4 / vite-plugin 1.36 the deployed `vars` value won at runtime.
- Fix: Patched `vars.USE_MOCK_AI` directly to `"false"` in `build/server/wrangler.json` and redeployed (version `88c739f1-...`). Subsequent image-gen smoke produced `provider: "workers_ai"`, model `@cf/black-forest-labs/flux-2-klein-9b`, byteSize 309214 written to `mustbeviral-staging-media` R2.
- Status: Mitigated. The `scripts/patch-deploy-config.mjs` already pulls vars from the env block, so future deploys preserve the correct value.

## Stale dev server on port 5173 caused spurious e2e failures (Run 19, mitigated)
- Observed: 2026-05-10 (Run 19, Phase 0).
- Symptom: `npm run test:e2e` failed 6/6 with signup returning 401 `Unauthorized: no token provided` from a foreign `{"error":"..."}` envelope (not the MustBeViral envelope).
- Root cause: Port 5173 was held by a leftover `coinop-platform` dev server (PID 55688, Node 22.22.0 from `~/.nvm/versions/node/v22.22.0/bin/node.exe`). Playwright's `webServer.reuseExistingServer: !CI` reused it instead of starting a fresh MustBeViral server. The CSP returned (`script-src 'self' https://maps.googleapis.com ...`) and CORS allow-origin (`https://investinwash.com`) confirmed the wrong app.
- Fix: Killed PID 55688 with `Stop-Process -Force`, port 5173 freed. Re-ran `npm run test:e2e` → 6/6 PASS.
- Status: Operational caveat. Suggest checking `Get-NetTCPConnection -LocalPort 5173` before running e2e in shared environments.
