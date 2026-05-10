# 03 — Spec vs Implementation Gaps

This file maps the original System DNA spec (under `docs/system-dna/` and `mustbeviral_system_dna_extracted/`) and the reconciled `final-strategy/` decisions against the shipped code.

## A) Architecture deltas

| Spec area | Spec said | Code delivers | Delta |
|---|---|---|---|
| Stack | Cloudflare Workers + Hono + React Router + D1 + R2 + Durable Objects + Workflows | All present | None |
| Compatibility date | "current" | `2026-05-08` with `nodejs_compat` | Local Workers runtime warns it falls back to `2025-11-25` (BUILD_LOG Milestone 6). Acceptable |
| Worker entrypoint | Hono Worker exports DOs + Workflows | `src/server/index.ts:25-35` exports MarketingAgent, MustBeViralMCP, all 7 Workflows | None |
| MCP | Read-only MCP server | `routes/mcp.ts` is **the MCP**, while `MustBeViralMCP` DO is a separate 501 stub | The DO is dead code; binding remains |
| Vectorize | Phase 2 deferral | Commented out in `wrangler.jsonc:50-56` | Acceptable |

## B) MarketingAgent gap

`docs/system-dna/AGENT_SPEC.md` (canonical method list, also reflected in BUILD_LOG Milestone 7) requires **20 callable methods** on `MarketingAgent`:

| # | Method | DO has it? | Route helper exists? | Notes |
|---|---|---|---|---|
| 1 | `getCommandCenter()` | ✅ via `/state` and `/command-center` | ✅ `buildCommandCenter` (services/brand-operations.ts:46) | Route bypasses DO |
| 2 | `startOnboardingScan(input)` | ✅ `/onboarding/start` | ✅ `createMockOnboardingArtifacts` | DO call is fire-and-forget; doesn't actually drive the workflow |
| 3 | `getBrandProfile()` | ❌ 501 | ✅ GET `/brands/:id/profile` | DO never queried; route reads D1 directly |
| 4 | `updateBrandProfile(patch)` | ❌ 501 | ✅ PATCH `/brands/:id/profile` | DO bypassed |
| 5 | `lockBrandField(fieldPath)` | ❌ 501 | Partial — `lockedFields[]` accepted in profile patch | No granular endpoint |
| 6 | `regenerateBrandField(fieldPath)` | ❌ 501 | ❌ Missing | No route, no helper |
| 7 | `generateContentCalendar(input)` | ❌ 501 | ✅ `generateMockContentCalendar` | Mock-only |
| 8 | `generatePost(input)` | ❌ 501 | ❌ Missing | No single-post generator |
| 9 | `regeneratePost(postId)` | ❌ 501 | Partial — approval `regenerate` action sets `status='draft'` | No re-generation logic |
| 10 | `approvePost(postId, userId)` | ❌ 501 | ✅ POST `/approvals/:postId` | Direct route |
| 11 | `rejectPost(postId, userId, reason)` | ❌ 501 | ✅ same route, action=reject | — |
| 12 | `scheduleApprovedPosts(input)` | ❌ 501 | ✅ POST `/scheduler/manual-export` | — |
| 13 | `generateWeeklyReport(input)` | ❌ 501 | ✅ Mock-only generator | — |
| 14 | `getGrowthOpportunities()` | ❌ 501 | ✅ Mock-only generator | — |
| 15 | `createCampaignFromOpportunity(opportunityId)` | ❌ 501 | ❌ Missing | No conversion route |
| 16 | `createDMRule(input)` | ❌ 501 | ✅ POST `/dm-rules` | Safe (approval req) |
| 17 | `pauseAgent()` | ✅ `/pause` | ❌ No outer route | DO endpoint not exposed via API |
| 18 | `resumeAgent()` | ✅ `/resume` | ❌ No outer route | Same |
| 19 | `getAgentActivity()` | ✅ `/activity` | ❌ No outer route | Same |
| 20 | `getWorkflowStatus(workflowId)` | ❌ 501 | Partial — admin overview lists failed workflows | No per-workflow status endpoint |

**Net result:** The DO is a state shell with 6 endpoints. 14 of 20 spec methods are not callable on the agent. Most route-level work bypasses the DO entirely.

## C) Workflows gap

`docs/system-dna/WORKFLOWS_SPEC.md` defines 7 Workflows with **multi-step pipelines** (e.g., `BrandOnboardingWorkflow`: scan → score → profile → target market → first calendar → first images → first approval queue). Code has all 7 wired in `wrangler.jsonc:75-110` and exported from `src/server/index.ts`, but every class is a stub:

```ts
// src/server/workflows/BrandOnboardingWorkflow.ts (14 lines)
export class BrandOnboardingWorkflow extends WorkflowEntrypoint<Env, BrandWorkflowInput> {
  override async run(event, step) {
    return runWorkflowStub("BrandOnboardingWorkflow", event, step);
  }
}
// runWorkflowStub does a single step.do(`${workflow}:stub`) returning {workflow, status: "stubbed", instanceId, receivedAt, payload}
```

The 7 Workflow bindings exist in dev, staging, and production. None are ever started — no `env.X_WORKFLOW.create({…})` call appears in the codebase.

## D) Database schema gap

`docs/system-dna/DATABASE_SCHEMA.sql` requires **31 tables**. Migration `0001_initial.sql` creates **37 tables** (the 31 plus 6 auxiliaries: `password_credentials`, `sessions`, `oauth_accounts`, `invitations`, `webhooks_inbox`, `idempotency_keys`).

Cross-check: `tests/unit/schema.test.ts` lists 37 required tables. Migration creates all 37. ✅ No missing tables.

Detail issues:

| Concern | Detail |
|---|---|
| `brands.autonomy_level` range | Spec says 0-100; migration `0001_initial.sql:90` enforces `CHECK (autonomy_level >= 0 AND autonomy_level <= 89)`. **Discrepancy.** Likely intentional ceiling at 89 to keep humans in the loop, but it should be documented. Currently undocumented |
| Soft delete | Users, workspaces, brands have `deleted_at` columns. Routes check `deleted_at IS NULL`. ✅ |
| `audit_logs` | NO ACTION on workspace/brand FK ensures logs survive cleanup. ✅ |
| `workspaces` plan enum | Includes `'managed'`. ✅ matches Stripe price IDs (`STRIPE_PRICE_MANAGED`) |
| `idempotency_keys` | Table exists, but **no route uses it**. `createId("usage")` is used instead. Idempotency contract is not enforced |
| `analytics_snapshots` | Table exists, never populated |
| `marketplace_matches`, `creator_profiles` | Tables exist, never populated. Phase 2 |

## E) UI gap

`docs/system-dna/UI_WIREFRAMES.md` and `final-strategy/09_FINAL_UI_UX_STRATEGY.md` describe a real product UI with auth pages, workspace/brand creation, command center, content calendar, approvals, media library, DM rules, billing, admin.

Code reality (`app/`):

```
app/
  routes.ts          (2 routes: index, catch-all)
  routes/
    home.tsx         (255 lines: static info dashboard with hardcoded pageMap)
    shell.tsx        (re-exports home.tsx)
  root.tsx           (HTML scaffold + ErrorBoundary)
  welcome/           (template logos)
```

`home.tsx` renders a static sidebar with 13 fake "page" entries (`/signup`, `/workspace`, `/brands`, `/onboarding`, `/intelligence`, `/calendar`, `/approvals`, `/media`, `/dm-automation`, `/reports`, `/growth`, `/billing`, `/admin`). Each "page" is a hardcoded `pageMap` entry that displays:
- 4 baseStats: Brands=Multi, Publishing=0, Scheduler=Manual, AI Mode=Mock
- 3 hardcoded rows like "API route — Implemented", "Workflow record — Mock-safe", "Guardrail — Enforced"
- Same guardrails sidebar text on every page

**There are no forms.** No `<input>`, no fetch calls, no auth integration in the UI. The product is unusable from a browser today; users would have to call `/api/*` with `curl`.

## F) Scheduler/DM gap

| Feature | Spec | Code | Delta |
|---|---|---|---|
| `SchedulerProvider` interface | Required | ✅ `services/scheduler/index.ts:19-22` | None |
| `ManualExportAdapter` | Phase 1 default | ✅ Real | None |
| `VistaSocialAdapter` | Phase 2+ skeleton | Stub returns `status: "failed"` | Acceptable |
| `BufferAdapter` | Phase 2+ skeleton | Stub returns `status: "failed"` | Acceptable |
| DM rules safe-by-default | `requires_approval=1` | ✅ Hardcoded in route insert | None |
| DM execution path | Should be approval → manual or provider-mediated | **Missing.** No code reads from `dm_rules.status='approved'` and triggers responses | High — but acceptable for Phase 1 since spec excluded direct social APIs |

## G) Billing gap

`final-strategy/13_FINAL_BILLING_STRATEGY.md` requires a Stripe-skeleton billing path with these flows: checkout, customer portal, webhook (signature → idempotency → event handlers → DB updates).

| Phase | Code |
|---|---|
| Checkout | ✅ Real Stripe API call when keys configured (`routes/billing.ts:112-134`) |
| Portal | ✅ Real Stripe API call (`routes/billing.ts:136-153`) |
| Webhook signature | ✅ Real (HMAC-SHA-256, 300s tolerance, timing-safe) |
| Webhook idempotency | ✅ via `webhooks_inbox UNIQUE(provider, external_event_id)` |
| Webhook event handling | ❌ **Missing.** Webhook only INSERTs to `webhooks_inbox`. No `subscriptions` row updates, no plan transitions, no entitlement changes |
| Subscription seeding on workspace create | ✅ `routes/workspaces.ts:87-92` inserts `subscriptions(plan='starter', status='incomplete')` |
| Plan-based entitlement enforcement | ❌ **Missing.** No code reads `subscriptions.plan` to gate features |

## H) AI / Model Router gap

`final-strategy/11_FINAL_AI_MODEL_COST_STRATEGY.md` requires:
- ModelRouter abstracts mock/Workers AI/Kimi/OpenAI/Anthropic/Flux providers
- Per-plan limits via usage_events
- Cost tracking
- AI Gateway routing for Kimi

Code (`services/model-router.ts:33-47`):

```ts
async generateText(request: ModelRequest): Promise<ModelResponse> {
  const provider = this.env.USE_MOCK_AI === "true" ? "mock" : "workers_ai";
  const model = this.selectModel(request.category);
  const text = provider === "mock"
    ? `Mock ${request.category} output for: ${request.prompt.slice(0, 120)}`
    : `Configured ${provider} call placeholder for ${model}.`;  // <-- this is the bug
  …
}
```

Even when `USE_MOCK_AI === "false"` (production), the router returns a **string literal** `"Configured workers_ai call placeholder for ..."`, NOT a real Workers AI invocation. There is no `this.env.AI.run(...)` call in the router. **The "real AI" path is also a mock.**

`logUsage` writes to `usage_events` with `cost_estimate_cents = 2` (mock=0). No per-plan limit enforcement. No Kimi/Anthropic/OpenAI/Flux integration.

## I) Browser scan gap

`final-strategy/04_CLOUDFLARE_BUILD_STRATEGY.md` references Browser Rendering as fallback for JS-heavy sites. wrangler.jsonc has no `browser` binding. `services/website-scan.ts` uses `fetch()` only with a 6-second timeout, falling back to `"Website fetch unavailable. Using safe mock scan fallback."` text on any error.

**Observation:** With JavaScript-only sites, the fetch will return rendered HTML for static pages and empty/JS-bundled HTML for SPAs. Codex disabled `USE_BROWSER_RUN` and never wired the binding. Acceptable for Phase 1, but should be flagged.

## J) Tests gap

`final-strategy/14_FINAL_TESTING_STRATEGY.md` and the Default Team Workflow in CLAUDE.md require: tests for everything Implementer produces; meaningful coverage. Reality:

| Test category | Spec | Code | Delta |
|---|---|---|---|
| Auth/security primitives | Required | 4 tests in `auth-security.test.ts` | ✅ Adequate |
| Envelope formatting | Required | 2 tests | ✅ Adequate |
| Schema existence | Required | 3 tests | ✅ Adequate |
| Scheduler primitives | Required | 2 tests | ✅ Adequate |
| Scaffold | Sanity | 1 test | ✅ Adequate |
| **Route integration** | Required | **0 tests** | ❌ Missing |
| **Workflow execution** | Required | **0 tests** | ❌ Missing |
| **Multi-brand tenant isolation** | Required | **0 tests** | ❌ Missing |
| **Billing flow** | Required | **0 tests** | ❌ Missing |
| **MCP tool surface** | Required | **0 tests** | ❌ Missing |
| **DO state machine** | Required | **0 tests** | ❌ Missing |
| **E2E** | Required | 2 specs (renders static HTML), **never executed** | ❌ Missing |

12 unit tests + 2 unrun e2e specs is far below "production MVP" coverage.

## K) Operational gap

| Concern | Reality |
|---|---|
| CI/CD | None. No `.github/`, no `.gitlab-ci.yml`, no Cloudflare Pages build pipeline; deploy is `wrangler deploy` from local machine |
| Git remote | None. Committed locally to `master` |
| Pre-push tests | None |
| Husky pre-commit | Configured (`.husky/pre-commit` exists per package.json `"prepare": "husky"`) but content not verified by this audit |
| Production secret rotation | No scripted rotation; relies on manual `wrangler secret put` |
| Observability | `wrangler.jsonc:7-10` enables observability with `head_sampling_rate: 1`, no dashboards or alerts wired |
| Rollback strategy | Wrangler `--rollback` works for the Worker. D1 migrations have no rollback file (only forward `0001_initial.sql`) |

## L) Dependency / runtime gap

`npm audit` (run during this audit) reports **15 vulnerabilities (5 moderate, 10 high)**, including high-severity CVEs in `hono` (cookie injection, basicAuth timing, prototype pollution), `react-router` (CSRF/XSS), `vite` (path traversal in dev), `undici` (HTTP smuggling), `lodash` (prototype pollution). Codex documented these in BUILD_LOG Milestone 2 but did not run `npm audit fix`. **A production deploy with these versions is unsafe** — particularly the hono cookie-injection vulnerability since this app sets the session cookie via hono.

## Summary

The product surface is wired and the security primitives are real. **Everything customer-facing is mocked.** The Cloudflare configuration is solid. The UI is a static placeholder. The Workflows + AI + image-gen + reports + growth pipelines are all canned JSON. Tests are sparse. CI/CD does not exist. Dependencies have unpatched high-severity CVEs.
