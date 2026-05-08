# CLAUDE_CODE_FIX_ROADMAP.md

A precise sequence of prompts for Claude Code / Codex to execute. Each prompt is self-contained: goal, files to inspect, files to edit, what NOT to touch, acceptance criteria, run commands, and failure conditions. Run prompts **in order**. Do not skip; do not advance with failing checks. Append to `audit/FIX_LOG.md` after each prompt.

The first 16 prompts replace the spec's `setup.py` flow and prepare the ground. Prompts 17–60 implement the product. Prompts 61–66 harden and ship.

---

## Phase 0 — Stabilize

### Prompt 1: Decide auth scheme and lock the decision
Goal: choose between custom-email-password vs `openauth-template`. Lock with an ADR.
Inspect:
- `audit/06_DATABASE_AUDIT.md` (Missing Tables)
- `audit/11_SECURITY_AUDIT.md` (C1)
Edit:
- Create `docs/decisions/0001-auth.md` with the choice (recommend custom + sessions in D1) and reasoning.
Do not touch:
- Anything else.
Acceptance criteria:
- ADR exists; references this audit.
Run:
- none.
Failure conditions:
- ADR is vague or doesn't pick a single approach.

### Prompt 2: Scaffold from Cloudflare template
Goal: scaffold the project from `cloudflare/templates/react-router-hono-fullstack-template`.
Inspect:
- `audit/04_ARCHITECTURE_AUDIT.md`, `audit/16_BUILD_DEPLOYMENT_AUDIT.md`.
Edit:
- Run `npm create cloudflare@latest -- mustbeviral --template=cloudflare/templates/react-router-hono-fullstack-template --no-deploy --git`. Move generated files to repo root (or accept the new subdirectory and adjust cwd). Move `mustbeviral_system_dna_extracted/` to `docs/system-dna/`. Move `audit/` into the project root.
Do not touch:
- Don't run `wrangler deploy`.
Acceptance criteria:
- `npm install && npm run dev` serves the template page.
Run:
- `npm install`
- `npm run typecheck`
- `npm run build`
Failure conditions:
- typecheck or build fails on the bare scaffold.

### Prompt 3: Pin dependency versions and commit lockfile
Goal: pin all `dependencies` and `devDependencies` to exact versions matching the template. Commit `package-lock.json`.
Inspect:
- generated `package.json`.
Edit:
- `package.json` (replace any `^` or `latest` with exact versions).
Do not touch:
- source code.
Acceptance criteria:
- `npm ci` succeeds clean.
Run:
- `npm ci`, `npm run typecheck`, `npm run build`.
Failure conditions:
- non-reproducible install.

### Prompt 4: Add strict tsconfig + ESLint + Prettier + Husky
Goal: enforce strict TS + lint hygiene + pre-commit hook.
Inspect:
- `audit/17_CODE_QUALITY_AUDIT.md`.
Edit:
- `tsconfig.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, decorator config), `eslint.config.js`, `.prettierrc`, `.husky/pre-commit`, `package.json` scripts (`lint`, `format`).
Do not touch:
- existing build pipeline.
Acceptance criteria:
- `npm run typecheck && npm run lint` pass on bare scaffold.
Run:
- `npm run typecheck`, `npm run lint`, `npm run build`.
Failure conditions:
- tsconfig too loose; lint disabled.

### Prompt 5: Move spec docs and audit into the project
Goal: place `docs/system-dna/` (the extracted spec set) and `audit/` (this audit) at the project root, alongside `docs/`.
Inspect:
- `mustbeviral_system_dna_extracted/`, `audit/`.
Edit:
- file moves only.
Do not touch:
- code.
Acceptance criteria:
- `docs/system-dna/MASTER_EXECUTION_PACKAGE.md` exists; `audit/MASTER_AUDIT_REPORT.md` exists.
Run:
- `git status`.
Failure conditions:
- spec docs missing.

### Prompt 6: Replace bundled wrangler.jsonc with the spec version, scoped down
Goal: copy `docs/system-dna/wrangler.jsonc` to project root with three changes: drop `worker_loaders`, drop `ANALYTICS_INGEST_QUEUE`, comment out Vectorize. Production `DEFAULT_SCHEDULER_PROVIDER` stays `manual` until Vista is verified.
Inspect:
- `audit/05_CLOUDFLARE_COMPATIBILITY_AUDIT.md`.
Edit:
- `wrangler.jsonc`.
Do not touch:
- DOs, Workflow bindings (keep all 7), Queues `POST_PUBLISH_QUEUE`.
Acceptance criteria:
- `wrangler types` runs without unknown-binding errors (placeholders OK).
Run:
- `npx wrangler types`, `npm run typecheck`.
Failure conditions:
- worker_loaders still present; analytics queue still present.

### Prompt 7: Build cf-bootstrap script
Goal: write `scripts/cf-bootstrap.ts` (Node, run via `tsx`) that creates D1, R2, KV resources via `wrangler` CLI, captures IDs, and patches `wrangler.jsonc` placeholders. Idempotent.
Inspect:
- `audit/05_CLOUDFLARE_COMPATIBILITY_AUDIT.md`.
Edit:
- `scripts/cf-bootstrap.ts`, `package.json` scripts (`bootstrap:cf`).
Do not touch:
- existing wrangler.jsonc structure.
Acceptance criteria:
- dry-run mode prints planned `wrangler` commands; real run patches placeholders if not already real IDs.
Run:
- `npm run bootstrap:cf -- --dry-run`.
Failure conditions:
- script writes secrets; script not idempotent.

### Prompt 8: Define Env type + load secrets via `wrangler secret`
Goal: create `src/server/env.ts` with the full `Env` interface (audit 05). Document secrets via `.env.example`.
Inspect:
- `audit/05_CLOUDFLARE_COMPATIBILITY_AUDIT.md`, `docs/system-dna/DEPLOYMENT_RUNBOOK.md`.
Edit:
- `src/server/env.ts`, `.env.example`.
Do not touch:
- secrets (must come from `wrangler secret put` only).
Acceptance criteria:
- typecheck passes; no `as any`.
Run:
- `npm run typecheck`.
Failure conditions:
- secrets in `.env` committed; missing bindings in `Env`.

---

## Phase 1 — Foundation

### Prompt 9: Hono entrypoint with API + SPA fallback + error envelope
Goal: scaffold `src/server/index.ts` exporting Worker + DO + Workflow classes; mount `/api/*` group, raw-body Stripe webhook route, `/mcp/*`, SPA catch-all. Lock CORS to `PUBLIC_APP_URL`. Implement `app.onError`/`app.notFound` returning `{success:false,error:{code,message,...}}`.
Inspect:
- `audit/09_API_AUDIT.md`, `audit/14_BILLING_AUDIT.md`.
Edit:
- `src/server/index.ts`, `src/server/middleware/error.ts`, `src/server/middleware/cors.ts`.
Do not touch:
- DO/Workflow internals.
Acceptance criteria:
- `/api/health` returns success envelope; SPA loads.
Run:
- `npm run dev`, hit `/api/health`.
Failure conditions:
- CORS `*`; non-standard error shape; webhook route accidentally JSON-parsed.

### Prompt 10: Drizzle schema + initial migration
Goal: convert `docs/system-dna/DATABASE_SCHEMA.sql` to Drizzle (`src/server/db/schema.ts`) with the additions from `audit/06_DATABASE_AUDIT.md` (sessions, oauth_accounts, password column, invitations, webhooks_inbox, idempotency_keys, missing indexes, CHECK constraints).
Inspect:
- `audit/06_DATABASE_AUDIT.md`.
Edit:
- `src/server/db/schema.ts`, `drizzle.config.ts`, `src/server/db/migrations/0001_initial.sql` (generated).
Do not touch:
- migration files once committed.
Acceptance criteria:
- `wrangler d1 migrations apply mustbeviral --local` succeeds; round-trip insert succeeds for every table in a test.
Run:
- `wrangler d1 migrations apply mustbeviral --local`, `npm run test`.
Failure conditions:
- placeholder migration; missing tables; missing checks.

### Prompt 11: Drizzle client + tenancy helpers
Goal: `src/server/db/client.ts` exporting a `db(env)` factory and `scopeByWorkspace(qb, workspaceId)`, `scopeByBrand(qb, brandId)` helpers.
Inspect:
- `audit/06_DATABASE_AUDIT.md`, `audit/11_SECURITY_AUDIT.md`.
Edit:
- `src/server/db/client.ts`, `src/server/db/types.ts`.
Acceptance criteria:
- typecheck passes; tenancy helper used in 3+ test queries.
Run:
- `npm run typecheck`, `npm run test`.
Failure conditions:
- raw queries without tenant scoping.

### Prompt 12: Auth services + routes (Phase 0 decision applied)
Goal: implement chosen auth (per Prompt 1). For custom: Argon2id via `@noble/hashes`, Bearer tokens stored hashed in `sessions`, signup/login/logout/me + rate limit on login.
Inspect:
- `audit/11_SECURITY_AUDIT.md` (C1, H1, H2), `audit/09_API_AUDIT.md`.
Edit:
- `src/server/services/auth/*`, `src/server/routes/auth.ts`, `src/server/middleware/auth.ts`, `src/shared/schemas/auth.ts`.
Do not touch:
- billing routes, brand routes.
Acceptance criteria:
- signup → login → /me round-trip; failed-login lockout; CSRF-free design.
Run:
- `npm run test`, `npm run typecheck`.
Failure conditions:
- plaintext passwords logged; cookies with SameSite=None; missing rate limit.

### Prompt 13: RBAC middleware
Goal: `requireAuth`, `requireWorkspaceMember`, `requireBrandAccess`, `requireAdmin`. All return `{success:false,error}` envelope on failure.
Inspect:
- `audit/11_SECURITY_AUDIT.md`, `audit/09_API_AUDIT.md`.
Edit:
- `src/server/middleware/rbac.ts`.
Acceptance criteria:
- tenant-isolation tests (cross-workspace, cross-brand, non-admin) → 403.
Run:
- `npm run test`.
Failure conditions:
- missing checks; query that doesn't scope by workspace.

### Prompt 14: Idempotency, audit, rate-limit, cost-guard middleware
Goal: ship the four cross-cutting middleware. Cost guard reads MTD usage from KV summary (if present) or D1 fallback.
Inspect:
- `audit/09_API_AUDIT.md`, `audit/11_SECURITY_AUDIT.md`, `audit/12_AI_COST_AUDIT.md`.
Edit:
- `src/server/middleware/{idempotency,audit,rate-limit,cost-guard}.ts`, `src/server/services/cost/recorder.ts`.
Acceptance criteria:
- unit + integration tests pass for each.
Run:
- `npm run test`.
Failure conditions:
- guards not gated by env feature flags; missing KV key conventions.

### Prompt 15: SSRF guard + untrusted-content sanitizer
Goal: `src/server/services/security/url-guard.ts` + `untrusted.ts`. URL guard resolves DNS, blocks RFC1918/loopback/link-local/metadata; sanitizer escapes/wraps untrusted text for safe prompt insertion.
Inspect:
- `audit/11_SECURITY_AUDIT.md` (C2, C3), `audit/12_AI_COST_AUDIT.md`.
Edit:
- security service files; tests covering ~40 cases for SSRF.
Acceptance criteria:
- fixed test matrix passes.
Run:
- `npm run test`.
Failure conditions:
- false-positive on legit hosts; false-negative on metadata IPs.

### Prompt 16: Workspace + brand CRUD with plan enforcement stub
Goal: routes for workspaces and brands; brand creation guarded by per-plan `maxBrands` (read from a placeholder `plans.ts` until Stripe lands); soft delete; slug generation.
Inspect:
- `audit/09_API_AUDIT.md`, `audit/14_BILLING_AUDIT.md`.
Edit:
- `src/server/routes/workspaces.ts`, `src/server/routes/brands.ts`, `src/server/services/billing/plans.ts` (stub), Zod schemas in `src/shared/schemas/`.
Acceptance criteria:
- CRUD round-trips with audit logs; soft delete filters work.
Run:
- `npm run test`, `npm run typecheck`.
Failure conditions:
- hard deletes; missing audit; raw SQL.

### Prompt 17: UI shell — AppShell + Sidebar + Topbar + BrandSwitcher + Workspaceswitcher + CommandBar
Goal: build the layout per `UI_WIREFRAMES.md` global shell. Pull data via TanStack Query.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md`, `docs/system-dna/COMPONENT_MAP.md`, `audit/10_UI_UX_AUDIT.md`.
Edit:
- `src/client/routes/_app.tsx` (or React Router data-route equivalent), `src/client/components/layout/*`.
Acceptance criteria:
- layout renders; brand switcher uses real API.
Run:
- `npm run dev`; manual verify.
Failure conditions:
- no skeletons / error states; chat-first creep.

### Prompt 18: Login + Signup pages
Goal: build `/login`, `/signup` with React Hook Form + Zod; show inline errors; rate-limit feedback.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md` `/signup`, `audit/10_UI_UX_AUDIT.md`.
Edit:
- `src/client/routes/login.tsx`, `signup.tsx`; `src/client/components/auth/*`.
Acceptance criteria:
- signup → login → land on /app.
Run:
- `npm run dev`; smoke.
Failure conditions:
- no validation; password sent as query param.

### Prompt 19: Create-brand flow
Goal: `/app/create-brand` form per spec; calls `POST /api/brands`; redirects to `/app/brands/:brandId/scan`.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md` `/app/create-brand`, `audit/03_PRODUCT_LOGIC_AUDIT.md`.
Edit:
- `src/client/routes/create-brand.tsx`, components.
Acceptance criteria:
- creating a brand kicks off onboarding mock workflow.
Run:
- e2e smoke.
Failure conditions:
- form submits without URL validation; no SSRF check on website URL server-side.

---

## Phase 2 — Agents and Workflows (Mocked)

### Prompt 20: MarketingAgent shell with all callable methods (mocked)
Goal: full state shape + ~20 callable methods. Each method validates input via Zod, re-checks RBAC (calling Hono via callback or via injected db), returns plausible mock data. Add `onWorkflowProgress/Complete/Error` callbacks; `this.schedule` for weekly report stub.
Inspect:
- `audit/07_AGENTS_AUDIT.md`, `docs/system-dna/AGENT_SPEC.md`.
Edit:
- `src/server/agents/MarketingAgent.ts`, `src/shared/schemas/agent-broadcast.ts`.
Acceptance criteria:
- every callable round-trips through Hono → DO → DO state mutation → response.
Run:
- `npm run test`, integration tests.
Failure conditions:
- one method missing; broadcast has no schema.

### Prompt 21: Agent route bridge
Goal: `src/server/routes/agents.ts` forwards calls to MarketingAgent via `idFromName(brandId)`.
Inspect:
- `audit/09_API_AUDIT.md`, `audit/07_AGENTS_AUDIT.md`.
Edit:
- agents route + helper.
Acceptance criteria:
- callers verified workspace-scoped before forwarding.
Run:
- integration.
Failure conditions:
- bridge skips RBAC.

### Prompt 22: WebSocket channel for agent progress
Goal: `/api/brands/:brandId/agent` WebSocket route; client subscribes; server uses `Agent.broadcast` to fanout.
Inspect:
- `audit/07_AGENTS_AUDIT.md`, `audit/10_UI_UX_AUDIT.md`.
Edit:
- agents route, hooks `src/client/hooks/useAgentSocket.ts`.
Acceptance criteria:
- live state updates visible in `/app/brands/:brandId/scan`.
Run:
- e2e smoke.
Failure conditions:
- unauthenticated WS access.

### Prompt 23: BrandOnboardingWorkflow with mocked external services
Goal: full 23-step workflow per `WORKFLOWS_SPEC.md`. External services (Browser Run, model router, image gen) are interfaces with fake impl in `APP_ENV=development`.
Inspect:
- `docs/system-dna/WORKFLOWS_SPEC.md`, `audit/08_WORKFLOWS_AUDIT.md`.
Edit:
- `src/server/workflows/BrandOnboardingWorkflow.ts`, `src/server/services/{browser,model-router,image-gen}/*` (interfaces + fakes).
Acceptance criteria:
- run produces `brand_profile_versions`, `marketing_scores`, `target_market_reports`, `content_calendars`, `content_posts` rows; agent state transitions; `workflow_runs` updated.
Run:
- integration.
Failure conditions:
- step results > 1MB; non-idempotent steps; agent never updated.

### Prompt 24: Scan UI — ScanProgressTimeline + EvidenceFeed
Goal: `/app/brands/:brandId/scan` consumes the WS channel + `workflow_runs` poll fallback. Shows steps, evidence cards, screenshots from R2.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md`, `audit/10_UI_UX_AUDIT.md`.
Edit:
- routes + components.
Acceptance criteria:
- timeline renders during a mocked workflow.
Run:
- e2e.
Failure conditions:
- spinner-only UI; no manual-intervention banner support.

### Prompt 25: Brand intelligence report UI
Goal: `/app/brands/:brandId/intelligence` rendering scores + summary + evidence + opportunities + calendar preview.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md`.
Edit:
- routes + components.
Acceptance criteria:
- against mocked data, renders fully; evidence links resolve.
Run:
- e2e smoke.
Failure conditions:
- evidence missing; no print/export option.

### Prompt 26: Brand profile editor with locks and regen
Goal: `/app/brands/:brandId/profile` with editable fields, lock toggles, regenerate field action; versions endpoint + history.
Inspect:
- `docs/system-dna/UI_WIREFRAMES.md`, `audit/06_DATABASE_AUDIT.md` (brand_profile_versions).
Edit:
- routes + components + agent methods (`updateBrandProfile`, `lockBrandField`, `regenerateBrandField`).
Acceptance criteria:
- audit logs every edit; lock blocks regen.
Run:
- integration.
Failure conditions:
- no audit; no version history.

### Prompt 27: Content calendar workflow
Goal: implement `ContentCalendarWorkflow` real-flow (still mocked for model calls). Produces 30 posts × variants.
Inspect:
- `docs/system-dna/WORKFLOWS_SPEC.md`, `audit/08_WORKFLOWS_AUDIT.md`.
Edit:
- workflow + services.
Acceptance criteria:
- regenerate creates a new calendar; old kept as `status='archived'`.
Run:
- integration.
Failure conditions:
- duplicates; no archive.

### Prompt 28: Calendar UI (month/week/platform)
Goal: render posts; click → drawer; status filters.
Edit:
- routes + components.
Acceptance criteria:
- 30 posts render; mobile list view works.
Run:
- e2e smoke.
Failure conditions:
- horizontal scroll on mobile.

### Prompt 29: Approval queue (desktop)
Goal: `/app/brands/:brandId/approvals` desktop UI + batch toolbar + keyboard shortcuts.
Edit:
- routes + components + agent methods (approve/reject/regenerate, batch).
Acceptance criteria:
- approve/reject/regenerate transitions correctly; batch APIs exist.
Run:
- integration + e2e.
Failure conditions:
- state machine bypass; no audit.

### Prompt 30: Approval queue (mobile swipe)
Goal: mobile swipe approval; haptics-style feedback; undo.
Edit:
- routes + components.
Acceptance criteria:
- iOS Safari smoke pass.
Run:
- Playwright mobile profile.
Failure conditions:
- accidental approvals on edge swipes.

### Prompt 31: ManualExportAdapter + ApprovalSchedulingWorkflow
Goal: `SchedulerProvider` interface from `audit/13`. Implement Manual adapter (DB-only); workflow re-checks approval; writes `scheduled_posts`.
Edit:
- `src/server/services/scheduler/types.ts`, `manual.ts`; workflow.
Acceptance criteria:
- a manually scheduled post has `provider='manual'`; CSV export endpoint serves correctly.
Run:
- integration.
Failure conditions:
- silent failures; missing CSV download UI.

### Prompt 32: ImageGenerationWorkflow with FLUX capability probe
Goal: probe Workers AI catalog; pick FLUX.1 schnell if FLUX.2 ids missing; store original in R2; create Cloudflare Images variants metadata; attach to post.
Inspect:
- `audit/05_CLOUDFLARE_COMPATIBILITY_AUDIT.md`, `audit/12_AI_COST_AUDIT.md`.
Edit:
- workflow + services + provider probe.
Acceptance criteria:
- works with FLUX.1 fallback in dev; logs probe outcome.
Run:
- integration.
Failure conditions:
- hardcoded model id; failure cascades into the agent error state.

### Prompt 33: Media library UI
Goal: `/app/brands/:brandId/media` with grid, filters, drawer, generate variants action.
Edit:
- routes + components.
Acceptance criteria:
- upload + list + variant generate work.
Run:
- e2e smoke.
Failure conditions:
- public bucket assumptions.

### Prompt 34: Media uploads (R2 service)
Goal: server-side upload route with MIME allow-list + size cap; UUID-based R2 keys; signed URL helper for reads.
Inspect:
- `audit/11_SECURITY_AUDIT.md` (H4–H6).
Edit:
- `src/server/services/media/*`, `src/server/routes/media.ts`.
Acceptance criteria:
- only image MIME accepted; >10MB rejected; signed URL TTL ≤ 5 min.
Run:
- integration.
Failure conditions:
- unsigned download endpoint.

### Prompt 35: DM rule CRUD (no provider activation)
Goal: routes + UI for DM rule drafting; default `requires_approval=1`; provider activation flag off.
Edit:
- routes + components + workflow stub.
Acceptance criteria:
- rule lives in `status='draft'`; can be reviewed but never auto-pushed.
Run:
- integration.
Failure conditions:
- any auto-push.

### Prompt 36: Analytics ingest + summary route
Goal: `POST /api/brands/:brandId/analytics/ingest` for manual data entry / future provider; `GET /api/brands/:brandId/analytics/summary`.
Edit:
- routes + services.
Acceptance criteria:
- snapshots persist; summary aggregates correctly.
Run:
- integration.
Failure conditions:
- ingest accepts raw JSON without validation.

### Prompt 37: WeeklyReportWorkflow + reports UI
Goal: schedule on agent (Mon 09:00); `pdf-lib` PDF; R2 storage; UI list + viewer.
Edit:
- workflow + service + routes/components.
Acceptance criteria:
- empty + full data both render; PDF downloadable via signed URL.
Run:
- integration.
Failure conditions:
- PDF lib not Workers-compatible.

### Prompt 38: GrowthOpportunityWorkflow + UI
Goal: dedup against existing; evidence required; create-campaign action.
Edit:
- workflow + service + routes/components.
Acceptance criteria:
- opportunities have evidence and link to campaigns.
Run:
- integration.
Failure conditions:
- duplicates; no evidence requirement.

---

## Phase 3 — Real LLM Integration

### Prompt 39: Model router with capability probe and AI Gateway routing
Goal: `src/server/services/model-router.ts` with `generateText`, `generateImage`, `recordUsage`. Tier-based provider selection; fallback chain.
Inspect:
- `audit/12_AI_COST_AUDIT.md`.
Edit:
- model router + provider clients (`workers-ai`, `ai-gateway`, `moonshot`, `openai`, `anthropic`).
Acceptance criteria:
- `recordUsage` called for every model call; failure cascades to fallback once.
Run:
- unit + integration with mocked providers.
Failure conditions:
- direct `env.AI.run` calls outside the router.

### Prompt 40: Prompt template store + snapshot tests
Goal: versioned prompts under `src/server/prompts/` with Zod input/output schemas; snapshot tests on prompt content + output schema.
Edit:
- prompts directory + test fixtures.
Acceptance criteria:
- prompt change without bumping version fails snapshot.
Run:
- `npm run test`.
Failure conditions:
- prompts inlined in code.

### Prompt 41: Compliance reviewer service
Goal: forbidden phrase list + LLM-backed risk classifier; `reviewPost(post)` returns `{allow, reasons[], risk}`.
Inspect:
- `audit/11_SECURITY_AUDIT.md`, `audit/12_AI_COST_AUDIT.md`.
Edit:
- `src/server/services/compliance/*`.
Acceptance criteria:
- forbidden phrases blocked or flagged; high-risk posts force human approval.
Run:
- unit.
Failure conditions:
- bypass possible via case/whitespace tricks.

### Prompt 42: Replace mocks with real model calls in onboarding workflow
Goal: behind feature flag `USE_REAL_AI`, route LLM calls through model router. Cost guard wraps each call.
Inspect:
- `audit/12_AI_COST_AUDIT.md`.
Edit:
- workflow services.
Acceptance criteria:
- integration test with real AI in CI gated env passes; cost recorded.
Run:
- gated integration.
Failure conditions:
- runaway cost; missing recordUsage.

### Prompt 43: Replace mocks in calendar + image workflows
Goal: same as 42, for calendar generation and image generation.
Edit:
- workflow services.
Acceptance criteria:
- same as 42 + per-brand image cap enforced.
Run:
- integration.
Failure conditions:
- per-brand image cap not checked.

---

## Phase 4 — Billing + Admin

### Prompt 44: Plans + Stripe checkout + portal
Goal: `src/server/services/billing/plans.ts`; routes for checkout-session and portal; create Stripe customer on first checkout.
Inspect:
- `audit/14_BILLING_AUDIT.md`.
Edit:
- billing service + routes.
Acceptance criteria:
- end-to-end checkout in Stripe test mode succeeds.
Run:
- integration.
Failure conditions:
- direct Stripe calls outside service.

### Prompt 45: Stripe webhook handler with raw body + idempotency
Goal: `/api/webhooks/stripe`; raw-body verification; insert into `webhooks_inbox`; map events to subscription state.
Edit:
- webhook route + service.
Acceptance criteria:
- fixture set passes; duplicates no-op; missing signature → 400.
Run:
- integration.
Failure conditions:
- JSON middleware ate the body.

### Prompt 46: Plan enforcement everywhere
Goal: enforce `maxBrands`, monthly posts/images, scheduler providers, DM, autonomy max — at each integration point.
Edit:
- service-level checks (not route-only).
Acceptance criteria:
- unit tests per check; UI surfaces 451 with checkout link.
Run:
- integration.
Failure conditions:
- enforcement only in UI.

### Prompt 47: Admin dashboard pages
Goal: /app/admin pages: overview, workflows (with retry), agent runs, usage, audit, billing.
Inspect:
- `audit/10_UI_UX_AUDIT.md`, `audit/14_BILLING_AUDIT.md`.
Edit:
- routes + components + admin API.
Acceptance criteria:
- admin can retry a failed workflow; usage chart renders.
Run:
- e2e smoke.
Failure conditions:
- non-admins see admin pages.

### Prompt 48: MCP read-only server with admin auth
Goal: implement `MustBeViralMCP` with `list_brands`, `get_brand_profile`, `get_post`, `get_scan_summary` tools; mount at `/mcp/*`; admin-only.
Inspect:
- `audit/07_AGENTS_AUDIT.md`.
Edit:
- `src/server/mcp/*`, route.
Acceptance criteria:
- non-admin → 401; admin can list tools and read.
Run:
- integration.
Failure conditions:
- write tools present.

---

## Phase 5 — Observability + Hardening

### Prompt 49: Security headers middleware (CSP, HSTS, etc.)
Goal: ship strict CSP; HSTS; X-CTO; Referrer-Policy; Permissions-Policy.
Inspect:
- `audit/11_SECURITY_AUDIT.md` (M1–M5).
Edit:
- `src/server/middleware/security.ts`.
Acceptance criteria:
- securityheaders.com A/A+ on staging.
Run:
- integration on response headers.
Failure conditions:
- CSP allows `unsafe-inline` script.

### Prompt 50: Structured logging helper
Goal: `log()` helper emitting JSON `{ts, level, msg, traceId, userId, workspaceId, brandId, route, ...}`. Request logs traceId; errors include stack only in dev.
Edit:
- `src/server/services/observability/log.ts`, middleware to inject traceId.
Acceptance criteria:
- every request emits exactly one access log + zero+ error logs.
Run:
- snapshot test.
Failure conditions:
- secrets in logs.

### Prompt 51: Tenant isolation tests
Goal: matrix tests — for each protected resource, attempt access from a non-member; must return 403.
Inspect:
- `audit/15_TESTING_AUDIT.md`.
Edit:
- `tests/integration/tenant-isolation.test.ts`.
Acceptance criteria:
- comprehensive matrix passes.
Run:
- `npm run test`.
Failure conditions:
- any 200 response from a non-member request.

### Prompt 52: SSRF + URL guard tests
Goal: ~40-case fixture set on `assertSafeUrl`.
Edit:
- `tests/unit/url-guard.test.ts`.
Acceptance criteria:
- all cases pass.
Run:
- `npm run test`.
Failure conditions:
- any RFC1918 host accepted.

### Prompt 53: Stripe webhook fixture tests
Goal: webhook events fixture (`checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`, etc.).
Edit:
- `tests/integration/stripe-webhook.test.ts`.
Acceptance criteria:
- subscription state converges; duplicates no-op.
Run:
- `npm run test`.
Failure conditions:
- relies on mocked Stripe SDK without verifying signature path.

### Prompt 54: Compliance reviewer fixture tests
Goal: include malicious instructions, forbidden phrases, edge cases.
Edit:
- `tests/unit/compliance.test.ts`.
Acceptance criteria:
- fixtures pass; reviewer can't be tricked by Unicode look-alikes.
Run:
- `npm run test`.
Failure conditions:
- bypass via homoglyphs.

### Prompt 55: Rate limit + cost guard tests
Goal: window math + concurrency tests.
Edit:
- `tests/integration/{rate-limit,cost-guard}.test.ts`.
Acceptance criteria:
- 429 thrown at expected count; 451 thrown at cost ceiling.
Run:
- `npm run test`.
Failure conditions:
- counters drift on bursts.

### Prompt 56: Approval state machine + idempotency tests
Goal: invalid transitions rejected; idempotency key returns same response.
Edit:
- `tests/integration/{approvals,idempotency}.test.ts`.
Acceptance criteria:
- transition matrix passes.
Run:
- `npm run test`.
Failure conditions:
- duplicate side effects on retry.

### Prompt 57: E2E onboarding journey (Playwright)
Goal: signup → workspace → brand → onboarding mock → intelligence report → calendar → batch approve → manual schedule → weekly report stub.
Inspect:
- `audit/15_TESTING_AUDIT.md`.
Edit:
- `tests/e2e/onboarding.spec.ts`.
Acceptance criteria:
- green on Chromium + Mobile Safari.
Run:
- `npm run test:e2e`.
Failure conditions:
- selectors brittle; flakes.

### Prompt 58: CI pipeline
Goal: `.github/workflows/ci.yml` per `audit/16`; PR runs typecheck/lint/test/build; main deploys staging + e2e.
Edit:
- workflow file.
Acceptance criteria:
- PR fails on broken typecheck or test.
Run:
- workflow run on a sample PR.
Failure conditions:
- secrets in env logs; deploy without typecheck.

### Prompt 59: Provision Cloudflare staging resources + secrets
Goal: provision real D1/R2/KV in staging; `wrangler secret put` for each secret in `DEPLOYMENT_RUNBOOK.md`.
Edit:
- `wrangler.jsonc` (staging env values), runbook entries.
Acceptance criteria:
- `wrangler deploy --env staging --dry-run` passes.
Run:
- the deploy.
Failure conditions:
- secrets logged.

### Prompt 60: Staging deploy + smoke
Goal: deploy staging; run E2E + smoke; capture observability baseline.
Edit:
- runbook + smoke script.
Acceptance criteria:
- green smoke; latency baseline captured.
Run:
- `npm run deploy:staging`, `npm run test:e2e -- --base-url=$STAGING_URL`.
Failure conditions:
- regressions vs local.

### Prompt 61: Production launch checklist
Goal: walk through `audit/MASTER_AUDIT_REPORT.md` final checklist; sign off all items; provision production resources; deploy.
Edit:
- `docs/runbooks/production-launch.md`.
Acceptance criteria:
- every line item checked or accepted.
Run:
- the deploy.
Failure conditions:
- skipped item.

### Prompt 62: Observability dashboards + alerts
Goal: Cloudflare Workers Analytics + Logpush + simple alerting (email/Slack) on error spikes, cost spikes.
Edit:
- runbook + dashboard JSON if exporting.
Acceptance criteria:
- a synthetic error triggers an alert.
Run:
- chaos test.
Failure conditions:
- alerts noisy.

### Prompt 63: Disaster-recovery doc + first backup
Goal: D1 export schedule (daily); R2 lifecycle (versioning); restore drill.
Edit:
- `docs/runbooks/dr.md`.
Acceptance criteria:
- a restore drill against staging works.
Run:
- the drill.
Failure conditions:
- no documented rollback.

### Prompt 64: White-label reports placeholder (Phase 1.5 prep)
Goal: `weekly_reports.report_json` adds `branding: { logo_url?, accent_color? }` slot, surfaced in PDF generator behind feature flag.
Edit:
- service + schema (no migration if column exists).
Acceptance criteria:
- agency plan can preview a re-skinned PDF.
Run:
- snapshot.
Failure conditions:
- breaks default rendering.

### Prompt 65: Provider activation experiments (gated)
Goal: behind feature flags, attempt `VistaSocialAdapter.schedulePost` / `BufferAdapter.schedulePost` against a sandbox account. Document outcomes; fall back to manual on failure.
Edit:
- adapters + smoke scripts.
Acceptance criteria:
- experiments documented; default still manual.
Run:
- gated smoke.
Failure conditions:
- enabling a provider for all users.

### Prompt 66: Hardening pass — UI polish + accessibility
Goal: empty/loading/error primitives applied everywhere; axe-core audit; keyboard nav on approval queue and calendar.
Inspect:
- `audit/10_UI_UX_AUDIT.md`, `audit/15_TESTING_AUDIT.md`.
Edit:
- shared components + per-page audits.
Acceptance criteria:
- axe-core no critical issues; tab order natural.
Run:
- Playwright + axe-core.
Failure conditions:
- modal traps; empty pages.

---

## Append Rules

After completing each prompt, add to `audit/FIX_LOG.md`:

```
## Prompt N
- Files changed: <list>
- Tests run: typecheck=pass test=pass build=pass [+ e2e=pass when applicable]
- Result: <one paragraph>
- Remaining issues: <list>
```

Do not advance with failing checks. Do not skip. If a prompt's premise becomes wrong (e.g., FLUX.2 id confirmed live), update the prompt's notes and continue.
