# 15 — Production Deployment Safety Audit

## Production configuration verified from `wrangler.jsonc`

| Item | Value | Verdict |
|---|---|---|
| `routes` | `mustbeviral.com/*`, `www.mustbeviral.com/*` (zone `mustbeviral.com`) | ✅ Real |
| `vars.APP_ENV` | `production` | ✅ |
| `vars.PUBLIC_APP_URL` | `https://mustbeviral.com` | ✅ |
| `vars.USE_MOCK_AI` | `false` | ⚠️ Misleading — model router still returns mock strings (see 11_AI_MODEL_COST_AUDIT.md) |
| `vars.USE_BROWSER_RUN` | `false` | ✅ Browser Rendering deferred |
| D1 | `mustbeviral-production` (id `b9a428e0-038a-4df7-a59d-3a5ddde54550`) | ✅ Real |
| KV CACHE | `ff374abd8ca141e8af086afb593e8a8a` | ✅ Real |
| R2 | `mustbeviral-production-media` | ✅ Real |
| Workflows | 7 production-named workflows bound | ✅ All bindings exist (none invoked) |
| DOs | MARKETING_AGENT, MUSTBEVIRAL_MCP | ✅ Bound (MCP DO is dead code) |

## Codex's reported deployment artifact

* **Worker version:** `2f4ead0c-3d67-4261-8867-53dc43ca5c56`
* **Migration:** `0001_initial.sql` applied via `wrangler d1 migrations apply DB --env production --remote`
* **Smoke pass:** Reported on apex and www

This audit did not call live wrangler; the version ID and migration application are unverified by us but are plausible given the configuration.

## Production secrets

Codex's BUILD_LOG Milestone 7 references `wrangler whoami` and a Stripe connector inspection. There is no evidence in the repo that production secrets (`SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`, `KIMI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) have been written. Codex's chat status confirms Stripe live charges are disabled — implying STRIPE keys are not yet set in production.

`SESSION_SECRET`: declared in `Env`, **never used** in code. Sessions use random tokens directly. The secret is dead config. Sessions still work without it.

## What is safe in production today

| Property | Status |
|---|---|
| Routes resolve to Worker | ✅ |
| Database migration applied (per Codex) | ✅ |
| Auth (signup / login / logout) | ✅ Real, secure |
| Multi-brand tenant isolation | ✅ Enforced |
| SSRF guard on website scans | ✅ |
| Prompt-injection guard | ✅ |
| Approval-before-export guard | ✅ |
| Approval-required DM rules | ✅ |
| Live Stripe charges | ❌ Disabled (no keys) — safe |
| Real social posting | ❌ Disabled (Vista/Buffer are stubs) — safe |
| Browser-bot DM automation | ❌ Disabled — safe |
| Admin / MCP routes | ✅ Protected |
| Webhook signature verification | ✅ |

## What is unsafe / risky in production today

| Property | Risk |
|---|---|
| **Hono CVEs unpatched** | Cookie injection, basicAuth timing, prototype pollution, multiple XSS/path-traversal advisories. Affects deployed Worker | **High** |
| **react-router CVEs** | CSRF/XSS in Action processing, ScrollRestoration | High |
| **No CSP/HSTS headers** | Browser-side XSS / downgrade attacks | Medium |
| **No CI/CD** | All deploys are manual from a developer's laptop. No PR review, no test gate before deploy. Fragile | High (operationally) |
| **No Git remote** | Single source of truth is local. Loss of laptop = loss of repo | High |
| **No rollback documented** | `wrangler deployments list` + `--rollback` works but not documented | Medium |
| **Webhook does not process events** | Once Stripe keys are configured, payments will be accepted but subscriptions won't advance | Critical at launch |
| **Image generation never produces an image** | `r2_key` is fictional. UI would 404. Customers see metadata-only | Medium |
| **AI features are mocks** | Production users get hardcoded "Mock cheap_text output for: ..." instead of real AI | High product risk |
| **No real users today** | Production shell is empty; nobody is actually using it | Mitigates UX risk for now |
| **Production observability** | `head_sampling_rate: 1` is fine; no dashboards / alerts wired | Medium |
| **No staging environment** | Cannot test deploy → smoke before production. All testing is local | High |
| **Single migration file** | No rollback path if 0001 contains a bug | Medium |

## Production smoke evidence

The "smoke pass" reported in BUILD_LOG Milestone 8 is a manual HTTP probe by Codex against live URLs. There is **no scripted smoke** in the repo — no `scripts/prod-smoke.ts`, no GitHub Actions workflow, no Playwright config that points at `https://mustbeviral.com`. The smoke is non-reproducible.

## Rollback gaps

| Capability | Present? |
|---|---|
| Worker version rollback (`wrangler deployments`) | Available via CLI; not documented |
| D1 migration rollback | None (no down-migration files) |
| R2 object rollback | N/A (no R2 writes happen) |
| KV state rollback | N/A (no KV writes happen) |
| DO state rollback | None (DO state would persist across Worker version rollback) |

## Immediate production risks

1. **Hono CVE backlog.** Production Worker uses `hono@4.11.1` with at least one cookie-injection CVE (`GHSA-5pq2-9x2x-5p6w`). Affects session cookie path. **Patch before any further Worker deploy.**
2. **No CI/CD + no Git remote.** Any laptop loss or fat-finger deploy is unrecoverable. **Push to GitHub and set up CI before next deploy.**
3. **Stripe activation pre-deploy.** If anyone configures STRIPE_SECRET_KEY without first implementing webhook event handlers, payments will be accepted without entitlement. **Block the secret rotation until BIL-1 lands.**

## Production safety verdict

**SAFE BUT INCOMPLETE.** The current production deployment will not harm users — but it also cannot serve them. Auth and isolation are real; everything else is mock. The dependency CVEs are the single biggest concrete risk to the running Worker; the operational risks (no CI, no Git remote, no rollback docs) are the biggest risk to the team.

## Required immediate actions

| ID | Severity | Action |
|---|---|---|
| PROD-1 | Critical | Run `npm audit fix --force` or selectively patch hono ≥4.12.16, react-router ≥7.13, vite ≥6.4.2, undici, lodash. Re-run typecheck/lint/test/build. **Before next deploy.** |
| PROD-2 | High | Push repo to a GitHub remote. Add `.github/workflows/ci.yml` running typecheck/lint/test/build on PRs |
| PROD-3 | High | Add `scripts/prod-smoke.ts` that replicates Codex's manual smoke. Run on every deploy |
| PROD-4 | High | Add a `securityHeaders()` Hono middleware (CSP, HSTS, X-Frame-Options, Referrer-Policy) and apply to all responses |
| PROD-5 | High | Provision staging D1/KV/R2 and update `wrangler.jsonc` env.staging |
| PROD-6 | Medium | Document rollback in `final-strategy/15_FINAL_DEPLOYMENT_STRATEGY.md` |
| PROD-7 | Medium | Configure Cloudflare observability dashboards (counts of 4xx/5xx, latency p95) |
| PROD-8 | Medium | Implement webhook event handlers (BIL-1) before any Stripe production secret is configured |
| PROD-9 | Medium | Remove the dead `MUSTBEVIRAL_MCP` DO binding (or implement) |
| PROD-10 | Low | Remove unused `SESSION_SECRET` env declaration |

## Production deployment go/no-go matrix

| Audience | Verdict |
|---|---|
| Engineering team (read API) | GO — safe to demo |
| Internal stakeholders | CONDITIONAL GO — only with disclaimer that AI features are mocked |
| Closed beta | NO-GO — UI is unusable, AI is fake |
| Paying customers | NO-GO — AI is fake, billing skeleton |
| Public marketing launch | NO-GO — see all of above |
