# MustBeViral Next Execution Plan (post-Run-20)

## Ordered Task List

After Run 20 the production worker is on the Run 1-17 hardened code, Stripe test mode end-to-end is proven, and admin RBAC is verified positive + negative. The remaining work is observability and optional polish:

1. **Observability (M-16).** Pick a provider (Sentry / Logflare / Cloudflare Workers Observability dashboards). Write the secret via `wrangler secret put`. Wire exception forwarding in `src/server/index.ts` global error handler. Add `docs/system-dna/OBSERVABILITY_RUNBOOK.md` for alert response. ← **ONLY remaining blocker for public marketing launch.**
2. ✅ ~~Real test-mode Stripe Checkout end-to-end~~ — closed in Run 20.
3. ✅ ~~Seed an admin user~~ — closed in Run 20 (`admin+ops@mustbeviral.com` promoted to `role=admin` in production D1; admin-positive smoke green).
4. **`staging.mustbeviral.com` DNS** (optional). Add a CNAME (proxied) so the staging hostname resolves without `curl --resolve`. Token currently has only `zone (read)`; needs user-side dashboard edit or a new `dns_records (write)` token.
5. **Live Stripe activation.** Separate run with live-key authorisation — flip `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `sk_live_*` / `whsec_*` from a live webhook endpoint, create live products + prices, run signed-payload smoke against the live worker, then run a real test card.
6. **Public marketing launch checklist.** After (1) ships: final security/runbook signoff, confirm DNS propagation, confirm worker version IDs in monitoring, optional canary rollout via Cloudflare's deployment versions.
7. **Polish — optional real-card Checkout.** Open the Stripe Checkout URL in a browser, pay with `4242 4242 4242 4242`, verify Stripe propagates `customer.subscription.created` with real `cus_*` and `sub_*` IDs. The synthetic trigger event used in Run 20 left those columns NULL because it doesn't reference a real customer. Functionally adequate for the dispatcher path; cosmetically nicer to have non-NULL columns.
8. **Commit + push the Run 20 doc edits to `origin/master`** — the Run 20 changes are doc-only and live in the worktree until you say "commit and push".

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
