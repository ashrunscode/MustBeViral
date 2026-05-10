# 09 — API Route Audit

App mount: `app.route("/api", api)` in `src/server/index.ts:74`. Health, auth, workspaces, brands, billing, admin, mcp, webhooks routers attached under `/api/*`. SPA fallback `app.get("*", …)` for non-API paths.

Format key:
* **Auth** = `requireAuth()` middleware
* **WS** = `requireWorkspaceMember()`
* **BR** = `requireBrandAccess()`
* **AD** = `requireAdmin()`
* **Validation** = Zod schema name
* **Envelope** = response uses `successEnvelope`/`errorEnvelope`
* **Audit** = call to `writeAuditLog`
* **Tests** = unit / integration / e2e

## /api (health)

| Method | Path | Auth | Validation | Envelope | Audit | Tests | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/health` | none | none | ✅ | none | scaffold smoke only | Returns ready/timestamp |

## /api/auth

| Method | Path | Auth | Validation | Envelope | Audit | Tests | Notes |
|---|---|---|---|---|---|---|---|
| POST | `/api/auth/signup` | none | `signupSchema` | ✅ | ✅ | unit primitives only | PBKDF2 + session creation |
| POST | `/api/auth/login` | none | `loginSchema` | ✅ | ✅ | unit primitives only | Lockout after 5 fails |
| POST | `/api/auth/logout` | Auth | none | ✅ | none | none | **Should write audit log** |
| GET | `/api/auth/me` | Auth | none | ✅ | none | none | Returns user + workspaces |

## /api/workspaces

| Method | Path | Auth | Mw | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/api/workspaces` | Auth | — | none | ✅ | none | Lists user workspaces |
| POST | `/api/workspaces` | Auth | — | `createWorkspaceSchema` | ✅ | ✅ | Creates workspace + owner member + starter subscription |
| GET | `/api/workspaces/:workspaceId` | Auth | WS | none | ✅ | none | Workspace + brands |
| GET | `/api/workspaces/:workspaceId/brands` | Auth | WS | none | ✅ | none | List brands |
| POST | `/api/workspaces/:workspaceId/brands` | Auth | WS | `createBrandSchema` | ✅ | ✅ | Creates brand; if `startOnboarding!==false` runs `createMockOnboardingArtifacts` synchronously |

**Note:** the brand-create route runs onboarding synchronously inside the request. This is fine because the mock generator is fast (just D1 inserts). Once onboarding becomes a real workflow, this MUST move to `env.BRAND_ONBOARDING_WORKFLOW.create({…})` to avoid request timeouts.

## /api/brands

All routes mounted under `brandRoutes.use("/:brandId/*", requireAuth(), requireBrandAccess())`. Brand-scoped tenant isolation enforced at middleware layer.

| Method | Path | Auth | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|
| GET | `/:brandId` | Auth+BR | none | ✅ | none | Returns brand row |
| GET | `/:brandId/command-center` | Auth+BR | none | ✅ | none | `buildCommandCenter` |
| POST | `/:brandId/onboarding/start` | Auth+BR | none | ✅ | ✅ (in mock gen) | `createMockOnboardingArtifacts` then DO fire-and-forget |
| GET | `/:brandId/intelligence` | Auth+BR | none | ✅ | none | Reads marketing_scores + website_scans |
| GET | `/:brandId/profile` | Auth+BR | none | ✅ | none | Reads latest version |
| PATCH | `/:brandId/profile` | Auth+BR | `profileUpdateSchema` | ✅ | ✅ | Inserts new version |
| GET | `/:brandId/target-market` | Auth+BR | none | ✅ | none | Reads target_market_reports |
| POST | `/:brandId/website-scans` | Auth+BR | `websiteScanSchema` | ✅ | ✅ via createWebsiteScan? | `createWebsiteScan` calls SSRF guard. **`createWebsiteScan` does not call writeAuditLog** |
| POST | `/:brandId/content-calendar/generate` | Auth+BR | none | ✅ | ✅ | Mock generator |
| GET | `/:brandId/content-calendar` | Auth+BR | none | ✅ | none | Reads calendars + posts |
| GET | `/:brandId/approvals` | Auth+BR | none | ✅ | none | Pending posts |
| POST | `/:brandId/approvals/:postId` | Auth+BR | `approvalSchema` | ✅ | ✅ | Updates content_posts.status, inserts approvals row |
| GET | `/:brandId/media` | Auth+BR | none | ✅ | none | Lists brand_assets + generated_creatives |
| POST | `/:brandId/images/generate` | Auth+BR | `imageSchema` | ✅ | none | `generateMockImage` writes generated_creatives row only |
| POST | `/:brandId/scheduler/manual-export` | Auth+BR | `manualExportSchema` | ✅ | ✅ | **Approval-before-export guard**; writes scheduled_posts |
| GET | `/:brandId/dm-rules` | Auth+BR | none | ✅ | none | Lists rules |
| POST | `/:brandId/dm-rules` | Auth+BR | `dmRuleSchema` | ✅ | ✅ | `requires_approval=1` hardcoded |
| POST | `/:brandId/reports/weekly/generate` | Auth+BR | none | ✅ | ✅ via mock | Mock generator |
| GET | `/:brandId/reports/weekly` | Auth+BR | none | ✅ | none | Lists weekly_reports |
| POST | `/:brandId/growth/generate` | Auth+BR | none | ✅ | ✅ via mock | Mock generator |
| GET | `/:brandId/growth` | Auth+BR | none | ✅ | none | Lists growth_opportunities |

## /api/billing

| Method | Path | Auth | Mw | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/:workspaceId` | Auth+WS | — | none | ✅ | none | Subscription + `stripeConfigured` flag |
| POST | `/:workspaceId/checkout` | Auth+WS | — | `checkoutSchema` | ✅ | none (writes usage_event) | Real Stripe API call when configured |
| POST | `/:workspaceId/portal` | Auth+WS | — | none | ✅ | none | Real Stripe API call when configured |

## /api/admin

| Method | Path | Auth | Mw | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/overview` | Auth+AD | — | none | ✅ | none | Counts + recent failed jobs + usage rollup |

## /api/mcp

| Method | Path | Auth | Mw | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|---|
| GET | `/tools` | Auth+AD | — | none | ✅ | none | Lists 10 read-only tools |
| POST | `/query` | Auth+AD | — | `querySchema` | ✅ | none | SELECT-only with `LIMIT 100` injected. Validates: `^SELECT\b`, no `;` chains, no DDL/DML keywords |

## /api/webhooks

| Method | Path | Auth | Validation | Envelope | Audit | Notes |
|---|---|---|---|---|---|---|
| POST | `/webhooks/stripe` | none (signature) | raw body | ✅ | none | Verifies Stripe signature; logs to webhooks_inbox; **does not process** |

## Issues

| ID | Severity | Issue | Fix |
|---|---|---|---|
| API-1 | High | Stripe webhook does not process events; no entitlement transitions | Implement event dispatcher |
| API-2 | High | `images/generate` writes a `generated_creatives` row but does not call AI/R2 | Wire to real Workers AI Flux + R2 upload |
| API-3 | High | Brand creation does onboarding synchronously inside the request; will not scale once workflow is real | Move to `env.BRAND_ONBOARDING_WORKFLOW.create({…})` |
| API-4 | Medium | No idempotency key support on mutating routes | Wire `idempotency_keys` table for POST routes |
| API-5 | Medium | No pagination on list endpoints (`/workspaces`, `/brands`, `/approvals`, `/media`, `/reports/weekly`, `/growth`, `/dm-rules`, MCP tools) | Add `?limit=&cursor=` |
| API-6 | Medium | `logout` does not write audit log | Add audit |
| API-7 | Medium | `website-scans` does not write audit log | Add audit |
| API-8 | Medium | No `DELETE` routes for any entity (workspaces, brands, posts, dm_rules) | Add soft-delete routes when needed |
| API-9 | Low | `/api/workspaces` returns plan from `workspaces.plan` but the source of truth is `subscriptions.status`; potential drift | Read from subscriptions instead of workspaces.plan |
| API-10 | Low | `requireWorkspaceMember()` accepts `X-Workspace-Id` header in addition to URL param | Tighten or document why both are accepted |
| API-11 | Low | No rate limiting on public POST routes (`/auth/signup`, `/auth/login`) beyond per-account lockout | KV-based IP rate limit |
| API-12 | Low | No CORS / CSP / HSTS headers on responses | Add security headers middleware |
| API-13 | Low | `createWebsiteScan` writes to D1 from inside a service but does not write audit log | Add `writeAuditLog` from the service |
| API-14 | Low | Approval action `regenerate` sets status to `draft` without producing a new variant | Define what regenerate should do |
| API-15 | Low | `media` endpoint lists assets and creatives but no upload path exists | Add `POST /:brandId/media/upload` (R2 multipart) when needed |

## Test coverage

**No route-level integration tests exist.** All 14 unit tests test internal services (password hashing, SSRF, prompt injection, Stripe sig, scheduler stubs, schema, envelopes, scaffold). Routes are not exercised end-to-end.

E2E tests `tests/e2e/command-center.spec.ts` test only that the static UI renders text "Command Center", "Brands", "Approval first", "Approvals", "No direct publishing or unsafe DM automation" — they do not test API behaviour or auth.

## Required fixes

| Sprint priority | Fix |
|---|---|
| Sprint 0 (stop-the-bleed) | API-1 (Stripe webhook event handling), API-3 (move onboarding to real Workflow) |
| Sprint 1 | API-4, API-5, API-6, API-7 |
| Sprint 2 | API-2 (real image gen), API-8, API-9 |
| Sprint 3 | API-10, API-11, API-12, API-13, API-14, API-15 |
