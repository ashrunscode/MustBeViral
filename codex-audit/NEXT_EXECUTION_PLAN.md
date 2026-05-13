# MustBeViral Next Execution Plan (post-Run-21)

## Ordered Task List

After Run 21 (Option D dark-deploy build) all four platform adapters are code-ready and deployed to production with every flag at `"false"`. Customer-visible behaviour is unchanged from Run 20. Per-platform launches are now single-secret-flip operations, gated only on platform-side approvals + credentials.

1. **Pick a launch platform.** LinkedIn is the most natural first launch (B2B-aligned, Marketing API approval is the fastest of the four). See `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md` for the per-platform checklist (app approval → webhook URL register → `wrangler secret put <X>_CLIENT_*` → flag flip → real-account smoke).
2. **Observability (M-16).** Pick a provider (Sentry / Logflare / Cloudflare Workers Observability dashboards). Write the secret via `wrangler secret put`. Wire exception forwarding in `src/server/index.ts` global error handler. Add `docs/system-dna/OBSERVABILITY_RUNBOOK.md`. Required for `Public marketing launch` verdict to flip.
3. ✅ ~~Run 21 platform build~~ — closed. 25 files / 178 tests; production deployed at version `2f0e51da-7134-422f-949a-06c55d9b0a11`; all 8 flags `"false"`.
4. ✅ ~~Real test-mode Stripe Checkout end-to-end~~ — closed in Run 20.
5. ✅ ~~Seed an admin user~~ — closed in Run 20.
6. **`staging.mustbeviral.com` DNS** (optional). Add a CNAME (proxied) so the staging hostname resolves without `curl --resolve`. Needs user-side Cloudflare dashboard edit or a token with `dns_records (write)`.
7. **Live Stripe activation.** Separate run with live-key authorisation — flip `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `sk_live_*` / `whsec_*` from a live webhook endpoint, create live products + prices, signed-payload smoke, then real test card.
8. **Polish — optional real-card Checkout.** Open the Stripe Checkout URL in a browser, pay with `4242 4242 4242 4242`, verify `customer.subscription.created` populates `cus_*`/`sub_*` columns (synthetic trigger left them NULL in Run 20).
9. **Public marketing launch.** After (1) + (2): final security/runbook signoff, confirm DNS, monitoring + alerts active, optional canary via Cloudflare deployment versions.

## Exact next command (recommended first move for Run 22)

```bash
# A. Generate the encryption key (one-time, only if not already set)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | wrangler secret put TOKEN_ENCRYPTION_KEY --env staging
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | wrangler secret put TOKEN_ENCRYPTION_KEY --env production

# B. Configure LinkedIn creds (after creating the LinkedIn Developer app and registering both staging + production redirect URIs)
wrangler secret put LINKEDIN_CLIENT_ID --env staging
wrangler secret put LINKEDIN_CLIENT_SECRET --env staging
wrangler secret put LINKEDIN_REDIRECT_URI --env staging      # https://staging.mustbeviral.com/api/oauth/linkedin/callback
wrangler secret put LINKEDIN_WEBHOOK_SECRET --env staging
# (repeat for --env production with the production redirect URI)

# C. Flip LinkedIn flags to "true" on STAGING ONLY
echo "true" | wrangler secret put ENABLE_LINKEDIN_PUBLISH --env staging
echo "true" | wrangler secret put ENABLE_LINKEDIN_INGEST --env staging

# D. Smoke against staging: visit /app/brands/<id>/connections, click Connect LinkedIn, publish + reply
# E. On green: flip the same flags on --env production. Done — LinkedIn live.
```

## Files To Inspect

- `codex-audit/FIX_LOG.md` — full history; Run 19 footer is the latest authoritative state.
- `codex-audit/19_RELEASE_GO_NO_GO.md` — verdicts.
- `codex-audit/DEEP_AUDIT_RUN.md` — `shipped: true`; Run 19 baseline gate.
- `codex-audit/KNOWN_FAILURES.md` — the wrangler env-block patcher caveat (`scripts/patch-deploy-config.mjs`) and the var-vs-secret precedence note.
- `scripts/patch-deploy-config.mjs` — required before every `wrangler deploy`. Until the Cloudflare Vite plugin preserves env blocks in `build/server/wrangler.json`, this patcher is the deploy contract.
- `scripts/smoke.sh` — Phase-4/5 smoke driver; reusable for any future env.
- `final-strategy/BUILD_LOG.md` — Milestone 19 entry.

## Files To Edit Next

For the test-mode Checkout flow:
- `src/server/routes/billing.ts` — already has the checkout-session route; verify the success_url / cancel_url envs are reasonable for test runs.
- Optional: `tests/integration/api-flow.test.ts` — add a Checkout-session-completed test that uses a Stripe test fixture.

For observability (M-16):
- `src/server/index.ts` — wire exception forwarding into the global error handler.
- `wrangler.jsonc` — add observability config block if using Workers Observability dashboards.
- New file `docs/system-dna/OBSERVABILITY_RUNBOOK.md` for alert response.

For admin seed:
- One-shot SQL via `wrangler d1 execute mustbeviral-production --remote --command "..."`. No source change required.

## Acceptance Criteria

- A Stripe Checkout session completed with a test card moves a workspace from `starter` → paid plan; `entitlements.checkBrandCap` lets the user create the plan-allowed number of brands.
- Sentry (or chosen provider) shows a captured event from a deliberate test exception.
- `GET /api/admin/overview` returns 200 for the seeded admin user.
- `wrangler tail` against production worker emits structured logs and recent CF-RAY values are visible in the observability dashboard.

## Validation Commands

After every change:
```
node scripts/patch-deploy-config.mjs <staging|production>
node ./node_modules/wrangler/bin/wrangler.js deploy
STRIPE_WEBHOOK_SECRET=$(jq -r '.WEBHOOK_PROD.secret' < /c/Users/ernij/AppData/Local/Temp/mbv-run19-stripe.json) bash scripts/smoke.sh <env>
```

For DB-only changes:
```
node ./node_modules/wrangler/bin/wrangler.js d1 execute mustbeviral-production --remote --file <migration.sql>
```

## Rollback / Safety Notes

- Cloudflare Workers stores deployment versions; `wrangler rollback <version-id>` reverts production to a prior version. The Milestone 8 worker `2f4ead0c-3d67-4261-8867-53dc43ca5c56` and Run 19 production version `15ce175b-4870-4005-9c83-f042f5831177` are both in the deployments list.
- D1 migrations 0001 + 0002 are additive. No destructive migrations have been applied. Future migrations should keep the `IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN` pattern unless a rollback runbook is in place.
- Do not flip `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` to live mode without explicit user authorisation.
- Do not create live-mode Stripe products/prices/webhooks until live activation is approved.
- Do not remove the existing test-mode Stripe products without deactivating the production webhook endpoint first.

## Exact Next Command

Run a real test-mode Stripe Checkout end-to-end. From the project root, with the Stripe CLI authenticated against `acct_1SRvMXFMXFyeuIPx`:

```
# 1. Create a test workspace and brand via the staging or production worker
# 2. Hit POST /api/billing/checkout-session with workspaceId + plan='growth'
# 3. Open the returned url in a browser, pay with 4242 4242 4242 4242
# 4. Watch wrangler tail for the customer.subscription.created handler
node ./node_modules/wrangler/bin/wrangler.js tail mustbeviral-production --format json | grep -E "stripe|subscription"
```

Closed in Run 19:
- Run 1-17 dirty worktree committed (`e104c0f`) and pushed to `origin/master`.
- Wrangler CLI auth restored.
- Stripe test-mode products + prices + webhook + 6 secrets across both envs.
- Migration 0002 applied to production D1.
- Staging deploy `88c739f1-...` + 21/21 smoke green (real Workers AI Flux PNG in R2).
- Production redeploy `15ce175b-...` (replaced Milestone 8 `2f4ead0c-...`) + 21/21 smoke green.
- AI-3 (Workers AI live), CF-MCP-AUTH (CLI authenticated), Stripe operational gates (test mode).

`shipped: true` for the Run-19 deploy + smoke. Marketing launch remains `pending`.
