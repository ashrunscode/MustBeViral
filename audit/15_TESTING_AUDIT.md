# 15_TESTING_AUDIT.md

## Test Commands Found

In `setup.py`'s `package.json` template:

| Script | Tool |
|---|---|
| `npm run test` | `vitest run` |
| `npm run test:e2e` | `playwright test` |
| `npm run typecheck` | `tsc --noEmit` |

No tests exist on disk.

## Test Results

```
$ npm run typecheck   → npm not initialized; no package.json
$ npm run test        → cannot run; no project
$ npm run build       → cannot run; no project
$ npx playwright test → cannot run; no project
```

The reason: there is no Node project at the working-directory root. Validation commands cannot be executed against this repo until the scaffold lands.

## Coverage By Subsystem

| Subsystem | Existing tests | Required tests | Priority |
|---|---:|---|---|
| auth | 0 | signup/login/logout, password hashing, session expiry, RBAC denial | P0 |
| middleware (auth/rbac/audit/costGuard/rateLimit/idempotency) | 0 | unit tests for each middleware in isolation | P0 |
| URL guard / SSRF | 0 | dozens of must-block IPs/hosts; allow-list cases | P0 |
| model router | 0 | provider selection, fallback on failure, recordUsage called | P0 |
| compliance reviewer | 0 | forbidden phrase detection, risk classification, "allow" cases | P0 |
| scheduler adapters (Manual / Vista / Buffer) | 0 | unit tests on each `schedulePost`, retry behavior, status fetch | P0 |
| MarketingAgent | 0 | state transitions, callable methods, broadcast events, scheduling | P0 |
| BrandOnboardingWorkflow | 0 | step-by-step with mocked services; idempotency on retry | P0 |
| ContentCalendarWorkflow | 0 | generation, regeneration, validation | P1 |
| ImageGenerationWorkflow | 0 | model fallback, R2 storage, post attachment | P1 |
| ApprovalSchedulingWorkflow | 0 | re-check approved status, manual fallback, retry | P0 |
| WeeklyReportWorkflow | 0 | empty data, full data, PDF generation | P1 |
| GrowthOpportunityWorkflow | 0 | dedup with existing, evidence required | P2 |
| DMAutomationSetupWorkflow | 0 | sensitive rules require approval, no provider-send when disabled | P2 |
| Stripe webhook | 0 | signature verification, idempotency, plan transitions | P0 |
| MCP server | 0 | tool list, tool execution, no-mutation enforcement | P2 |
| Tenant isolation | 0 | cross-workspace + cross-brand data leak attempts → 403 | P0 |
| OpenAPI / Zod schemas | 0 | snapshot tests on each route's request/response | P1 |
| UI components | 0 | minimal smoke tests for ApprovalQueue, BrandSwitcher, ScanProgressTimeline | P1 |
| Accessibility | 0 | axe-core in Playwright on key pages; keyboard nav on approval queue | P2 |
| E2E onboarding journey | 0 | signup → workspace → brand → onboarding (mocked) → approval → manual schedule | P0 |

## Missing Critical Tests

P0 tests that must exist before production launch:

1. **Tenant isolation** — every list endpoint, scoped by `workspace_id`, attempted with a non-member's token, must 403.
2. **SSRF** — `assertSafeUrl` against a list of must-block addresses (RFC1918 ranges, `169.254.169.254`, `localhost`, `0.0.0.0`).
3. **Stripe webhook signature** — wrong signature → 400; correct signature → DB updated.
4. **Approval state machine** — invalid transitions rejected (publishing a non-approved post must error).
5. **Cost guard** — request exceeding plan returns 451; usage ledger updated.
6. **Rate limit** — N+1 requests in sliding window → 429.
7. **Untrusted-content sanitizer** — instructions inside scanned text don't influence model output (snapshot a fixed prompt + injection input + assert sanitizer applied).
8. **Idempotency** — same `Idempotency-Key` returns same response; new key returns fresh result.
9. **Workflow idempotency** — running BrandOnboardingWorkflow twice with same input does not duplicate D1 rows.
10. **Manual export adapter** — schedules a post and `Download CSV` returns a valid CSV.

## Broken Tests

None — there are no tests to be broken.

## Required Test Plan

1. Adopt **Vitest 1.6+** (Workers-compatible; supports D1/KV/R2 via `@cloudflare/vitest-pool-workers`).
2. Adopt **Playwright** for E2E. Run against `wrangler dev --persist` locally and a deployed staging URL in CI.
3. Adopt **MSW** or a per-provider stub library for mocking external HTTP (Stripe, Vista, Buffer, OpenAI, Anthropic).
4. Adopt **`@cloudflare/vitest-pool-workers`** so Workers / D1 / DO / Workflows / Queues / KV / R2 / AI run in real Miniflare.
5. Set coverage thresholds in `vitest.config.ts`: `lines >= 80`, `branches >= 70` for `src/server/**`. UI coverage is opt-in.
6. CI gate: `npm run typecheck && npm run test && npm run build` must pass on every PR. Add `npm run test:e2e` against staging on `main` deploys.
7. Test fixtures live under `tests/fixtures/` and seed scripts under `scripts/seed-tests.ts`.
8. Snapshot tests for prompt templates: hash check ensures intentional version bumps.
9. Performance tests:
   - Onboarding workflow completes within X minutes (mock external).
   - 100 concurrent approvals do not deadlock D1.
   - Brand switcher renders < 200ms with 50 brands.
10. Accessibility: axe-core run on signup, brand command center, calendar, approvals, admin dashboard.

## Build Gates

Match `TEST_PLAN.md` plus stricter additions:

```
[Always]
npm run typecheck
npm run lint            (eslint)
npm run test
npm run build

[Pre-deploy staging]
npm run test:e2e -- --project=chromium
npm run test:e2e -- --project=mobile-safari   # for approval-first mobile UX

[Pre-deploy production]
all of the above
+ npm audit --omit=dev (no high/critical)
+ smoke tests against staging
+ manual approval gate
```
