# 18 — Fix Roadmap

This roadmap orders the gaps from `17_GAP_REGISTER.md` into sprints. The goal of Sprint 0 is to **make production deployment safe**; Sprints 1-6 take the product from "demoable" to "sellable".

For each task: ID from gap register, files to inspect/edit, acceptance criteria, commands.

---

## Sprint 0 — Stop-the-bleed (≈1 day)

Goal: make the currently-deployed Worker safe to leave online.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **0.1** Patch dependencies | C-1 | `npm audit --audit-level=high` shows 0 high; `typecheck/lint/test/build` still green |
| **0.2** Add securityHeaders middleware | H-7 | Every response carries CSP, HSTS, X-Frame-Options DENY, Referrer-Policy strict-origin |
| **0.3** Push to GitHub remote | H-4 | `git remote -v` shows `origin`; CI workflow on PR runs typecheck/lint/test/build |
| **0.4** Document rollback steps | PROD-6 | `final-strategy/15_FINAL_DEPLOYMENT_STRATEGY.md` updated with `wrangler deployments rollback` cookbook |
| **0.5** Block Stripe live keys until BIL-1 lands | PROD-8 (note in DEPLOYMENT_RUNBOOK) | Marker doc states "do not configure STRIPE_SECRET_KEY until C-4 complete" |
| **0.6** Correct BUILD_LOG / DECISIONS_LOG | H-8 | BUILD_LOG Milestone 7 result text updated to reflect 5 agent endpoints not 20; DECISIONS_LOG documents route-helper pattern + autonomy_level=89 ceiling (M-18) |

Files: `package.json`, `package-lock.json`, `src/server/index.ts`, `src/server/middleware/security-headers.ts` (new), `final-strategy/BUILD_LOG.md`, `final-strategy/DECISIONS_LOG.md`, `final-strategy/15_FINAL_DEPLOYMENT_STRATEGY.md`, `.github/workflows/ci.yml` (new), README.md.

---

## Sprint 1 — Auth / RBAC correctness (≈3 days)

Goal: ensure auth and isolation are unbreakably correct.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **1.1** Add HTTP-level integration tests for /api/auth/* and RBAC | C-6 (partial), TEST-1, H-9 | Tests cover signup→login→me→logout, lockout-after-5-fails, session expiry, bearer fallback, requireAuth/requireAdmin/requireWorkspaceMember/requireBrandAccess; multi-brand isolation test |
| **1.2** Add IP rate limiting to /api/auth/login + /api/auth/signup | M-6 | KV `ratelimit:ip:<hash>` counter; 60 req/min for signup, 30 req/min for login per IP |
| **1.3** Add audit log calls to /auth/logout, createWebsiteScan, RBAC denials | L-9, L-10 | Every action logged to `audit_logs` |
| **1.4** Implement session rotation OR document multi-device session intent | M-1, M-19 | Either prior sessions revoked on login OR DECISIONS_LOG entry |
| **1.5** Add admin user provisioning route (`POST /admin/seed` with secret) or seed script | M-9 | `scripts/seed-admin.ts` documented |
| **1.6** Block IPv4-mapped IPv6 in SSRF guard | SEC-7 | Test for `::ffff:127.0.0.1` returns blocked |
| **1.7** Re-validate redirect targets in website-scan | M-5 | Test for redirect to private IP returns blocked |

Files: `tests/integration/*.ts` (new), `src/server/middleware/rate-limit.ts` (new), `src/server/services/security/ssrf.ts`, `src/server/services/website-scan.ts`, `src/server/routes/auth.ts`, `scripts/seed-admin.ts` (new).

---

## Sprint 2 — Multi-brand + agent correctness (≈4 days)

Goal: bring the agent layer in line with the spec.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **2.1** Decide: 20-method DO vs route-helper pattern | H-1 | DECISIONS_LOG entry. Recommendation: hybrid — DO holds state + lifecycle (pause/resume/onboarding); 20 spec methods callable via API routes |
| **2.2** Wrap all DO calls in `c.executionCtx.waitUntil` | H-6 | DO state writes complete before request response is finalised |
| **2.3** Expose pause/resume/activity through API routes (not just DO endpoints) | H-1 | `POST /api/brands/:brandId/agent/pause`, `resume`, `GET /agent/activity` |
| **2.4** Add tests for DO state transitions | TEST-3 | Tests cover idle → onboarding → paused → idle, with concurrent request safety |
| **2.5** Remove or implement `MUSTBEVIRAL_MCP` DO | L-2 | Either new migration tag drops the DO class, or DO returns real MCP responses |

Files: `src/server/agents/MarketingAgent.ts`, `src/server/routes/brands.ts`, `src/server/mcp/MustBeViralMCP.ts`, `wrangler.jsonc` (DO migrations), `tests/integration/marketing-agent.test.ts` (new).

---

## Sprint 3 — Real workflows + AI providers (≈1-2 weeks)

Goal: stop returning mock JSON for AI/workflow features.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **3.1** Implement `BrandOnboardingWorkflow` as a real Workflow | C-2 | `step.do(...)` for: scan → score → profile → target → first calendar (mock-then-real) → first images (mock-then-real) → first approval queue. Updates `workflow_runs.progress` |
| **3.2** Move synchronous onboarding inside `POST /:workspaceId/brands` to `env.BRAND_ONBOARDING_WORKFLOW.create({…})` | C-2, H-5 | Brand-create returns 202 + `workflowInstanceId`; UI polls `GET /workflow-runs/:id` |
| **3.3** Implement `ContentCalendarWorkflow` and wire calendar generation | C-2 | Real per-day post generation through ModelRouter |
| **3.4** Implement `ImageGenerationWorkflow` + real Workers AI Flux + R2 upload | C-2, H-2, AI-4 | `generated_creatives.r2_key` matches an R2 object; can be downloaded via signed URL |
| **3.5** Implement real `ModelRouter.generateText` for `provider="workers_ai"` | C-3, AI-1 | `env.AI.run(model, {messages: [...]})` returns real text, computes tokens |
| **3.6** Implement Kimi via AI Gateway with `AI_GATEWAY_TOKEN` | AI-3 | When `DEFAULT_TEXT_MODEL=kimi-2.6`, calls `https://gateway.ai.cloudflare.com/v1/<acct>/<gw>/moonshot/...` |
| **3.7** Implement OpenAI/Anthropic providers | AI-3 | Configurable provider selection per category |
| **3.8** Implement real cost tracking | AI-6 | `usage_events.cost_estimate_cents` reflects token-based pricing |
| **3.9** Verify Workers AI Flux model IDs | AI-2 | Models in `wrangler.jsonc` actually exist in Workers AI catalog |
| **3.10** Sanitize prompts inside ModelRouter | AI-5 | scan-content prompts go through `sanitizeUntrustedText` before forwarding |
| **3.11** Add tests | TEST-12 | Tests for each provider (mock + each real adapter), per-plan limit gating |

Files: `src/server/workflows/*.ts`, `src/server/services/model-router.ts`, `src/server/services/brand-operations.ts`, `wrangler.jsonc` (model IDs), `tests/integration/model-router.test.ts` (new), `tests/integration/workflows-onboarding.test.ts` (new).

---

## Sprint 4 — Security hardening (≈3-5 days)

Goal: production posture matches the spec's safety bar.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **4.1** Implement Stripe webhook event handlers | C-4, BIL-1 | `subscriptions.status` advances; `stripe_customer_id` populated; `past_due`/`canceled` handled |
| **4.2** Pass authenticated user email + workspace metadata to Stripe checkout | BIL-2 | Stripe customer matches workspace |
| **4.3** Add Stripe API error handling and `Idempotency-Key` headers | BIL-3, BIL-4 | Errors return error envelopes; idempotent retries safe |
| **4.4** Implement plan-based entitlement enforcement | H-11, BIL-5 | Brand creation cap, content_posts/mo cap, AI request cap per plan |
| **4.5** Wire `idempotency_keys` for mutating routes | M-2 | Replays of same `Idempotency-Key` header return cached response |
| **4.6** Add DM rule approval endpoints | M-15 | `PATCH /api/brands/:brandId/dm-rules/:ruleId` with action approve/reject |
| **4.7** Add password reset flow | M-7 | `POST /api/auth/forgot-password` + `POST /api/auth/reset-password` once email infra exists |
| **4.8** Add email verification | M-8 | `POST /api/auth/verify-email` once email infra exists |
| **4.9** Add audit logs for billing/webhook events | BIL-8 | Every webhook event logged |

Files: `src/server/routes/{webhooks,billing,auth,brands}.ts`, `src/server/middleware/idempotency.ts` (new), `tests/integration/billing-flow.test.ts` (new), `tests/integration/dm-rules.test.ts` (new).

---

## Sprint 5 — Tests / E2E (≈3-5 days)

Goal: ≥70% coverage on `src/server/services/**` and ≥50% on `src/server/routes/**`.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **5.1** Add HTTP-level integration tests for every route group | TEST-1 (continued) | typecheck passes; coverage report ≥70% on services |
| **5.2** Add multi-brand tenant-isolation test (already in 1.1, expand) | H-9 | Test for cross-tenant 403 on every BR-protected route |
| **5.3** Add MarketingAgent DO test | TEST-3 | DO state transitions verified |
| **5.4** Add MCP read-only enforcement test | TEST-5 | Tests confirm `INSERT`, `;`-chain, DDL all rejected |
| **5.5** Make Playwright e2e runnable in CI | TEST-7, H-12 | `npm run test:e2e` runs against local dev server |
| **5.6** Add `scripts/prod-smoke.ts` | TEST-13, PROD-3 | Replicates Codex's manual smoke; runnable on every deploy |
| **5.7** Add coverage gate | L-7, TEST-8 | `npm run test:coverage` fails if coverage drops below threshold |
| **5.8** Add tests for billing flows / Stripe error paths / plan enforcement / Stripe live-disabled branch | BIL-6, TEST-6 | All branches tested |

Files: `tests/integration/*.ts` (extensive), `tests/e2e/*.spec.ts` (extensive), `scripts/prod-smoke.ts` (new), `vitest.config.ts` (coverage config), `.github/workflows/ci.yml`.

---

## Sprint 6 — Staging + observability + UI (≈2-4 weeks)

Goal: full production polish.

| Task | Gap IDs | Acceptance |
|---|---|---|
| **6.1** Provision staging D1/KV/R2 + update `wrangler.jsonc` | M-17 | Staging deploy works |
| **6.2** Wire Sentry, structured logging, dashboards, alerting | M-16 | Production failures observable |
| **6.3** Build real UI: auth, workspaces, brands, onboarding, intelligence, profile, calendar, approvals, media, DM rules, reports, growth, billing, admin | C-5 | All MVP user actions reachable via browser |
| **6.4** Add pagination on list endpoints | M-3 | All GET list routes accept `?limit=&cursor=` |
| **6.5** Split `routes/brands.ts` into per-feature files | M-12 | Each route file ≤200 lines |
| **6.6** Centralise magic numbers | L-4, CQ-3 | `src/server/config.ts` exists; tests pass |
| **6.7** Drop `@cloudflare/workers-types` per wrangler deprecation | L-5 | tsconfig.json no longer references it; types still resolve |
| **6.8** Drop unused `SESSION_SECRET` declaration OR use as pepper | L-3 | env.ts cleaned up |
| **6.9** Add `GET /:brandId/scheduler/exports` endpoint | M-13 | Exports retrievable as CSV/JSON |
| **6.10** Make multi-post manual export transactional | M-14 | Partial failures rolled back |
| **6.11** Drop empty Phase 2 tables OR document | M-11 | Schema matches Phase 1 use cases |
| **6.12** Drop `weekly_reports.pdf_r2_key` OR implement | L-13 | Schema matches reality |
| **6.13** Drop `users.email_verified_at` if email verification deferred | L-12 | Schema matches reality |
| **6.14** Add competitor_scans index | L-1 | Migration adds idx_competitor_scans_brand |

Files: across the codebase. UI rebuild is the biggest single effort — estimate 3-5 weeks dedicated.

---

## Suggested ordering for next 4 weeks

| Week | Sprints | Outcome |
|---|---|---|
| 1 | Sprint 0 + Sprint 1 | Production safe; auth/RBAC tested; CI gating |
| 2 | Sprint 2 + Sprint 4 (start) | Agent corrected; Stripe webhook handlers shipped; idempotency wired |
| 3 | Sprint 3 (start) | Real BrandOnboardingWorkflow + Workers AI text working; brand-create async |
| 4 | Sprint 3 (continued) + Sprint 5 | All workflows real OR explicitly Phase 2; coverage ≥70% |

After 4 weeks: production runs the full intended stack with real AI, real workflows, real Stripe handling, full test coverage. UI rebuild (Sprint 6) starts in parallel after Sprint 0/1.
