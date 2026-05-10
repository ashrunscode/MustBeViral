# 04 — Product MVP Acceptance Audit

Status legend: **complete** = real, working code; **partial** = happy path only or significant gap; **mock only** = returns canned data; **missing** = no code; **unsafe** = present but dangerous as shipped; **unverified** = audit cannot confirm without live access.

| # | MVP Criterion | Status | Evidence | Gap | Fix |
|---|---|---|---|---|---|
| 1 | User can sign up | complete | `routes/auth.ts:43-94`; PBKDF2-SHA512, 100k iterations, salt 16 bytes; password strength validation (`services/auth/password.ts:49-69`) | Email verification not implemented (`email_verified_at` column unused) | Add verification email flow when email infra exists |
| 2 | User can login | complete | `routes/auth.ts:96-145`; lockout after 5 failed attempts for 15 min | No IP-based rate limiting | Add KV-based IP rate limit |
| 3 | User can logout | complete | `routes/auth.ts:147-151`; revokes session and deletes cookie | None | — |
| 4 | User can create workspace | complete | `routes/workspaces.ts:60-103`; creates workspace + owner member + starter subscription + audit log | None | — |
| 5 | User can create multiple brands | complete | `routes/workspaces.ts:140-216`; multi-brand allowed by `UNIQUE(workspace_id, slug)` | None | — |
| 6 | Brand access is tenant-isolated | complete | `middleware/rbac.ts:45-68`; `services/access.ts:31-45` joins `brands → workspace_members` on user_id | None | — |
| 7 | Workspace access is tenant-isolated | complete | `middleware/rbac.ts:21-43`; `services/access.ts:16-29` | None | — |
| 8 | Brand has dedicated MarketingAgent | partial | `routes/brands.ts:537-549` reaches the DO via `idFromName("brand:${brand.id}")` only on onboarding/start; no other route uses the DO | DO is a thin state shell; 14 of 20 spec methods return 501 | Implement remaining methods or revise spec |
| 9 | Onboarding can run | mock only | `services/brand-operations.ts:97-238`; inserts hardcoded findings/scores/profile/target market | Not real Workflow; Workflow class is stub | Replace with real BrandOnboardingWorkflow steps + real ModelRouter calls |
| 10 | Onboarding rerun is idempotent | complete | `services/brand-operations.ts:101-119`; short-circuits if completed `BrandOnboardingWorkflow` exists | None | — |
| 11 | Website scan has SSRF guard | complete | `services/security/ssrf.ts:21-77`; blocks 10/8, 127/8, 169.254/16, 172.16-31/12, 192.168/16, 100.64-127, 198.18/15, 224/4, IPv6 loopback/link-local/ULA, localhost variants, GCP/AWS metadata | None | — |
| 12 | Website scan content is treated as untrusted | complete | `services/website-scan.ts:47-62`; `sanitizeUntrustedText` flags 5 injection patterns; findings tagged `trust: "untrusted_scan_content"` | Browser Rendering fallback not wired (deferred) | Wire when needed |
| 13 | Brand intelligence report exists | mock only | `routes/brands.ts:91-114`; reads `marketing_scores` + `website_scans`; values come from mock generator | Scores hardcoded `{positioning:72, conversionReadiness:68, contentVelocity:61, localTrust:70, approvalRisk:18}` for every brand | Wire to real ModelRouter via Workflow |
| 14 | Brand profile exists and is editable | partial | `routes/brands.ts:116-182`; GET reads latest version, PATCH inserts new version with locked-fields; profile_json comes from mock | UI offers no editor; only API works | Build profile editor UI |
| 15 | Target market exists | mock only | `routes/brands.ts:184-196`; reads `target_market_reports`; report comes from mock generator | Hardcoded 2 segments per brand | Wire to real research |
| 16 | Calendar exists (30 days) | mock only | `routes/brands.ts:211-246`; `generateMockContentCalendar` produces 30 posts cycling 4 platforms × 6 topics | Generic captions for every brand | Wire to real ModelRouter |
| 17 | Posts exist with statuses | complete | Migration enforces `CHECK (status IN ('draft','pending_approval','approved','rejected','scheduled','published','failed'))` | None | — |
| 18 | Approval queue exists | complete | `routes/brands.ts:248-260` GET; `routes/brands.ts:262-297` POST | None | — |
| 19 | Approval-before-export/schedule enforced | complete | `routes/brands.ts:352-358`; returns 409 `POST_NOT_APPROVED` if `post.status !== "approved"` | None | — |
| 20 | Manual export works | complete | `routes/brands.ts:337-401`; `ManualExportAdapter` returns `status:"manual_export"` with payload; updates `content_posts.status='scheduled'` | None | — |
| 21 | Media/image mock works | mock only | `services/brand-operations.ts:428-457`; `generateMockImage` calls `ModelRouter.generateText` and writes `generated_creatives` row with `r2_key="mock/${brandId}/${creativeId}.png"` | **No actual image is generated** — R2 binding is never written. Worker AI is never called for image gen | Implement real Flux call via `env.AI.run("@cf/black-forest-labs/...")` and upload to R2 |
| 22 | DM rules exist with approval | complete | `routes/brands.ts:417-452`; hardcodes `requires_approval=1`, `status='pending_approval'`; metadata declares `browserBot:false` | No execution path (acceptable for Phase 1 since direct social APIs out of scope) | Document Phase 2 plan |
| 23 | Weekly report exists | mock only | `services/brand-operations.ts:346-386`; 4 hardcoded English sentences | No PDF generation despite `pdf_r2_key` column | Wire real metrics + R2 PDF, or drop PDF promise |
| 24 | Growth opportunities exist | mock only | `services/brand-operations.ts:388-426`; 3 hardcoded titles | Not brand-specific | Wire to ModelRouter |
| 25 | Billing skeleton exists | partial | `routes/billing.ts`; checkout/portal call real Stripe API when keys present, otherwise return `{configured: false}` | Webhook does not process events; subscription status never advances; no entitlement enforcement | Implement event handlers (checkout.session.completed, customer.subscription.{created,updated,deleted}, invoice.payment_failed) |
| 26 | Stripe webhook signature verification | complete | `services/stripe/signature.ts`; HMAC-SHA-256 raw body, 300s tolerance, timing-safe; idempotency via `webhooks_inbox` | Webhook body is logged but not processed | Add event-type dispatcher |
| 27 | Admin routes protected | complete | `routes/admin.ts:12`; `requireAuth() + requireAdmin()` | No admin user provisioning route exists | Add seeding script or route |
| 28 | MCP route protected | complete | `routes/mcp.ts:31`; same pattern. Only SELECT queries allowed; no `;` chaining; allowlist of 10 tools | `MustBeViralMCP` DO is unrelated 501 stub (dead code) | Remove DO binding or implement |
| 29 | Tests cover core flows | partial | 12 unit tests cover security primitives + envelope shape + schema existence + scheduler stubs | No route, workflow, billing, or RBAC integration tests; e2e never runs | Add integration tests (see 14_TEST_COVERAGE_AUDIT.md) |
| 30 | Production deploy is safe | partial | Wrangler config is correct; routes secured; live charges disabled; admin/MCP protected | (a) Hono ≥4.12.16 unpatched (cookie injection, basicAuth timing); (b) UI is a static stub — no users can actually use the product through a browser; (c) no CI/CD; (d) no rollback documented | Patch deps, build real UI, set up GH + CI |

## Counts

* **complete:** 13
* **partial:** 7
* **mock only:** 8
* **missing:** 0
* **unsafe:** 0 (with one caveat: Hono CVEs make the deployed Worker susceptible to known cookie-handling and timing attacks)
* **unverified:** 0

## Net product readiness assessment

The MVP is **plumbed for the right user journey** (signup → workspace → brand → onboarding → calendar → approvals → export) and the security guardrails are real. But:

* **Every "AI"-flavored feature is mock-only.** A paying user who logs in today and runs onboarding gets the same hardcoded scores, same 30-day generic calendar, same 4 weekly-report sentences as every other user.
* **No real UI.** The browser experience is a static info dashboard with no forms; users cannot complete *any* MVP criterion through the UI. Every flow requires direct API calls.
* **No real scheduler beyond manual export.** Acceptable for Phase 1, but the exported payload is a JSON blob, not formatted for any specific platform.
* **No real billing event processing.** Subscriptions remain `'incomplete'` forever.

The product is **demoable but not sellable.** Production deployment is safe in the sense that nothing catastrophic will happen if a user signs up, but nothing useful will happen either.
