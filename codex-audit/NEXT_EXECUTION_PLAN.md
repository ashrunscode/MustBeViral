# MustBeViral Next Execution Plan

## Ordered Task List
1. Get explicit user confirmation before any Cloudflare resource mutation, then create or verify the missing R2/staging resources.
2. Patch `wrangler.jsonc` staging IDs only after real staging D1/KV/R2 resources are confirmed.
3. Run `wrangler types` after any binding change and rerun the full local/CI gate.
4. Re-authenticate Cloudflare tooling or provide an approved Cloudflare API token, then rerun `npm run cf:readiness`.
5. Prepare Stripe test-mode product/price setup only after explicit user confirmation for Stripe writes and secret storage.
6. Add staging smoke scripts after staging resources exist.
7. Add external observability dashboards/runbooks after staging smoke.

## Files To Inspect
- `wrangler.jsonc`
- `worker-configuration.d.ts`
- `.github/workflows/validate.yml`
- `scripts/cloudflare-readiness.ts`
- `docs/system-dna/DEPLOYMENT_RUNBOOK.md`
- `docs/system-dna/SECURITY_CHECKLIST.md`
- `docs/system-dna/TEST_PLAN.md`
- `src/server/routes/billing.ts`
- `src/server/services/stripe/events.ts`
- `codex-audit/KNOWN_FAILURES.md`

## Files To Edit Next
- `wrangler.jsonc` only after confirmed Cloudflare resource IDs exist
- `worker-configuration.d.ts` only via `wrangler types` after binding changes
- Stripe config/docs only after user confirms Stripe test-mode setup
- staging smoke scripts after staging bindings exist
- observability docs once dashboards/providers are selected

## Acceptance Criteria
- Wrangler read-only discovery confirms D1, KV, and R2 resources for staging and production.
- `mustbeviral-production-media` either exists or config is corrected to a verified bucket.
- Cloudflare API MCP auth issue is either fixed or documented as non-blocking because Wrangler read-only fallback is proven.
- CI workflow remains no-deploy and mirrors the local gate.
- Stripe remains disabled unless test secrets and price IDs are intentionally configured.
- No remote D1 migration, deploy, push, secret write, Cloudflare resource creation, or Stripe live activation occurs without separate explicit confirmation.
- Production remains `shipped: pending`.

## Validation Commands
- Exact local typecheck for warning capture:
  `npm run typecheck`
- Read-only Cloudflare readiness:
  `npm run cf:readiness`
- Bundled Node 24 typecheck:
  `C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules\wrangler\bin\wrangler.js types`
  `C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules\@react-router\dev\bin.js typegen`
  `C:\Users\ernij\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe node_modules\typescript\bin\tsc -b`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm audit --audit-level=high`
- `npm run test:e2e:list`
- `npm run test:e2e`
- `git diff --check`

## Rollback / Safety Notes
- Do not revert unrelated dirty worktree changes.
- If Worker typegen rewrites `worker-configuration.d.ts`, keep it only when it matches `wrangler.jsonc`.
- Keep Stripe disabled unless the user explicitly confirms secret writes.
- Keep staging/prod provisioning blocked until explicit confirmation.
- Do not replace manual export with direct social publishing.
- Do not add unsafe browser-bot DM automation.

## Exact Next Command
Commit the Run 1-17 dirty worktree (40 modified + 22 untracked files spanning security headers, CSRF middleware, rate limit, AI Gateway, Stripe events, entitlements, real workflows, HTTP integration tests, audit docs) under a descriptive message and push to `origin/master`. After that, restore Wrangler CLI auth (interactive `wrangler login` in your terminal, or `CLOUDFLARE_API_TOKEN=...` env), then `wrangler deploy --env staging` to ship the Worker to `staging.mustbeviral.com`.

Closed Run 18:
- Staging D1/KV/R2 provisioned via Cloudflare API MCP, migrations 0001+0002 applied (38 tables / 39 indexes), `wrangler.jsonc` staging block patched, full local gate revalidated.
- GitHub repo `ernijsansons/MustBeViral` (private) created and `master` pushed (currently the historic Milestone 8 commit).

Remaining tasks (all gated on user-side action or further explicit authorisation):
- **Commit + push Run 1-17 worktree** — needs explicit `commit and push` instruction from user. Without this, `origin/master` only reflects Milestone 8.
- **Wrangler CLI auth** — interactive `wrangler login` or `CLOUDFLARE_API_TOKEN` env. Required for any `wrangler deploy`.
- **Configure `KIMI_API_KEY` + `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID`** — `wrangler secret put` writes to staging and production. Per user instruction: only Kimi is mandated; OpenAI and Anthropic deferred.
- **Deploy staging** — `wrangler deploy --env staging` after secrets + CLI auth.
- **Staging smoke** — full checklist from `docs/system-dna/DEPLOYMENT_RUNBOOK.md`.
- **Stripe test-mode setup** — Stripe MCP/CLI not detected in this shell. Either install Stripe CLI / connect Stripe MCP, or have the user create products/prices via the Stripe Dashboard and provide the IDs.
- **Production redeploy** — `wrangler deploy --env production` of the Run-17 worktree, after staging smoke green and explicit user approval.
- **Observability** — Sentry/structured logs/dashboards (M-16) — provider selection needed.
