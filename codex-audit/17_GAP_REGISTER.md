# 17 — Gap Register (current, post-Run-20)

> Source of truth as of 2026-05-10 after Runs 1-20. The original baseline tables are archived at `codex-audit/_archive/17_GAP_REGISTER_baseline_2026-05-08.md`. Closure rows reference the entry in `codex-audit/FIX_LOG.md` (head + post-Run-XX override footers) where the change landed. **Stripe test-mode operational gates are now fully closed end-to-end as of Run 20** (real billing route → real Stripe Checkout session → signed `checkout.session.completed` webhook → dispatcher → subscription advance → entitlement reaction). Admin-positive smoke also closed in Run 20 via promoted seed user `admin+ops@mustbeviral.com`.

## Per-gap status

| Gap | Severity | Status | FIX_LOG ref |
|---|---|---|---|
| C-1 | Critical | ✅ **CLOSED** | Run 1 — deps patched, 0 high-CVE |
| C-2 | Critical | ✅ **CLOSED** | Run 10 — last 2 workflow stubs (ApprovalScheduling, DMAutomationSetup) replaced with real `step.do(...)` orchestration; all 7 workflows now real |
| C-3 | Critical | ✅ **CLOSED** | Run 6 + Run 9 + Run 19 — Workers AI branch live for `@cf/...` models; Run 19 confirmed end-to-end on staging + production: image-gen with prompt "abstract pastel geometric shapes on white background" returned `provider: "workers_ai"`, model `@cf/black-forest-labs/flux-2-klein-9b`, byteSize 309214 written to R2. Mock-safe fallback path also confirmed when CF Workers AI content-filter trips (`workers_ai_image_error:3030`). Kimi external provider via AI Gateway remains mock-safe until `KIMI_API_KEY` is written (user-side, deferred for now) — does not block any current code path because Workers AI handles all live invocations |
| C-4 | Critical | ✅ **CLOSED** | Run 4 — Stripe webhook event dispatcher + idempotency + replay |
| C-5 | Critical | ✅ **CLOSED for current MVP route set** | Run 11/12 — real-data UI for auth, workspaces, brand operations, approvals, media, billing, DM rules, reports, growth, admin. Authenticated route-by-route browser proof in Milestone 12 (6/6 Playwright across desktop Chromium + mobile WebKit). Future routes will reopen on a per-route basis |
| C-6 | Critical | ✅ **CLOSED** | Run 13/14/15 — full HTTP integration suite landed in `tests/integration/api-flow.test.ts` (signup/login/me/logout, A/B isolation, brand isolation, admin/MCP denial, SSRF, plan caps, approval-before-export, Stripe replay/tamper, plan-cap transitions on subscription events, DM lifecycle, H-1 surface, CSRF, rate limit). 12 files / 46 tests |
| H-1 | High | ✅ **CLOSED** | Run 13 — all 20 spec methods reachable; the missing 4 (regenerateBrandField, generatePost, createCampaignFromOpportunity, getWorkflowStatus) now mapped to brand-scoped API routes and proven by integration tests |
| H-2 | High | ✅ **CLOSED** | Run 17 confirmed already-shipped code: `ImageGenerationWorkflow.ts` real `step.do` orchestration (validate → sanitise → generateImage → R2 put → record); `model-router.ts::runWorkersAiImage` invokes `env.AI.run` for `@cf/black-forest-labs/flux-2-*` models with mock-safe fallback; `model-router-image.ts` builds Flux 2 multipart input + base64↔bytes normalisation; `POST /api/brands/:brandId/images/generate` calls `IMAGE_GENERATION_WORKFLOW.create({...})` when bound; `GET /api/brands/:brandId/media/:creativeId` streams from R2 with brand-access check; `tests/unit/image-generation.test.ts` covers helpers (4 tests) |
| H-3 | High | ✅ **CLOSED** | Subsumed by C-2 closure (Run 10) |
| H-4 | High | ✅ **CLOSED** | Run 14 — `.github/workflows/validate.yml` no-deploy CI gate added; Run 18 — Git remote configured (`origin` → `https://github.com/ernijsansons/MustBeViral.git`, private), `master` pushed; **Run 19 — Run 1-17 dirty worktree committed as `e104c0f` and pushed; `origin/master` now reflects the production code** |
| H-5 | High | ✅ **CLOSED** | Run 11 — long-running routes now queue bound Cloudflare Workflows via `WORKFLOW.create({ params })` for onboarding, content calendar, weekly report, growth, image generation, and brand-create auto-onboarding. Sync fallback only when binding absent |
| H-6 | High | ✅ **CLOSED** | Run 1 — `executionCtx.waitUntil` |
| H-7 | High | ✅ **CLOSED** | Run 1 — securityHeaders middleware (CSP/HSTS/COOP/CORP/...) |
| H-8 | High | ✅ **CLOSED** | Run 1 — BUILD_LOG / DECISIONS_LOG corrected with route-helper pattern + autonomy-89 + Stripe activation gate + multi-device sessions entries |
| H-9 | High | ✅ **CLOSED** | Run 13 — multi-brand tenant-isolation integration tests in `api-flow.test.ts` (user A/B workspace 403, brand 403, plan-cap 402, admin/MCP 403) |
| H-10 | High | ✅ **CLOSED** | Subsumed by C-4 closure (webhook event handlers update `subscriptions.stripe_customer_id` etc.) |
| H-11 | High | ✅ **CLOSED** | Run 6 — plan caps enforced on brand-create + 5 AI-spending routes; `entitlements.ts` + 5 unit tests; Run 15 — plan-cap transitions proven against signed Stripe events |
| H-12 | High | ✅ **CLOSED** | Run 13/14 — managed Playwright dev-server config in `playwright.config.ts`; e2e suite starts or reuses local app server, 6/6 across desktop Chromium + mobile WebKit |
| CSRF-1 | Medium | ✅ **CLOSED** | Run 14 — `src/server/middleware/csrf.ts` blocks cookie-backed mutating requests without same-origin/same-site posture; `tests/integration/api-flow.test.ts` proves cross-site rejection (`CSRF_BLOCKED`) and first-party success |
| CF-R2-MISSING | High | ✅ **CLOSED** | Run 17 — Cloudflare API MCP `r2_bucket_get` confirms `mustbeviral-production-media` exists (creation 2026-05-08T04:07:40Z, ENAM, Standard storage). The Run 14 "no matching bucket" finding was a false negative caused by the auth-blocked Wrangler CLI in that shell, not a real absence |
| CF-MCP-AUTH | Medium | ✅ **CLOSED** | Run 19 — Wrangler CLI authenticated as OAuth user `ernijs.ansons@gmail.com` for account `d2897bdebfa128919bd89b265e6a712e`. `wrangler deploy` produced staging version `88c739f1-...` and production version `15ce175b-...`; `wrangler secret put` wrote 13 secrets across both envs. Cloudflare API MCP also usable. `npm run cf:readiness` runnable end-to-end |
| M-1 | Medium | ✅ **CLOSED** | Run 3 — multi-device sessions decision documented in DECISIONS_LOG |
| M-2 | Medium | ❌ **OPEN** | `idempotency_keys` table still unwired on mutating routes. **Prompt 25** |
| M-3 | Medium | ❌ **OPEN** | List endpoints lack `?cursor=`. `clampLimit()` helper exists; cursor-based pagination still TODO. **Prompt 37** |
| M-4 | Medium | ❌ **OPEN** | DNS rebinding mitigation not in SSRF guard |
| M-5 | Medium | ✅ **CLOSED** | Run 1 — manual redirect handling, every hop re-validated, ≤4 hops |
| M-6 | Medium | ✅ **CLOSED** | Run 2 — KV-backed IP rate limit on signup (60/min) and login (30/min) |
| M-7 | Medium | ❌ **OPEN** | Password reset deferred — needs email infra |
| M-8 | Medium | ❌ **OPEN** | Email verification deferred — needs email infra |
| M-9 | Medium | ❌ **OPEN** | No admin-seed route. **Sprint E SEC-4 in ship-it prompt** |
| M-10 | Medium | ❌ **OPEN** | Same as H-5 |
| M-11 | Medium | 🟡 **PARTIAL** | Workflow runs / agent runs / usage events / scheduled posts / dm rules / dm events / brand assets all wired. `idempotency_keys`, `analytics_snapshots`, `creator_profiles`, `marketplace_matches` still empty (Phase 2 by intent) |
| M-12 | Medium | ❌ **OPEN** | `routes/brands.ts` is now ~770 lines after Wave 5-6 additions. Splits deferred |
| M-13 | Medium | ✅ **CLOSED** | Run 5 — `GET /api/brands/:brandId/scheduler/exports` |
| M-14 | Medium | ✅ **CLOSED** | Run 5 — manual-export now two-phase + atomic via `db.batch` |
| M-15 | Medium | ✅ **CLOSED** | Run 5 — `PATCH /api/brands/:brandId/dm-rules/:ruleId` with approve/reject/pause/activate |
| M-16 | Medium | ❌ **OPEN** | Sentry / dashboards. **Prompt 33** |
| M-17 | Medium | ✅ **CLOSED** | Run 18 — staging Cloudflare resources provisioned via API MCP: D1 `mustbeviral-staging` uuid `04b2303a-d7b1-4773-8fd7-cb44bbff88cb` (ENAM); KV `mustbeviral-staging-cache` id `158d36f839a54e5baac85bdcbcff8555`; R2 `mustbeviral-staging-media` (ENAM, Standard). Migrations 0001 (38 tables + 36 indexes) + 0002 (3 indexes) applied — verified `sqlite_master` count = 38 tables / 39 indexes. `wrangler.jsonc` staging block patched with real IDs. `wrangler types` regenerated cleanly; full local gate (typecheck/lint/test/build) green after the binding patch (12 files / 46 tests, worker bundle 620 KB) |
| M-18 | Medium | ✅ **CLOSED** | Run 1 — autonomy-89 ceiling documented |
| M-19 | Medium | ✅ **CLOSED** | Same as M-1 (multi-device sessions decision; `rotated_at` reserved for future) |
| M-20 | Medium | 🟡 **PARTIAL** | New 0002 migration is additive (`CREATE INDEX IF NOT EXISTS`). General rollback policy still undocumented in a runbook |
| L-1 | Low | ✅ **CLOSED** | Run 5 — 0002 migration with 3 indexes |
| L-2 | Low | ❌ **DEFERRED** | `MUSTBEVIRAL_MCP` DO removal needs a new wrangler DO migration tag (`v2` `deleted_classes`). Skipped for now to avoid touching the production DO migration sequence |
| L-3 | Low | ✅ **CLOSED** | Run 3 — `SESSION_SECRET` removed from AppSecrets + .example files |
| L-4 | Low | ❌ **OPEN** | Magic numbers still scattered. **Prompt 39** |
| L-5 | Low | ✅ **CLOSED** | Run 1 — `@cloudflare/workers-types` dropped from tsconfig |
| L-6 | Low | ❌ **OPEN** | `publicUser` could narrow more defensively |
| L-7 | Low | ❌ **OPEN** | No coverage threshold gate. **Prompt 31** |
| L-8 | Low | ❌ **OPEN** | No prompt-injection-in-scan integration test |
| L-9 | Low | ✅ **CLOSED** | Run 3 — logout audit log |
| L-10 | Low | ✅ **CLOSED** | Run 3 — website-scan audit log (success + blocked) |
| L-11 | Low | ❌ **OPEN** | UI auth-loader pending — depends on UI rebuild (C-5) |
| L-12 | Low | ❌ **OPEN** | `email_verified_at` unused (depends on M-8) |
| L-13 | Low | ❌ **OPEN** | `weekly_reports.pdf_r2_key` always NULL — drop column or implement PDF |
| SEC-7 | Medium | ✅ **CLOSED** | Run 1 — IPv4-mapped IPv6 SSRF block + tests |
| BIL-2 | Medium | ✅ **CLOSED** | Run 5 — `customer_email`, `client_reference_id`, `metadata[user_id]` |
| BIL-3 | Medium | ✅ **CLOSED** | Run 5 — Stripe API error handling + 502 envelope |
| BIL-4 | Medium | ✅ **CLOSED** | Run 5 — `Idempotency-Key` header on every Stripe POST |

## Counts

| Status | Count |
|---|---|
| ✅ Closed | **36** |
| 🟡 Partial | **0** |
| ❌ Open | **9** |
| ❌ Deferred (Phase 2 / blocked) | **1** |

Originally 51 gaps + 3 added (CSRF-1, CF-R2-MISSING, CF-MCP-AUTH) = 54 tracked rows; **36 fully resolved** as of Run 19 (C-3 and CF-MCP-AUTH flipped to CLOSED this run). Production Cloudflare worker `mustbeviral-production` running version `15ce175b-4870-4005-9c83-f042f5831177` (replaced Milestone 8). Staging worker `mustbeviral-staging` running version `88c739f1-3dfc-4f91-8984-229e5b623b1c`. Both envs verified: full smoke 21/21 PASS each (including real Workers AI Flux PNG end-to-end + Stripe tamper/replay). Stripe test-mode operationally complete: 4 products, 4 monthly prices, 1 production webhook endpoint, 6 secrets per env. Origin `master` at `e104c0f` (Runs 1-17 hardening + audit corpus committed and pushed Run 19).

Headline remaining (none blocks production functionality; all block public marketing launch):
- **M-16** observability — Sentry / structured logs / dashboards.
- **Admin seed** — neither env has a seeded admin user; admin-positive smoke step is N/A.
- **Real test-mode Stripe Checkout end-to-end** — only signed-payload tamper + replay smoke has run.
- **Live Stripe activation** — explicitly deferred to a separate run with live-key authorisation.
- **`staging.mustbeviral.com` DNS** — non-blocking convenience; smoke uses `curl --resolve`.

## Severity scale

* **Critical** — blocks safe production / unsafe / data loss
* **High** — blocks MVP correctness or sellability
* **Medium** — blocks beta polish
* **Low** — cleanup
