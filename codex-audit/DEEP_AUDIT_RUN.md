# MustBeViral Deep Audit Run

## Baseline Gate (Run 19, 2026-05-10)
- typecheck: PASS — `npm run typecheck` exit 0; `worker-configuration.d.ts` regenerated with both staging and production env blocks.
- lint: PASS — `npm run lint` exit 0.
- test: PASS — `npm run test` exit 0, **12 files / 46 tests** green.
- build: PASS — `npm run build` exit 0; worker-entry 620 KB.
- audit: PASS — `npm audit --audit-level=high` reports 0 vulnerabilities.
- e2e: PASS — `npm run test:e2e` 6/6 across desktop Chromium + mobile WebKit. (One spurious failure during Phase 0 was traced to a stale `coinop-platform` dev server squatting on port 5173; killed and re-ran green.)
- diff hygiene: PASS (CRLF warnings only).
- cloudflare CLI: ✅ `wrangler whoami` authenticated as `ernijs.ansons@gmail.com`'s Account `d2897bdebfa128919bd89b265e6a712e`.
- git: ✅ `e104c0f` (Runs 1-17 production-grade hardening + audit corpus) pushed to `origin/master` on top of the historic Milestone 8 commit `1864c48`. 93 files changed, +17394 / -6535.
- stripe CLI: ✅ test-mode (`sk_test_*`) on account `acct_1SRvMXFMXFyeuIPx` (NxtSpin sandbox). 4 products, 4 monthly prices, 1 production webhook endpoint created.
- staging deploy: ✅ `mustbeviral-staging` version `88c739f1-3dfc-4f91-8984-229e5b623b1c` (final). `USE_MOCK_AI=false`. Bindings: D1 `04b2303a-...`, KV `158d36f8...`, R2 `mustbeviral-staging-media`. Smoke 21/21 PASS including real Workers AI Flux PNG (309 KB) written to staging R2.
- production deploy: ✅ `mustbeviral-production` version `15ce175b-4870-4005-9c83-f042f5831177` (replaces Milestone 8 `2f4ead0c-...`). Bindings: D1 `b9a428e0-...`, KV `ff374abd...`, R2 `mustbeviral-production-media`. Migration `0002_indexes_and_phase2.sql` applied. Smoke 21/21 PASS.
- stripe webhook smoke: ✅ tamper rejected with `INVALID_STRIPE_SIGNATURE`; replay first 200 with `dispatched.action: subscription_canceled` and second 200 with `replay: true` (against both staging and production webhook secrets).

## Executive Verdict (Run 19)
- Current ship state: **shipped: true**. Production runs the Run 1-17 hardened code; staging mirrors it with live Workers AI; Stripe test-mode is wired and signed-payload smoke is green.
- Vs Run 18: committed and pushed the dirty worktree (`e104c0f`), restored Wrangler CLI auth, wrote 13 secrets across staging + production, applied migration 0002 to production, redeployed both envs, and ran full smoke on both.
- Remaining gaps (do NOT block functional production but block public marketing launch):
  - **M-16** observability — Sentry / structured logs / dashboards still absent.
  - **Admin seed** — neither env has a seeded admin user, so the admin-positive smoke step is N/A (admin-deny smoke confirmed).
  - **Real test-mode Stripe Checkout** end-to-end — only signed-payload smoke has run. A `stripe trigger checkout.session.completed` against a Checkout session would close the operational Stripe gate.
  - **`staging.mustbeviral.com` DNS** — currently unset; smoke uses `curl --resolve` against a Cloudflare anycast IP. Functional but inconsistent with how Stripe webhooks reach the worker.
  - **Live Stripe activation** — explicitly out of scope for Run 19; deferred to a separate run with live-key authorisation.

## Baseline Gate (Run 18, 2026-05-10)
- typecheck: PASS — `npm run typecheck` exit 0; `worker-configuration.d.ts` regenerated after `wrangler.jsonc` staging-block patch.
- lint: PASS — `npm run lint` exit 0.
- test: PASS — `npm run test` exit 0, **12 files / 46 tests** (unchanged baseline; binding patch did not affect tests).
- build: PASS — `npm run build` exit 0; worker bundle 620 KB.
- audit: PASS (cached from Run 16; no dep changes).
- browser: PASS (cached from Run 16; no app code changes).
- diff hygiene: PASS (CRLF warnings only).
- cloudflare readiness via API MCP: ✅ Production verified live (D1/KV/R2). **NEW Run 18: staging provisioned and migrated.** D1 `mustbeviral-staging` (`04b2303a-d7b1-4773-8fd7-cb44bbff88cb`), KV `mustbeviral-staging-cache` (`158d36f839a54e5baac85bdcbcff8555`), R2 `mustbeviral-staging-media`. Schema verified: 38 tables / 39 indexes. `wrangler.jsonc` staging block patched with real IDs.
- cloudflare readiness via CLI: STILL BLOCKED — `npm run cf:readiness` exits 1 at `wrangler whoami` (user-side `wrangler login` required).
- git: ✅ Remote configured Run 18: `origin → https://github.com/ernijsansons/MustBeViral.git` (private). `master` pushed (currently the historic Milestone 8 commit `1864c48`; Run 1-17 dirty worktree not yet committed).
- git status summary: dirty worktree preserved; Run 18 touched `wrangler.jsonc` (staging block) plus audit/build docs (`17_GAP_REGISTER.md`, `19_RELEASE_GO_NO_GO.md`, `KNOWN_FAILURES.md`, `DEEP_AUDIT_RUN.md`, `NEXT_EXECUTION_PLAN.md`, `FIX_LOG.md`, `final-strategy/BUILD_LOG.md`). No source files modified.

## Executive Verdict (Run 18)
- Current ship state: **shipped: pending**. Local gates green; staging Cloudflare resources provisioned and migrated; Git remote configured + `master` pushed.
- Vs Run 17: staging D1/KV/R2 provisioned via API MCP (M-17 closed); `wrangler.jsonc` staging block patched with real IDs and revalidated; GitHub repo `ernijsansons/MustBeViral` (private) created and `master` pushed (H-4 closed).
- Biggest blockers (current):
  - Commit + push the Run 1-17 dirty worktree (40 modified + 22 untracked files including security headers, CSRF middleware, AI Gateway, Stripe events, real workflows, integration tests). Currently only the historic Milestone 8 commit is on `origin/master`.
  - Wrangler CLI auth restoration — required before `wrangler deploy --env staging` and `--env production`.
  - `KIMI_API_KEY` + `AI_GATEWAY_ACCOUNT_ID` + `AI_GATEWAY_ID` secret writes (per user instruction, only Kimi mandated).
  - Staging deploy + smoke checklist.
  - Stripe test-mode setup — Stripe MCP/CLI not present in this shell.
  - Observability dashboards (M-16).
  - Production redeploy of the Run-17 worktree.
- Highest-risk security gaps: no staging deploy yet (so admin/MCP denial proven only locally); CSRF middleware proven locally but not in a production-mirroring environment; no live Stripe environment smoke.
- Highest-risk product gaps: external AI providers still mock-fallback until Kimi key is written; staging worker not yet deployed.
- Highest-risk test gaps: CI workflow exists but no remote CI run yet (nothing pushed past Milestone 8); staging smoke pending deploy.

## Phase Findings
### Product
- ID: C-5
  Severity: High
  Area: UI/customer onboarding
  Evidence: `app/routes/home.tsx`; `tests/e2e/command-center.spec.ts`
  Impact: The old static dashboard could not prove a browser customer journey.
  Fix plan: Replace static shell with route-driven pages and cover the authenticated route matrix.
  Test required: Desktop/mobile Playwright proof plus HTTP integration fixtures.
  Status: Fixed for current MVP pages; broader HTTP integration still open under C-6.

- ID: H-1
  Severity: High
  Area: MarketingAgent/API surface
  Evidence: `docs/system-dna/AGENT_SPEC.md`; `src/server/routes/brands.ts`
  Impact: Four spec methods were missing: `regenerateBrandField`, `generatePost`, `createCampaignFromOpportunity`, `getWorkflowStatus`.
  Fix plan: Add route/helper implementations without bypassing approval-before-export.
  Test required: HTTP integration coverage for success and unauthorized denial.
  Status: Fixed this run.

### Backend
- ID: H-5
  Severity: High
  Area: Workflow routing
  Evidence: `src/server/routes/brands.ts`; `src/server/routes/workspaces.ts`; `src/server/workflows/params.ts`
  Impact: Long-running generators previously ran synchronously instead of using bound Workflows.
  Fix plan: Queue Workflows through `WORKFLOW.create({ params })` when bindings exist; retain sync fallback only when absent.
  Test required: Typecheck plus payload-shaping unit tests.
  Status: Fixed for onboarding, content calendar, weekly report, growth, image generation, and brand-create auto-onboarding.

### Security
- ID: SEC-INT
  Severity: Medium
  Area: Auth/RBAC regression coverage
  Evidence: `tests/integration/api-flow.test.ts`; `tests/e2e/command-center.spec.ts`
  Impact: Tenant isolation and protected API denial paths needed request-level proof.
  Fix plan: Add HTTP integration tests for user A/B isolation, admin/MCP denial, approval-before-export, SSRF, rate limits, and session revoke.
  Test required: Miniflare/Hono integration suite.
  Status: Fixed for the required scenarios, including CSRF-specific HTTP coverage.

- ID: CSRF-1
  Severity: Medium
  Area: Browser/session security
  Evidence: `src/server/middleware/csrf.ts`; `src/server/index.ts`; `tests/integration/api-flow.test.ts`
  Impact: Cookie-backed mutating API requests previously relied only on SameSite cookie posture.
  Fix plan: Add same-origin/same-site mutation guard for requests carrying the session cookie and prove cross-site denial.
  Test required: HTTP integration test for `CSRF_BLOCKED` and first-party success.
  Status: Fixed this run.

- ID: UI-ACTION-1
  Severity: Medium
  Area: Button/form safety
  Evidence: `app/routes/home.tsx`
  Impact: Mutable forms could be submitted repeatedly and reset input after API errors.
  Fix plan: Add busy locks to action buttons/forms and only reset forms after a successful API envelope.
  Test required: Playwright failed-submit retention test.
  Status: Fixed this run.

### Testing
- ID: C-6
  Severity: High
  Area: Integration tests
  Evidence: `tests/integration/api-flow.test.ts`; `tests/unit`; `tests/e2e/command-center.spec.ts`
  Impact: Stripe, auth, RBAC, plan caps, workflow contracts, and rate limits can regress below browser level.
  Fix plan: Implement the required HTTP scenarios: signup/login/me/logout, A/B isolation, multi-brand isolation, approval-before-export, plan caps, Stripe replay/tamper, Stripe subscription event plan-cap transitions, SSRF, rate limiting, DM lifecycle, admin denial.
  Test required: HTTP integration suite and CI wiring.
  Status: Fixed locally; CI workflow wiring added this run.

- ID: E2E-AUTH-ROUTES
  Severity: Medium
  Area: Browser coverage
  Evidence: `tests/e2e/command-center.spec.ts`
  Impact: Prior route list only checked signed-out shell/login.
  Fix plan: Create a real local user/workspace/brand and verify MVP pages, billing guard, admin denial, onboarding action, and failed-form retention.
  Test required: `npm run test:e2e`.
  Status: Fixed this run.

### UI
- ID: UI-ROUTES
  Severity: High
  Area: Customer pages
  Evidence: `app/routes/home.tsx`
  Impact: Customers needed real session, workspace, brand, billing, approval, media, DM, report, growth, and admin surfaces.
  Fix plan: Add route parsing, real API fetches, loading/error/empty states, and primary actions.
  Test required: Browser verification across desktop/mobile.
  Status: Fixed for current MVP page set.

### Cloudflare Runtime
- ID: CF-NODE
  Severity: Medium
  Area: Local validation
  Evidence: exact `npm run typecheck` prints `Wrangler requires at least Node.js v22.0.0. You are using v20.18.0.`
  Impact: The default shell command can look green while Wrangler refuses the local Node runtime.
  Fix plan: Use bundled Node 24 for Wrangler/typegen/tsc until the default Node is upgraded to 22+.
  Test required: Re-run the bundled Node 24 sequence after binding/config changes.
  Status: Open environment issue with documented workaround.

- ID: CF-MCP-AUTH
  Severity: Medium
  Area: Cloudflare tooling
  Evidence: Cloudflare API MCP read-only D1 list returns auth error `10000`; current `npm run cf:readiness` stops at `wrangler whoami` with `Not logged in`.
  Impact: Cloudflare readiness cannot be refreshed through MCP or CLI in the current shell.
  Fix plan: Re-authenticate Wrangler or provide an approved Cloudflare API token, then rerun the read-only readiness command; mutations still require separate confirmation.
  Test required: successful `npm run cf:readiness` plus MCP account/D1/KV/R2 discovery before relying on MCP.
  Status: Open tooling issue.

- ID: CF-R2-MISSING
  Severity: High
  Area: Cloudflare bindings
  Evidence: `wrangler.jsonc` references `mustbeviral-production-media`; `wrangler r2 bucket list | Select-String mustbeviral` returned no matching bucket.
  Impact: production image/media paths cannot be treated as proven until the bucket exists or config is corrected.
  Fix plan: Create or verify R2 bucket only after explicit user confirmation for Cloudflare resource work.
  Test required: read-only R2 bucket discovery and staging/prod smoke after binding correction.
  Status: Open, blocked on explicit resource confirmation.

### Billing
- ID: STRIPE-LIVE
  Severity: High
  Area: Paid launch
  Evidence: `src/server/routes/billing.ts`; `tests/integration/api-flow.test.ts`; `tests/e2e/command-center.spec.ts`
  Impact: Billing UI is safely guarded when Stripe is not configured; live activation still needs explicit secret writes, product/price config, and test-mode checkout proof.
  Fix plan: Keep Stripe disabled unless explicitly configured; use read-only Stripe discovery until approval.
  Test required: Stripe replay/tamper rejection, local subscription event updates, cancellation fallback, and 402 plan-cap tests are now green; real checkout/subscription smoke remains blocked on approved test config.
  Status: Open for Stripe activation only.

### Admin / Operations
- ID: OPS-STAGING
  Severity: Medium
  Area: Release operations
  Evidence: staging D1/KV/R2 placeholders remain in `wrangler.jsonc`.
  Impact: Staging cannot be treated as deployable without resource provisioning and migration apply.
  Fix plan: Provision staging only with explicit user confirmation.
  Test required: staging smoke after provisioning.
  Status: Open.

## Fix Roadmap
### Sprint 1 - Build breakers and security
- Keep Node 24 validation path until local Node is upgraded.
- Keep the new HTTP auth/session/RBAC integration tests green.

### Sprint 2 - Core customer journey
- Maintain signup -> workspace -> brand -> onboarding -> approval -> export HTTP fixtures.
- H-1 is closed locally; next backend work is provider activation and staging smoke only after approval.

### Sprint 3 - UI page completion
- Maintain the current authenticated desktop/mobile Playwright route matrix.
- Add screenshots or visual assertions for dense mobile approvals/media once more data fixtures exist.

### Sprint 4 - Integration tests
- Keep CI/local integration suite green and add future provider smoke tests only after approved staging resources exist.

### Sprint 5 - Observability and runbooks
- Deployment, security, and test runbooks are updated; external dashboards remain pending.

### Sprint 6 - Staging and production readiness
- Provision staging D1/KV/R2 only after user confirmation.
- Apply migrations and smoke before any deploy claim.

## Go / No-Go
- Production deploy: ✅ GO — Run 19 deployed `mustbeviral-production` version `15ce175b-...` and full smoke is green.
- Paid launch (test mode): ✅ GO — products, prices, webhook, secrets, tamper, replay all verified.
- Public marketing launch: ❌ NO-GO — observability (M-16), admin seed, and a real test-mode Checkout end-to-end still required.
- Live Stripe activation: ❌ NO-GO — deferred to a separate run with explicit live-key authorisation.
- shipped: true
