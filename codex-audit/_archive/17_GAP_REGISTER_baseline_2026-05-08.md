# 17 — Gap Register

> ## ⚠️ STATUS RECONCILIATION (post-Run-7, 2026-05-08)
>
> This document captures the audit's **baseline** snapshot. Runs 1-7 closed many of the gaps below. The table immediately under this header is the **single source of truth** for current open status. Read this header first; treat the original gap tables as historical context.
>
> ### Authoritative status table
>
> | Gap | Severity | Status | FIX_LOG ref |
> |---|---|---|---|
> | C-1 | Critical | ✅ **CLOSED** | Run 1 — deps patched, 0 high-CVE |
> | C-2 | Critical | 🟡 **PARTIAL** | Run 7 — 4/7 workflows now real `step.do` (BrandOnboarding, ContentCalendar, WeeklyReport, GrowthOpportunity). Image / ApprovalScheduling / DMAutomationSetup still stubs |
> | C-3 | Critical | 🟡 **PARTIAL** | Run 6 — real Workers AI branch wired for `@cf/...` models with mock fallback. **External providers (Kimi, OpenAI, Anthropic via AI Gateway) NOT WIRED** — see Prompt 20 |
> | C-4 | Critical | ✅ **CLOSED** | Run 4 — Stripe webhook event dispatcher + idempotency + replay |
> | C-5 | Critical | ❌ **OPEN** | UI is still the static `home.tsx` placeholder. Multi-week scope deferred. Prompts 34+ |
> | C-6 | Critical | 🟡 **PARTIAL** | Test count grew 12→24 with real dispatcher + entitlements unit tests. **HTTP-level integration suite still missing** — see Prompts 5, 6, 27, 28 |
> | H-1 | High | 🟡 **PARTIAL** | Run 2 — agent surface annotated in AGENT_SPEC.md (16/20 mapped to API). 4 spec methods (regenerateBrandField, generatePost, createCampaignFromOpportunity, getWorkflowStatus) still missing |
> | H-2 | High | ❌ **OPEN** | Image gen still mock — Workers AI Flux + R2 upload pending. **Prompt 18** |
> | H-3 | High | 🟡 **PARTIAL** | Same as C-2 |
> | H-4 | High | ❌ **OPEN** | No Git remote, no CI/CD. **Prompt 3** |
> | H-5 | High | ❌ **OPEN** | Routes still call sync mock generators. Workflows are ready to be invoked (Run 7) but `WORKFLOW.create({...})` not wired. **Prompt 16** |
> | H-6 | High | ✅ **CLOSED** | Run 1 — `executionCtx.waitUntil` |
> | H-7 | High | ✅ **CLOSED** | Run 1 — securityHeaders middleware (CSP/HSTS/COOP/CORP/...) |
> | H-8 | High | ✅ **CLOSED** | Run 1 — BUILD_LOG / DECISIONS_LOG corrected with route-helper pattern + autonomy-89 + Stripe activation gate + multi-device sessions entries |
> | H-9 | High | ❌ **OPEN** | No multi-brand tenant-isolation integration test yet. **Prompt 6** |
> | H-10 | High | ✅ **CLOSED** | Subsumed by C-4 closure (webhook event handlers update `subscriptions.stripe_customer_id` etc.) |
> | H-11 | High | ✅ **CLOSED** | Run 6 — plan caps enforced on brand-create + 5 AI-spending routes; `entitlements.ts` + 5 unit tests |
> | H-12 | High | ❌ **OPEN** | E2E specs still not wired to managed dev-server. **Prompt 29** |
> | M-1 | Medium | ✅ **CLOSED** | Run 3 — multi-device sessions decision documented in DECISIONS_LOG |
> | M-2 | Medium | ❌ **OPEN** | `idempotency_keys` table still unwired on mutating routes. **Prompt 25** |
> | M-3 | Medium | ❌ **OPEN** | List endpoints lack `?cursor=`. `clampLimit()` helper exists; cursor-based pagination still TODO. **Prompt 37** |
> | M-4 | Medium | ❌ **OPEN** | DNS rebinding mitigation not in SSRF guard |
> | M-5 | Medium | ✅ **CLOSED** | Run 1 — manual redirect handling, every hop re-validated, ≤4 hops |
> | M-6 | Medium | ✅ **CLOSED** | Run 2 — KV-backed IP rate limit on signup (60/min) and login (30/min) |
> | M-7 | Medium | ❌ **OPEN** | Password reset deferred — needs email infra |
> | M-8 | Medium | ❌ **OPEN** | Email verification deferred — needs email infra |
> | M-9 | Medium | ❌ **OPEN** | No admin-seed route. **Sprint E SEC-4 in ship-it prompt** |
> | M-10 | Medium | ❌ **OPEN** | Same as H-5 |
> | M-11 | Medium | 🟡 **PARTIAL** | Workflow runs / agent runs / usage events / scheduled posts / dm rules / dm events / brand assets all wired. `idempotency_keys`, `analytics_snapshots`, `creator_profiles`, `marketplace_matches` still empty (Phase 2 by intent) |
> | M-12 | Medium | ❌ **OPEN** | `routes/brands.ts` is now ~770 lines after Wave 5-6 additions. Splits deferred |
> | M-13 | Medium | ✅ **CLOSED** | Run 5 — `GET /api/brands/:brandId/scheduler/exports` |
> | M-14 | Medium | ✅ **CLOSED** | Run 5 — manual-export now two-phase + atomic via `db.batch` |
> | M-15 | Medium | ✅ **CLOSED** | Run 5 — `PATCH /api/brands/:brandId/dm-rules/:ruleId` with approve/reject/pause/activate |
> | M-16 | Medium | ❌ **OPEN** | Sentry / dashboards. **Prompt 33** |
> | M-17 | Medium | ❌ **OPEN** | Staging bindings still placeholders. **Prompt 32** |
> | M-18 | Medium | ✅ **CLOSED** | Run 1 — autonomy-89 ceiling documented |
> | M-19 | Medium | ✅ **CLOSED** | Same as M-1 (multi-device sessions decision; `rotated_at` reserved for future) |
> | M-20 | Medium | 🟡 **PARTIAL** | New 0002 migration is additive (`CREATE INDEX IF NOT EXISTS`). General rollback policy still undocumented in a runbook |
> | L-1 | Low | ✅ **CLOSED** | Run 5 — 0002 migration with 3 indexes |
> | L-2 | Low | ❌ **DEFERRED** | `MUSTBEVIRAL_MCP` DO removal needs a new wrangler DO migration tag (`v2` `deleted_classes`). Skipped for now to avoid touching the production DO migration sequence |
> | L-3 | Low | ✅ **CLOSED** | Run 3 — `SESSION_SECRET` removed from AppSecrets + .example files |
> | L-4 | Low | ❌ **OPEN** | Magic numbers still scattered. **Prompt 39** |
> | L-5 | Low | ✅ **CLOSED** | Run 1 — `@cloudflare/workers-types` dropped from tsconfig |
> | L-6 | Low | ❌ **OPEN** | `publicUser` could narrow more defensively |
> | L-7 | Low | ❌ **OPEN** | No coverage threshold gate. **Prompt 31** |
> | L-8 | Low | ❌ **OPEN** | No prompt-injection-in-scan integration test |
> | L-9 | Low | ✅ **CLOSED** | Run 3 — logout audit log |
> | L-10 | Low | ✅ **CLOSED** | Run 3 — website-scan audit log (success + blocked) |
> | L-11 | Low | ❌ **OPEN** | UI auth-loader pending — depends on UI rebuild (C-5) |
> | L-12 | Low | ❌ **OPEN** | `email_verified_at` unused (depends on M-8) |
> | L-13 | Low | ❌ **OPEN** | `weekly_reports.pdf_r2_key` always NULL — drop column or implement PDF |
> | SEC-7 | Medium | ✅ **CLOSED** | Run 1 — IPv4-mapped IPv6 SSRF block + tests |
> | BIL-2 | Medium | ✅ **CLOSED** | Run 5 — `customer_email`, `client_reference_id`, `metadata[user_id]` |
> | BIL-3 | Medium | ✅ **CLOSED** | Run 5 — Stripe API error handling + 502 envelope |
> | BIL-4 | Medium | ✅ **CLOSED** | Run 5 — `Idempotency-Key` header on every Stripe POST |
>
> ### Counts (post-Run-7)
>
> | Status | Count |
> |---|---|
> | ✅ Closed | **22** |
> | 🟡 Partial | **5** |
> | ❌ Open | **17** |
> | ❌ Deferred (Phase 2 / blocked) | **1** |
>
> Originally 51 gaps; **27 fully or partially resolved.** Headline remaining: C-5 UI rebuild (multi-week), C-6 HTTP integration suite, H-2 real image gen, H-4 Git remote + CI/CD, H-5 async onboarding, AI-3 AI Gateway routing, observability, staging provisioning.

---

Severity scale: **Critical** = blocks safe production / unsafe / data loss; **High** = blocks MVP correctness or sellability; **Medium** = blocks beta polish; **Low** = cleanup.

> The tables below describe the **baseline** as audited. See the reconciliation header above for current operational status.

## Critical gaps

| ID | Severity | Area | Gap | Evidence | Impact | Fix | Owner Prompt |
|---|---|---|---|---|---|---|---|
| C-1 | Critical | security | `hono@4.11.1` and `react-router@7.9.6` ship with multiple known CVEs (cookie injection, basicAuth timing, prototype pollution; CSRF/XSS) | `npm audit` output (15 advisories, 10 high) | Production Worker is vulnerable to cookie-injection and CSRF attacks today | `npm audit fix --force`; bump deps; re-run typecheck/lint/test/build | NPM-AUDIT-FIX |
| C-2 | Critical | agent/workflow | All 7 Cloudflare Workflows are stubs that call `runWorkflowStub` only | `src/server/workflows/*.ts` (each ≤14 lines), `src/server/workflows/base.ts:17-31` | The "agent + workflow" architecture exists in name only; no async orchestration | Implement at least BrandOnboardingWorkflow as a real multi-step Workflow with `step.do(...)` calls | WORKFLOW-ONBOARDING-REAL |
| C-3 | Critical | AI | `ModelRouter.generateText` returns string literals in both mock and "real" branches; never calls `env.AI.run` | `src/server/services/model-router.ts:33-47` | Production users get fake AI output even with `USE_MOCK_AI=false` | Implement Workers AI / Kimi / Claude provider calls inside ModelRouter, with timeouts and cost tracking | AI-ROUTER-REAL |
| C-4 | Critical | billing | Stripe webhook does not process events; only logs receipt | `src/server/routes/webhooks.ts:13-45` | Once Stripe live charges are enabled, payments are accepted but subscriptions never advance, plans never enforced | Implement event dispatcher: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed` | STRIPE-WEBHOOK-HANDLERS |
| C-5 | Critical | UI | App is a static info dashboard with no forms, no fetch calls, no auth integration | `app/routes/home.tsx`, `app/routes.ts` (only 2 routes) | Customers cannot use the product through a browser; only via direct API calls | Build real UI: login/signup, workspaces, brands, onboarding, intelligence, calendar, approvals, etc. | UI-BUILD-MVP |
| C-6 | Critical | tests | Only 12 unit tests + 2 unrun e2e specs; no route, RBAC, multi-brand, billing, workflow, MCP, DO tests | `tests/unit/*.ts`, `tests/e2e/command-center.spec.ts` | Every fix risks regressing untested behaviour | Add HTTP-level tests for all routes; multi-brand tenant-isolation test; CI-runnable e2e | TEST-COVERAGE-EXPAND |

## High gaps

| ID | Severity | Area | Gap | Evidence | Impact | Fix | Owner Prompt |
|---|---|---|---|---|---|---|---|
| H-1 | High | agent | MarketingAgent DO exposes only 5 endpoints; 14 of 20 spec methods return 501 | `src/server/agents/MarketingAgent.ts:85-94` | Spec promises 20 callable agent methods; reality is 5 + route helpers that bypass the DO | Either implement remaining methods on the DO (with state machine transitions) or revise spec to acknowledge route-helper pattern | AGENT-METHODS-WIRE |
| H-2 | High | AI | Image generation stores a fake `r2_key` and never uploads to R2 | `src/server/services/brand-operations.ts:438-455` | UI would 404 when resolving image URLs | Implement Workers AI Flux call + R2 upload | IMAGE-GEN-REAL |
| H-3 | High | docs | Spec promises "23-step BrandOnboardingWorkflow" but workflow class has 0 steps | `src/server/workflows/BrandOnboardingWorkflow.ts:6-13` | Spec drift; misleads stakeholders | Same as C-2 (implement workflow) | WORKFLOW-ONBOARDING-REAL |
| H-4 | High | ops | No Git remote, no CI/CD | `git remote -v` (empty); no `.github/workflows/` | All deploys manual; PR review impossible; laptop loss = repo loss | Push to GitHub, add CI workflow (typecheck/lint/test/build), gate deploy on green CI | GH-CI-SETUP |
| H-5 | High | runtime | Synchronous onboarding inside POST `/:workspaceId/brands` | `src/server/routes/workspaces.ts:200-210` | Once onboarding does real work, request will exceed 30s Workers budget | Move to `env.BRAND_ONBOARDING_WORKFLOW.create({…})` and return 202 with workflow instance ID | ONBOARDING-ASYNC |
| H-6 | High | runtime | `startAgentIfAvailable` calls DO without `c.executionCtx.waitUntil` | `src/server/routes/brands.ts:530-549` | Fire-and-forget; DO state writes can be cancelled mid-flight; activity log entries can interleave between concurrent requests | Wrap in `c.executionCtx.waitUntil(stub.fetch(...))` | DO-WAITUNTIL |
| H-7 | High | security | No CSP / HSTS / X-Frame-Options headers | `src/server/index.ts` (no security headers middleware) | Browser-side XSS, downgrade attacks, clickjacking on the SPA | Add `securityHeaders()` middleware applied to all responses | SEC-HEADERS |
| H-8 | High | docs | "MarketingAgent has 20 callable methods" misstated in BUILD_LOG | `final-strategy/BUILD_LOG.md` Milestone 7 result text | Internal stakeholders may believe agent layer is built when it isn't | Correct BUILD_LOG and DECISIONS_LOG; document route-helper pattern in DECISIONS_LOG | DOCS-CORRECT |
| H-9 | High | tests | No multi-brand tenant-isolation test | `tests/unit/*.ts` | Cross-tenant leak would not be caught by current tests | Add test where user A creates brand X, user B in different workspace gets 403 | TEST-TENANT-ISOLATION |
| H-10 | High | billing | Stripe checkout accepts payments without seeding `subscriptions.stripe_customer_id` | `routes/billing.ts:112-134`, webhook never updates subscriptions | Customer portal route falls into safe-disable (deadlock) | Same as C-4 (webhook event handlers) | STRIPE-WEBHOOK-HANDLERS |
| H-11 | High | AI | No per-plan AI request caps | `subscriptions.plan` never read in AI path | A starter plan can consume agency-tier AI quota | Read `subscriptions.plan`, aggregate `usage_events`, enforce caps | AI-PLAN-CAPS |
| H-12 | High | tests | E2E specs never executed | `tests/e2e/command-center.spec.ts`; `npm run test:e2e:list` only | Static UI assertions are unverified at runtime | Add managed-dev-server for Playwright; run on CI | E2E-CI-RUN |

## Medium gaps

| ID | Severity | Area | Gap | Evidence | Impact | Fix | Owner Prompt |
|---|---|---|---|---|---|---|---|
| M-1 | Medium | session | Login does not invalidate prior sessions | `src/server/routes/auth.ts:96-145` | Sessions stack indefinitely; deletes from one device leak elsewhere | Optional: revoke prior sessions on login OR document multi-device intent | SESSION-ROTATE |
| M-2 | Medium | API | No idempotency-key handling on mutating routes | `src/server/db/migrations/0001_initial.sql:397` (table exists), no usage | Duplicate requests can double-insert | Wire `idempotency_keys` for POST routes that create new entities | IDEMPOTENCY-WIRE |
| M-3 | Medium | API | No pagination on list endpoints | All GET list routes | Large brands could return >5000 rows | Add `?limit=&cursor=` | PAGINATION |
| M-4 | Medium | security | DNS rebinding not addressed in SSRF guard | `services/security/ssrf.ts` only validates parsed hostname | Hostile DNS could resolve to private IP after validation | Add DNS resolution + re-check OR rely on Cloudflare egress restrictions | SSRF-DNS-REBINDING |
| M-5 | Medium | security | Redirect targets not re-validated in website-scan | `services/website-scan.ts:78-86` follows redirects | 3xx → private IP via redirect | Set `redirect: "manual"` and re-validate each Location | SCAN-REDIRECT-VALIDATE |
| M-6 | Medium | security | No IP-based rate limiting on auth | `routes/auth.ts:96-145` lockout is per-account only | Username-enum amplification | KV-based IP rate limit | RATELIMIT-IP |
| M-7 | Medium | security | No password reset flow | No code path | Users cannot recover accounts | Implement when email infra exists | PASSWORD-RESET |
| M-8 | Medium | security | No email verification | `users.email_verified_at` never written | Email-spoofed signups possible | Implement when email infra exists | EMAIL-VERIFY |
| M-9 | Medium | security | No admin user provisioning route | No code path | First admin must be hand-edited via D1 | Add seed script or `POST /admin/seed` | ADMIN-SEED |
| M-10 | Medium | runtime | Brand creation does sync onboarding → 30s budget risk | (covered by H-5) | — | — | (same as H-5) |
| M-11 | Medium | DB | `idempotency_keys`, `analytics_snapshots`, `dm_events`, `social_scans`, `competitor_scans`, `creator_profiles`, `marketplace_matches`, `brand_assets` tables empty (no code path) | Migration | DB over-built for current code | Either wire or document Phase 2 | DB-PHASE2-DOC |
| M-12 | Medium | code-quality | `routes/brands.ts` is 550 lines / 16 endpoints | `src/server/routes/brands.ts` | Cognitive load | Split into per-feature files | ROUTES-SPLIT |
| M-13 | Medium | scheduler | No `GET /:brandId/scheduler/exports` endpoint to retrieve past manual exports | Routes file | Users hit POST manual-export, then can't list/re-download | Add endpoint | SCHEDULER-EXPORTS-LIST |
| M-14 | Medium | scheduler | Multi-post manual export is not transactional | `routes/brands.ts:350-390` | Partial failures leave inconsistent scheduled_posts | Wrap in transaction or per-post try/continue with rollup status | SCHEDULER-TX |
| M-15 | Medium | DM | No DM rule approval/rejection endpoints | `routes/brands.ts` (only POST insert) | Rules stuck in `pending_approval` | Add `PATCH /:brandId/dm-rules/:ruleId` | DM-APPROVE-ROUTE |
| M-16 | Medium | observability | No Sentry / structured logs / metrics / alerts | `wrangler.jsonc` only enables observability sampling | Production failures invisible | Add Sentry, structured logs, dashboards | OBSERVABILITY |
| M-17 | Medium | ops | Staging bindings are placeholders | `wrangler.jsonc:113-202` | Cannot deploy to staging | Provision staging D1/KV/R2 | STAGING-PROVISION |
| M-18 | Medium | docs | `autonomy_level` ceiling 89 vs spec 100 undocumented | `migrations/0001_initial.sql:90` | Spec drift | Document in DECISIONS_LOG | DOCS-AUTONOMY |
| M-19 | Medium | session | `sessions.rotated_at` column unused | `migrations/0001_initial.sql:30` | Dead column | Implement rotation OR drop column | SESSION-ROTATE-COLUMN |
| M-20 | Medium | DB | Single migration file with no rollback path | `migrations/0001_initial.sql` | Cannot roll back schema | Future migrations must be additive only | MIGRATIONS-ROLLBACK-DOC |

## Low gaps

| ID | Severity | Area | Gap | Evidence | Impact | Fix | Owner Prompt |
|---|---|---|---|---|---|---|---|
| L-1 | Low | DB | `competitor_scans` lacks brand index | migration | minor query slowness | Add index | INDEX-COMPETITOR-SCANS |
| L-2 | Low | code | `MUSTBEVIRAL_MCP` DO is dead code | `src/server/mcp/MustBeViralMCP.ts:5-18` | Bound but unused | Remove DO + binding (new migration tag) or implement | MCP-DO-REMOVE |
| L-3 | Low | code | `SESSION_SECRET` env declared but unused | `src/server/env.ts:12` | Dead config | Remove or use as cookie pepper | ENV-SESSION-SECRET |
| L-4 | Low | code | Magic numbers throughout services | various | hard to tune | Centralise in `src/server/config.ts` | CONFIG-CENTRALISE |
| L-5 | Low | code | `@cloudflare/workers-types` deprecated by wrangler | `tsconfig.json` | warning on every typegen | Remove package + tsconfig types entry | WORKERS-TYPES-MIGRATE |
| L-6 | Low | code | `routes/brands.ts:174-176` `publicUser` exposes raw row | Code | low risk; password_hash never returned, but defensive type-narrow is better | Type-narrow | PUBLIC-USER-NARROW |
| L-7 | Low | tests | No coverage gate | package.json | coverage can silently regress | Add coverage threshold | COVERAGE-GATE |
| L-8 | Low | tests | No tests for prompt-injection in scan path | `services/website-scan.ts` not covered | end-to-end behaviour untested | Add integration test | TEST-SCAN-INJECTION |
| L-9 | Low | API | `/auth/logout` does not write audit log | `routes/auth.ts:147-151` | gap in audit trail | Add audit log call | AUDIT-LOGOUT |
| L-10 | Low | API | `createWebsiteScan` does not write audit log | `services/website-scan.ts` | gap in audit trail | Add audit log call | AUDIT-SCAN |
| L-11 | Low | UI | `home.tsx` SSR loader does not check auth | `app/routes/home.tsx:32-41` | static cockpit only — currently fine; will matter when real UI is built | Move auth check to loader as part of UI build | UI-AUTH-LOADER |
| L-12 | Low | session | `users.email_verified_at` column unused | migration | dead column | Wire when email verification implemented | (see M-8) |
| L-13 | Low | DB | `weekly_reports.pdf_r2_key` always NULL | migration | dead column | Either implement PDF generation or drop column | WEEKLY-REPORT-PDF |

## Counts

* Critical: **6**
* High: **12**
* Medium: **20**
* Low: **13**
* **Total: 51**

(Plus other smaller observations recorded inline in topic-specific audit files.)
