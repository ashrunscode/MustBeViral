# 14 — Test Coverage Audit

## Inventory

| File | Type | describe/test count | Tests | What it asserts |
|---|---|---|---|---|
| `tests/unit/auth-security.test.ts` | Unit | 1 describe / 4 it | 4 | PBKDF2 hash+verify, SSRF blocks, prompt-injection flagging, Stripe signature happy/bad path |
| `tests/unit/envelope.test.ts` | Unit | 1 describe / 2 it | 2 | success/error envelope shape |
| `tests/unit/scheduler-model.test.ts` | Unit | 1 describe / 2 it | 2 | manual adapter happy path, external adapter fail-closed |
| `tests/unit/schema.test.ts` | Unit | 1 describe / 3 it | 3 | migration contains every required `CREATE TABLE`; mentions specific status values |
| `tests/unit/scaffold.test.ts` | Unit | 1 describe / 1 it | 1 | preserved spec docs exist |
| `tests/e2e/command-center.spec.ts` | Playwright | 2 tests | 2 | Static cockpit renders text "Command Center"/"Brands"/"Approval first" and "/approvals" path renders "Approvals"/"No direct publishing or unsafe DM automation" |

**Totals:**
* Unit tests: 5 files, 12 tests (Codex's claim of "5 files / 12 tests" is correct)
* E2E specs: 1 file, 2 tests (never executed; only `--list`)

## Coverage classification

| Test | Meaningful? | Smoke? | Trivial? |
|---|---|---|---|
| auth.password roundtrip | ✅ | | |
| auth.password iteration ≤100k | ✅ | | |
| ssrf blocks 127.0.0.1 / 169.254.169.254 / allows mustbeviral.com | ✅ | | |
| prompt-injection flags "ignore previous instructions" | ✅ | | |
| stripe signature valid + invalid | ✅ | | |
| envelope.success shape | | | ✅ |
| envelope.error shape | | | ✅ |
| scheduler manual happy path | | ✅ | |
| scheduler external fail-closed | ✅ | | |
| schema all 37 tables exist | | ✅ | |
| schema includes auth/webhook/idempotency/invitation tables | | ✅ | |
| schema status enums | | ✅ | |
| scaffold spec docs exist | | | ✅ |
| e2e renders Command Center | | ✅ | |
| e2e renders /approvals | | ✅ | |

* Meaningful: 6 (~40%)
* Smoke: 6 (~40%)
* Trivial: 3 (~20%)

## Gaps

### Critical gaps

| Area | What's tested | What's missing |
|---|---|---|
| Auth flow (signup → login → me → logout) | password primitives only | No HTTP-level test of /api/auth/* round-trip; no test of cookie attributes, no test of bearer fallback, no test of lockout-after-5-fails, no test of session expiry/revocation |
| RBAC | none | No test of `requireAuth`/`requireAdmin`/`requireWorkspaceMember`/`requireBrandAccess` |
| Tenant isolation | none | **No test that user A cannot read user B's brand** — critical multi-brand safety property |
| Workspace + brand creation | none | No HTTP-level test |
| Onboarding (mock) | none | No test that `createMockOnboardingArtifacts` is idempotent on rerun |
| Approvals | none | No test of state transitions; no test of approve→manual_export guard |
| Manual export | adapter only | No HTTP-level test; no test of approval-before-export 409 |
| Brand profile editor | none | No test of versioning |
| Image generation (mock) | none | No test |
| DM rules | none | No test that `requires_approval=1` is enforced at insert |
| Stripe checkout | none | No test of `configured:false` branch when keys missing |
| Stripe portal | none | No test |
| Stripe webhook event handling | signature only | No test of idempotency replay |
| Admin overview | none | No test |
| MCP query | none | No test of read-only enforcement (`SELECT` vs `INSERT`/`DELETE`) |
| MCP allowlist | none | No test that `query_readonly` rejects `;` chains, DDL/DML keywords |
| MarketingAgent DO | none | No test of state machine (idle → onboarding → paused → idle) |
| Workflow stub | none | No test that `runWorkflowStub` returns expected payload |
| Audit log writing | none | No test |
| Website scan SSRF integration | SSRF unit only | No test of `createWebsiteScan` happy/blocked paths |

### Coverage holes by file/symbol

| File | Lines | Tested? |
|---|---|---|
| `src/server/index.ts` | 85 | No |
| `src/server/routes/auth.ts` | 177 | No |
| `src/server/routes/workspaces.ts` | 217 | No |
| `src/server/routes/brands.ts` | 550 | No |
| `src/server/routes/billing.ts` | 154 | No |
| `src/server/routes/admin.ts` | 51 | No |
| `src/server/routes/mcp.ts` | 108 | No |
| `src/server/routes/webhooks.ts` | 46 | No |
| `src/server/middleware/{auth,rbac,error,request-logging}.ts` | ~100 | No |
| `src/server/services/auth/password.ts` | 94 | ✅ Real |
| `src/server/services/auth/session.ts` | 149 | No |
| `src/server/services/security/ssrf.ts` | 78 | ✅ Real |
| `src/server/services/security/prompt-injection.ts` | 33 | ✅ Real |
| `src/server/services/stripe/signature.ts` | 78 | ✅ Real |
| `src/server/services/model-router.ts` | 92 | No |
| `src/server/services/scheduler/index.ts` | 75 | ✅ Real |
| `src/server/services/brand-operations.ts` | 474 | No |
| `src/server/services/website-scan.ts` | 99 | No |
| `src/server/services/audit.ts` | 36 | No |
| `src/server/services/access.ts` | 46 | No |
| `src/server/agents/MarketingAgent.ts` | 128 | No |
| `src/server/mcp/MustBeViralMCP.ts` | 19 | No |
| `src/server/workflows/*.ts` | ~80 | No |
| `src/server/db/sql.ts`, `client.ts`, `seed.ts`, `schema.ts` | ~150 | Schema test only |
| `app/routes/home.tsx`, `shell.tsx`, `root.tsx` | ~290 | E2E renders only |

**Tested code: ~315 LOC of services. Untested: ~2500+ LOC of routes/middleware/agents/services.**

## Test infrastructure

* Vitest 4.1.5 with `vitest run`
* Coverage tool: `@vitest/coverage-v8` (devDep present, never run beyond `test:coverage` script)
* Playwright 1.59.1 — never executed beyond `--list`
* No worker pool tests via Wrangler `unstable_dev` / Vitest pool integration with Cloudflare
* No MSW / fake D1 for in-process integration tests
* `tests/setup.ts` exists (per BUILD_LOG Milestone 2) but content not inspected by this audit

## Required fixes

| ID | Severity | Fix |
|---|---|---|
| TEST-1 | Critical | Add HTTP-level tests using Vitest + Cloudflare's `unstable_dev` (or Hono's `testing` helper) for: signup→login→me→logout, brand create, approval state machine, manual export 409 guard |
| TEST-2 | Critical | Add **multi-brand tenant isolation test**: user A creates brand X; user B in different workspace gets 403 on GET /:brandX |
| TEST-3 | High | Add tests for MarketingAgent DO state transitions |
| TEST-4 | High | Add tests for Stripe webhook event handling (once BIL-1 is implemented) |
| TEST-5 | High | Add tests for MCP read-only enforcement (rejects `INSERT`, accepts `SELECT`, rejects `;` chains) |
| TEST-6 | High | Add tests for billing safe-disable (no Stripe keys → `configured:false`) |
| TEST-7 | High | Make Playwright e2e suite executable in CI (managed dev server via Wrangler local mode) |
| TEST-8 | Medium | Add coverage gate (e.g. ≥70% for `src/server/services/**`) to package scripts |
| TEST-9 | Medium | Add tests for prompt-injection sanitisation in scan path (URL → fetch → sanitize → store) |
| TEST-10 | Medium | Add tests for password reset / email verification flows once implemented |
| TEST-11 | Medium | Add tests for idempotency-key handling once implemented |
| TEST-12 | Low | Add tests for AI router (mock returns mock string; `USE_MOCK_AI=false` returns placeholder until real provider lands) |
| TEST-13 | Low | Add a smoke harness (`scripts/prod-smoke.ts`) replicating the manual smoke Codex did, runnable in CI |

## Verdict

12 unit tests is **far below "production MVP" coverage**. Codex's tests cover the right primitives (auth, SSRF, prompt injection, Stripe sig, scheduler) but not a single end-to-end flow. The two e2e tests are decorative and never run.

**Coverage rating: 2/10.** Production deploy with this coverage is a liability — every fix risks regressing untested behaviour.
