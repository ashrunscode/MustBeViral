# REPAIR_PLAN.md

There is no code to repair. This is a phase-by-phase **build plan** that turns the system DNA into a shippable product. Each task includes objective, files to edit/create, expected output, tests to run, dependency, priority, and difficulty.

Difficulty: S (a few hours) / M (1–2 days) / L (3–5 days) / XL (more).

---

## Phase 0: Stabilize Repo (1–2 days)

### Task 0.1 — Decide auth scheme
- Objective: pick custom email/password (Argon2id WASM + sessions in D1) OR `openauth-template`. **Recommended: custom + sessions** for MVP simplicity, no third-party dep, full control over passwordless upgrade later.
- Files to edit: none (decision logged in `docs/decisions/0001-auth.md`).
- Expected output: ADR-style markdown.
- Tests: none.
- Dependency: none.
- Priority: P0. Difficulty: S.

### Task 0.2 — Scaffold project from template
- Objective: scaffold from `cloudflare/templates/react-router-hono-fullstack-template` into the working directory. Preserve `audit/` and `mustbeviral_system_dna_extracted/` (move them to `docs/system-dna/` post-scaffold).
- Files: entire repo.
- Expected: clean compile, `npm run dev` serves a placeholder page.
- Tests: `npm run typecheck && npm run build`.
- Dependency: 0.1.
- Priority: P0. Difficulty: S.

### Task 0.3 — Initialize git
- Objective: `git init`, add `.gitignore`, first commit with the scaffold.
- Files: `.gitignore` (node_modules, .wrangler, dist, .env*, coverage, audit/.draft).
- Expected: clean working tree, single commit.
- Tests: `git status` clean.
- Dependency: 0.2.
- Priority: P0. Difficulty: S.

### Task 0.4 — Pin dependency versions
- Objective: replace `"latest"` with explicit versions; commit `package-lock.json`.
- Files: `package.json`, `package-lock.json`.
- Expected: reproducible installs.
- Tests: `npm ci` succeeds.
- Dependency: 0.2.
- Priority: P0. Difficulty: S.

### Task 0.5 — Strict TypeScript config
- Objective: `tsconfig.json` with `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, decorator config (`experimentalDecorators` if SDK requires it), `types: ["@cloudflare/workers-types/2024-09-23"]`.
- Files: `tsconfig.json`.
- Expected: compile passes; no implicit any.
- Tests: `npm run typecheck`.
- Dependency: 0.2.
- Priority: P0. Difficulty: S.

### Task 0.6 — Eslint + Prettier + Husky
- Objective: lint + format + pre-commit hook.
- Files: `eslint.config.js`, `.prettierrc`, `.husky/*`.
- Expected: lint passes on scaffold.
- Tests: `npm run lint`.
- Dependency: 0.5.
- Priority: P0. Difficulty: S.

---

## Phase 1: Correct Architecture (2–3 days)

### Task 1.1 — Replace setup.py with bootstrap script
- Objective: write `scripts/cf-bootstrap.ts` that provisions D1 + R2 + KV via Wrangler and patches `wrangler.jsonc` placeholders.
- Files: `scripts/cf-bootstrap.ts`, `wrangler.jsonc`.
- Expected: idempotent — re-run yields no changes.
- Tests: dry-run mode prints planned actions.
- Dependency: 0.2.
- Priority: P0. Difficulty: M.

### Task 1.2 — Final wrangler.jsonc
- Objective: copy spec config, drop `worker_loaders`, drop `ANALYTICS_INGEST_QUEUE`, comment out Vectorize, lock production scheduler to `manual`.
- Files: `wrangler.jsonc`.
- Expected: `wrangler types` generates a complete Env interface.
- Tests: `wrangler dev --remote=false` starts.
- Dependency: 1.1.
- Priority: P0. Difficulty: S.

### Task 1.3 — Define Env type centrally
- Objective: `src/server/env.ts` exports `Env`. Use `wrangler types` output as a starting point; extend with secrets and queue message types.
- Files: `src/server/env.ts`.
- Expected: type-checks all bindings.
- Tests: `npm run typecheck`.
- Dependency: 1.2.
- Priority: P0. Difficulty: S.

### Task 1.4 — Hono entrypoint with proper SPA + API split
- Objective: `src/server/index.ts` exports the Worker + DO classes + Workflow classes. Mount `/api/*`, `/mcp/*`, `/api/webhooks/stripe` (raw body), and SPA fallback. Lock CORS to `PUBLIC_APP_URL`. Wire `app.onError` and `app.notFound` to standard error envelope.
- Files: `src/server/index.ts`, `src/server/middleware/error.ts`.
- Expected: `/api/health` returns `{success:true,...}`; SPA loads.
- Tests: integration test via miniflare.
- Dependency: 1.3.
- Priority: P0. Difficulty: M.

---

## Phase 2: Data + Auth + Brand Foundation (5–7 days)

### Task 2.1 — Drizzle schema + first migration
- Objective: convert `DATABASE_SCHEMA.sql` to Drizzle (`src/server/db/schema.ts`) with CHECK constraints for status enums, add 6 missing tables (sessions, oauth_accounts, password column, invitations, webhooks_inbox, idempotency_keys), add 7 missing indexes. Generate migration `0001_initial.sql`.
- Files: `src/server/db/schema.ts`, `drizzle.config.ts`, `src/server/db/migrations/0001_initial.sql`.
- Expected: `wrangler d1 migrations apply mustbeviral --local` succeeds.
- Tests: integration: insert a row of every table.
- Dependency: 1.1.
- Priority: P0. Difficulty: M.

### Task 2.2 — Db client + tenancy helpers
- Objective: `src/server/db/client.ts` exposes Drizzle factory + tenant helpers (`scopeByWorkspace`, `scopeByBrand`).
- Files: `src/server/db/client.ts`.
- Expected: every query is workspace-scoped at the boundary.
- Tests: tenant-isolation test (audit 15).
- Dependency: 2.1.
- Priority: P0. Difficulty: S.

### Task 2.3 — Auth services + routes
- Objective: signup, login, logout, /me. Argon2id via `@noble/hashes/argon2id` (or PBKDF2 fallback). Session cookie? **Use Bearer token in `Authorization` header** to dodge CSRF. Store hashed tokens in `sessions`.
- Files: `src/server/services/auth/*`, `src/server/routes/auth.ts`, `src/server/middleware/auth.ts`, `src/shared/schemas/auth.ts`.
- Expected: signup → login → /me round-trip works.
- Tests: unit (hashing); integration (full round-trip); rate limit on login.
- Dependency: 2.1, 2.2.
- Priority: P0. Difficulty: M.

### Task 2.4 — RBAC middleware
- Objective: `requireAuth`, `requireWorkspaceMember`, `requireBrandAccess`, `requireAdmin`. Each fails closed, returns standard error envelope.
- Files: `src/server/middleware/rbac.ts`.
- Expected: cross-tenant attempts → 403.
- Tests: tenant-isolation matrix.
- Dependency: 2.3.
- Priority: P0. Difficulty: S.

### Task 2.5 — Workspace + brand CRUD
- Objective: routes for create/list/get/update/delete (soft) workspaces and brands. Plan enforcement on `createBrand` (count check). Slug generation deterministic + collision-resistant.
- Files: `src/server/routes/workspaces.ts`, `src/server/routes/brands.ts`, services.
- Expected: full CRUD with audit logs.
- Tests: integration.
- Dependency: 2.4.
- Priority: P0. Difficulty: M.

### Task 2.6 — UI shell + signup/login + brand switcher
- Objective: build React Router routes `/login`, `/signup`, `/app`, `/app/create-brand`. Implement `AppShell`, `BrandSwitcher`, `WorkspaceSwitcher`, `CommandBar` skeletons.
- Files: `src/client/routes/*`, `src/client/components/layout/*`.
- Expected: pixel-correct shell; brand switcher operates against API.
- Tests: smoke component tests.
- Dependency: 2.5.
- Priority: P0. Difficulty: M.

### Task 2.7 — Idempotency + audit + rate-limit + cost-guard middleware
- Objective: ship the four cross-cutting middleware as no-op-friendly helpers used everywhere.
- Files: `src/server/middleware/{idempotency,audit,rate-limit,cost-guard}.ts`, KV key conventions.
- Expected: each middleware passes unit tests.
- Tests: unit + integration.
- Dependency: 2.4.
- Priority: P0. Difficulty: M.

### Task 2.8 — SSRF guard + untrusted-content sanitizer
- Objective: `assertSafeUrl(url)` and `sanitizeUntrusted(text)` + a wrapping helper for prompts.
- Files: `src/server/services/security/*`.
- Expected: blocked-host matrix passes; sanitizer escapes injection bait.
- Tests: unit (~40 cases for SSRF).
- Dependency: 2.4.
- Priority: P0. Difficulty: S.

---

## Phase 3: Agents + Workflows (7–10 days)

### Task 3.1 — MarketingAgent shell
- Objective: full state shape from `AGENT_SPEC.md`; all ~20 callable signatures with mocked bodies; `onWorkflow*` callbacks; `this.schedule` weekly report stub; broadcast schema.
- Files: `src/server/agents/MarketingAgent.ts`, `src/shared/schemas/agent-broadcast.ts`.
- Expected: every callable returns Zod-validated mock data.
- Tests: state transitions, RBAC re-check.
- Dependency: 2.4.
- Priority: P0. Difficulty: L.

### Task 3.2 — Agent route bridge
- Objective: `src/server/routes/agents.ts` forwards calls to `MarketingAgent` via `idFromName(brandId)`.
- Files: routes file.
- Expected: every callable round-trips from Hono.
- Tests: integration.
- Dependency: 3.1.
- Priority: P0. Difficulty: S.

### Task 3.3 — BrandOnboardingWorkflow with mocks
- Objective: full 23-step workflow; each step writes to D1 and reports progress to agent. External calls (Browser Run, model router) wrapped behind interfaces with fake implementations under `APP_ENV=development`.
- Files: `src/server/workflows/BrandOnboardingWorkflow.ts`, `src/server/services/...`.
- Expected: end-to-end run produces a brand_profile_versions row + marketing_scores + content_calendars (mock) + content_posts (mock) in D1.
- Tests: integration with miniflare; idempotency on retry.
- Dependency: 3.1.
- Priority: P0. Difficulty: L.

### Task 3.4 — Scan UI + intelligence report UI
- Objective: build `/app/brands/:brandId/scan` (live timeline via WebSocket) and `/app/brands/:brandId/intelligence` (rich report, evidence, score cards).
- Files: routes + components per `UI_WIREFRAMES.md`.
- Expected: live progress + report renders against mock data.
- Tests: smoke.
- Dependency: 3.3, 2.6.
- Priority: P0. Difficulty: L.

### Task 3.5 — Brand profile editor + locks/regen
- Objective: `BrandProfileEditor`, `EditableBrandField`, `RegenerateFieldButton`, `FieldLockButton`. Audit log on every change. Versioning via `brand_profile_versions`.
- Files: routes + components + agent methods.
- Expected: edits persist; lock prevents regen overwrite.
- Tests: integration.
- Dependency: 3.4.
- Priority: P1. Difficulty: M.

### Task 3.6 — ContentCalendarWorkflow
- Objective: real generation (mocked in dev) producing 30 posts × N variants, attached to a calendar row.
- Files: workflow + services.
- Expected: idempotent, retryable, audited.
- Tests: integration.
- Dependency: 3.3.
- Priority: P0. Difficulty: L.

### Task 3.7 — Calendar UI (month/week/platform views)
- Objective: render posts; click → drawer; status filters.
- Files: routes + components.
- Expected: 30 posts render with platform color coding.
- Tests: smoke.
- Dependency: 3.6.
- Priority: P0. Difficulty: M.

### Task 3.8 — Approval queue
- Objective: desktop queue + mobile swipe queue + batch toolbar + keyboard shortcuts.
- Files: routes + components + agent methods (approve/reject/regenerate).
- Expected: state machine enforced; audit logged.
- Tests: integration.
- Dependency: 3.6, 3.2.
- Priority: P0. Difficulty: M.

### Task 3.9 — ManualExportAdapter + ApprovalSchedulingWorkflow
- Objective: write `SchedulerProvider` interface; ManualExportAdapter implementation; workflow that re-checks approval status and writes scheduled_posts.
- Files: `src/server/services/scheduler/*`, `src/server/workflows/ApprovalSchedulingWorkflow.ts`.
- Expected: a brand can fully execute the journey with `provider=manual`.
- Tests: integration; failure-fallback.
- Dependency: 3.8.
- Priority: P0. Difficulty: M.

### Task 3.10 — Image generation (mocked)
- Objective: ImageGenerationWorkflow + R2 storage + Cloudflare Images variants. Capability probe; FLUX.1 fallback for MVP.
- Files: workflow + services.
- Expected: a generated R2 key persists; variants resolved via Images URL.
- Tests: integration.
- Dependency: 3.6.
- Priority: P1. Difficulty: M.

### Task 3.11 — DM rule CRUD (no provider activation)
- Objective: schema CRUD + UI; `requires_approval=1` default; provider activation gated.
- Files: routes + components + workflow stub.
- Expected: rules can be drafted; not yet pushed to provider.
- Tests: integration.
- Dependency: 2.5.
- Priority: P2. Difficulty: M.

### Task 3.12 — WeeklyReportWorkflow + Reports UI
- Objective: schedule on agent; produce JSON + PDF (`pdf-lib`); store in R2; render in UI.
- Files: workflow + service + routes/components.
- Expected: empty-data and full-data modes both render.
- Tests: integration.
- Dependency: 3.6.
- Priority: P1. Difficulty: M.

### Task 3.13 — GrowthOpportunityWorkflow + UI
- Objective: dedup against existing; evidence required; create-campaign action.
- Files: workflow + service + routes/components.
- Expected: opportunities have evidence and link to campaigns.
- Tests: integration.
- Dependency: 3.5, 3.6.
- Priority: P2. Difficulty: M.

---

## Phase 4: Real LLM Integration (3–5 days)

### Task 4.1 — Model router with capability probe
- Objective: pick provider per tier; AI Gateway routing; fallback on failure; recordUsage everywhere.
- Files: `src/server/services/model-router.ts`, providers.
- Expected: switching `DEFAULT_TEXT_MODEL` works; cost recorded.
- Tests: unit on routing decision; integration with mocked providers.
- Dependency: 1.3.
- Priority: P0. Difficulty: M.

### Task 4.2 — Prompt template store
- Objective: versioned prompts under `src/server/prompts/`; each prompt has Zod input/output schema; snapshot tests.
- Files: prompts + tests.
- Expected: prompt version bump fails snapshot until accepted.
- Tests: snapshot.
- Dependency: 4.1.
- Priority: P0. Difficulty: S.

### Task 4.3 — Compliance reviewer
- Objective: forbidden phrase list; risk classifier (LLM call w/ schema); apply to every generated post insert.
- Files: `src/server/services/compliance/*`.
- Expected: posts with forbidden phrases blocked or flagged.
- Tests: unit.
- Dependency: 4.1.
- Priority: P0. Difficulty: S.

### Task 4.4 — Replace mocks in onboarding/calendar/image workflows
- Objective: progressively swap fake services for real LLM calls behind cost guard + compliance.
- Files: services.
- Expected: feature-flag gated; can flip on per-environment.
- Tests: integration.
- Dependency: 4.1–4.3, 3.3, 3.6, 3.10.
- Priority: P0. Difficulty: L.

---

## Phase 5: Billing + Admin (4–6 days)

### Task 5.1 — Stripe checkout + portal
- Objective: routes for checkout-session and portal; create customer on first checkout.
- Files: `src/server/routes/billing.ts`, services.
- Expected: from /app/settings/billing user can subscribe.
- Tests: integration with Stripe test mode.
- Dependency: 2.5.
- Priority: P0. Difficulty: M.

### Task 5.2 — Stripe webhook + plan transitions
- Objective: raw-body verification; webhooks_inbox idempotency; subscription state mapping.
- Files: webhook route + service.
- Expected: lifecycle events update `subscriptions` correctly.
- Tests: webhook fixture set.
- Dependency: 5.1.
- Priority: P0. Difficulty: M.

### Task 5.3 — Plan enforcement
- Objective: `plans.ts` source of truth; checks at brand-create, calendar-generate, image-generate, scheduler-connect, DM-toggle, autonomy slider.
- Files: `src/server/services/billing/plans.ts`, integration points.
- Expected: limits enforced server-side.
- Tests: unit per check.
- Dependency: 5.2.
- Priority: P0. Difficulty: M.

### Task 5.4 — Admin dashboard
- Objective: /app/admin pages: overview, workflows (with retry), agent runs, usage, audit, billing.
- Files: routes + components + admin API.
- Expected: admins can retry failed workflows.
- Tests: smoke.
- Dependency: 2.5, 5.3.
- Priority: P1. Difficulty: M.

---

## Phase 6: Hardening, Tests, Deploy (5–7 days)

### Task 6.1 — Security headers middleware
- Objective: CSP, HSTS, X-CTO, Referrer-Policy, Permissions-Policy; pinned and tested.
- Files: middleware.
- Expected: securityheaders.com / observatory.mozilla.org A grade.
- Tests: integration on response headers.
- Dependency: 1.4.
- Priority: P0. Difficulty: S.

### Task 6.2 — Structured logging + observability
- Objective: `log()` helper; standard JSON shape with traceId; Logpush configured (optional).
- Files: `src/server/services/observability/log.ts`.
- Expected: every request emits a structured log line.
- Tests: snapshot.
- Dependency: 1.4.
- Priority: P1. Difficulty: S.

### Task 6.3 — Tests to coverage thresholds
- Objective: hit `lines >= 80%` on `src/server/**`; tenant isolation matrix; webhook fixtures; SSRF table; compliance fixtures; idempotency and cost guard tests.
- Files: `tests/**`, `vitest.config.ts`.
- Expected: CI fails when below thresholds.
- Tests: itself.
- Dependency: most of Phase 2–5.
- Priority: P0. Difficulty: L.

### Task 6.4 — E2E onboarding journey
- Objective: Playwright flow signup → workspace → brand → onboarding (mocked external) → approval → manual schedule → weekly report stub.
- Files: `tests/e2e/*`.
- Expected: green on staging.
- Tests: itself.
- Dependency: 5.4, 3.12.
- Priority: P0. Difficulty: M.

### Task 6.5 — CI pipeline
- Objective: GitHub Actions workflow per audit 16.
- Files: `.github/workflows/ci.yml`.
- Expected: every PR runs typecheck/lint/test/build; main deploys staging + e2e; manual gate for production.
- Tests: workflow runs.
- Dependency: 6.3.
- Priority: P0. Difficulty: S.

### Task 6.6 — Staging deploy + smoke
- Objective: deploy staging; run E2E + smoke; capture observability baseline.
- Files: deployment runbook updates.
- Expected: green smoke; latency baseline captured.
- Tests: e2e + smoke.
- Dependency: 6.5.
- Priority: P0. Difficulty: S.

### Task 6.7 — Production launch checklist
- Objective: provision prod resources; secrets; Stripe live products; CSP/CORS allowed origins; status page; on-call/escalation; rollback plan.
- Files: `docs/runbooks/production-launch.md`.
- Expected: signed-off checklist.
- Tests: pre-launch dry-run.
- Dependency: 6.6.
- Priority: P0. Difficulty: M.

---

## Ordering Summary

| Phase | Days | Outputs |
|---|---:|---|
| 0 Stabilize | 1–2 | Scaffold, git, deps, ts, lint |
| 1 Architecture | 2–3 | Wrangler, Env, Hono entry, bootstrap script |
| 2 Foundation | 5–7 | DB, auth, RBAC, middleware, brand CRUD, UI shell |
| 3 Agents+Workflows (mocked) | 7–10 | Agent shell, all 7 workflows, scan/intelligence/calendar/approvals UI, manual scheduler |
| 4 Real LLM | 3–5 | Model router, prompts, compliance, mocks→real |
| 5 Billing+Admin | 4–6 | Stripe, plan enforcement, admin dashboard |
| 6 Hardening | 5–7 | Security headers, logs, tests, CI, staging, prod launch |
| **Total** | **27–40 days** | |

About 6–8 calendar weeks at one focused engineer's pace, faster with two.
