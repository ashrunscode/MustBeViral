# 19 — Release Go / No-Go (current, post-Run-18)

> Source of truth as of 2026-05-10 after Runs 1-18. The original baseline verdicts are archived at `codex-audit/_archive/19_RELEASE_GO_NO_GO_baseline_2026-05-08.md`.

## Verdicts

| Audience | Verdict | Reason |
|---|---|---|
| **Local development** | ✅ **GO** | All gates green: typecheck, lint, test (12 files / 46 unit tests), build, npm audit (0 vulns), e2e (6/6 desktop Chromium + mobile WebKit), diff hygiene |
| **Staging** | ⚠️ **CONDITIONAL GO** | Run 18 — staging D1/KV/R2 provisioned via API MCP and `wrangler.jsonc` patched with real IDs (D1 uuid `04b2303a-d7b1-4773-8fd7-cb44bbff88cb`, KV `158d36f839a54e5baac85bdcbcff8555`, R2 `mustbeviral-staging-media`). Migrations applied (38 tables / 39 indexes). Local gate green after binding patch. **Remaining:** explicit deploy approval to ship the Worker to `staging.mustbeviral.com` (requires Wrangler CLI auth — user-side action). After deploy: staging smoke checklist from `DEPLOYMENT_RUNBOOK.md` |
| **Production (no new code)** | ⚠️ **CONDITIONAL GO** | Local code is safe and locked behind tests: C-1 patched, security headers + CSRF live, plan caps enforced, Stripe webhook + replay/tamper proven, mock-safe AI/scheduler. Production Cloudflare resources verified live via API MCP in Run 17: D1 `mustbeviral-production`, KV `mustbeviral-production-cache`, R2 `mustbeviral-production-media` (ENAM). **Remaining blocker:** explicit user approval to redeploy the current dirty worktree. The earlier Milestone 8 deploy is historic; current code has not been redeployed |
| **Live Stripe (paid plans)** | ⚠️ **CONDITIONAL GO (operational gates only)** | All code prerequisites are now met: webhook event handlers (C-4), plan-cap enforcement (H-11), local Stripe replay/tamper proof, signed-event → plan-cap transitions (Run 15). Remaining gates are operational, listed below |
| **Closed beta (≤10 hand-held users via browser)** | ⚠️ **CONDITIONAL GO** | UI is now real-data for the current MVP page set (auth, workspaces, brand operations, approvals, media, billing, DM rules, reports, growth, admin) and proven on desktop + mobile WebKit. Remaining concern is real image generation still mock (H-2) and external AI providers mock-fallback by default (C-3) — both acceptable for hand-held beta if disclosed |
| **Paying customers (self-serve, browser-only)** | ⚠️ **CONDITIONAL GO** | Real image generation (H-2) is wired in code (Run 17 confirmation): real `step.do` Workers AI Flux invocation, R2 upload to `creatives/<brandId>/<creativeId>.png`, media proxy with brand-access check. Activates as soon as the production Worker has `USE_MOCK_AI=false` and the `AI` binding (already in `wrangler.jsonc` production env). External AI text providers (Kimi/Anthropic/OpenAI via Gateway) still require real account vars + secrets + staging smoke. Stripe test-mode end-to-end smoke still required before flipping live keys |
| **Public marketing launch** | ❌ **NO-GO** | All of the above + observability (M-16) + final runbook signoff + production smoke after explicit deploy |

## Required next gates (in order)

1. **Commit + push the Run 1-17 dirty worktree** — currently only Milestone 8 historic commit exists on `origin/master`. The 40 modified + 22 untracked files (security headers, CSRF middleware, rate limit, AI Gateway, Stripe events, entitlements, real workflows, integration tests, audit docs) need to be committed before any deploy. Single user-side instruction.
2. **Wrangler CLI auth restoration** — interactive `wrangler login` or `CLOUDFLARE_API_TOKEN` env. Required before `wrangler deploy` for staging or production redeploy. Cloudflare API MCP is already authenticated for resource ops but does not deploy Workers.
3. **Configure `KIMI_API_KEY` + `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID`** via `wrangler secret put --env staging` and `--env production`. Per user instruction: only Kimi is mandated; OpenAI and Anthropic keys are deferred. Code path falls back to mock-safe when keys are absent.
4. **Deploy staging** — `wrangler deploy --env staging` after #2. Then smoke checklist from `docs/system-dna/DEPLOYMENT_RUNBOOK.md`.
5. **Stripe test-mode setup** — Stripe MCP/CLI is **not present** in this shell despite earlier mention. Will require user to either install Stripe CLI / connect Stripe MCP, or provide test product/price IDs + secret values to be written via `wrangler secret put`.
6. **Sprint E (M-16)** — Observability dashboards + Sentry/structured logs + final runbook signoff.
7. **Sprint H** — Production redeploy with the Run-17 worktree, post-deploy smoke, `SHIP_LOG.md`. Existing Milestone 8 production worker remains live; current code is a forward of that.

Closed in code: image generation (H-2), workflows (C-2), HTTP integration suite (C-6), agent surface (H-1), CSRF (CSRF-1), MVP UI route set (C-5), staging Cloudflare provisioning (M-17), CI workflow + Git remote (H-4).

## Stripe live activation specifically

Per the 2026-05-08 DECISIONS_LOG entry "Stripe Live Activation Gate": both technical prerequisites are now met (C-4 + H-11 closed; signed-event → plan-cap transitions proven in Run 15). Remaining gates (operational, not code):

- [x] Integration test suite covers plan-cap and Stripe replay paths; test count pinned at 12 files / 46 tests (Run 15).
- [ ] Configure `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` via `wrangler secret put --env production` (requires explicit user confirmation).
- [ ] Register webhook endpoint `https://mustbeviral.com/api/webhooks/stripe` in Stripe Dashboard for events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`. Match the signing secret to `STRIPE_WEBHOOK_SECRET`.
- [ ] Stripe test-mode end-to-end purchase from a test workspace; verify subscription row advances and entitlement enforcement reacts.
- [ ] Then flip to live mode.

**Until those operational gates are checked, do not flip live secrets autonomously.**

## Recommendation

Local code is sellable for a hand-held closed beta. **Hold self-serve paying-customer launch** until (a) Cloudflare auth restored + R2 verified, (b) Prompt 18 ships real image generation, (c) external AI provider activation completes a staging smoke, (d) Stripe test-mode checkout smoke passes. Production deploy is **CONDITIONAL GO** behind explicit user approval — current code is safe but the dirty worktree has not been redeployed since Milestone 8.

`shipped: pending`.
