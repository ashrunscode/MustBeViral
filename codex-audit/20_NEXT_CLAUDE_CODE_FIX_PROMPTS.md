# 20 — Next Claude Code Fix Prompts

> ## ⚠️ STATUS RECONCILIATION (post-Run-7, 2026-05-08)
>
> ### Per-prompt status table
>
> | # | Title (short) | Status | FIX_LOG ref |
> |---|---|---|---|
> | 1 | Patch dependency CVEs | ✅ DONE | Run 1 |
> | 2 | securityHeaders middleware | ✅ DONE | Run 1 |
> | 3 | Push to GitHub remote + add CI | ❌ PENDING | (Sprint F H-4) |
> | 4 | Correct BUILD_LOG / DECISIONS_LOG | ✅ DONE | Run 1 |
> | 5 | HTTP integration test for /api/auth | ❌ PENDING | (Sprint C C-6) |
> | 6 | Multi-brand tenant-isolation test | ❌ PENDING | (Sprint C H-9) |
> | 7 | IP rate limit on auth | ✅ DONE | Run 2 |
> | 8 | IPv4-mapped IPv6 in SSRF | ✅ DONE | Run 1 |
> | 9 | Re-validate redirect targets | ✅ DONE | Run 1 |
> | 10 | waitUntil DO calls | ✅ DONE | Run 1 |
> | 11 | Expose pause/resume/activity API routes | ✅ DONE | Run 2 |
> | 12 | Document route-helper in AGENT_SPEC | ✅ DONE | Run 2 |
> | 13 | MarketingAgent DO state-transition tests | ❌ PENDING | (Sprint C TEST-3) |
> | 14 | Remove or implement MUSTBEVIRAL_MCP DO | ❌ DEFERRED | (needs DO migration tag v2; risky to touch in current run) |
> | 15 | BrandOnboardingWorkflow real `step.do` | 🟡 PARTIAL | Run 7 — wraps mock generator inside `step.do`. Full per-step decomposition deferred |
> | 16 | Wire brand-create to `WORKFLOW.create` | ❌ PENDING | (Sprint B H-5) |
> | 17 | ContentCalendarWorkflow real | 🟡 PARTIAL | Run 7 — same shape as 15 |
> | 18 | **ImageGenerationWorkflow + Workers AI Flux + R2** | ❌ **PENDING — TOP PRIORITY** | (Sprint A H-2 / C-2 finish) |
> | 19 | Real Workers AI text in ModelRouter | ✅ DONE | Run 6 — `@cf/...` branch only; external providers fall back to mock |
> | 20 | Kimi via AI Gateway (external providers) | ❌ PENDING | (Sprint A AI-3) |
> | 21 | Stripe webhook event handlers | ✅ DONE | Run 4 |
> | 22 | Stripe customer_email + workspace metadata | ✅ DONE | Run 5 |
> | 23 | Stripe API error handling + Idempotency-Key | ✅ DONE | Run 5 |
> | 24 | Plan-based entitlement enforcement | ✅ DONE | Run 6 |
> | 25 | Wire idempotency_keys for mutating routes | ❌ PENDING | (Sprint E M-2) |
> | 26 | DM rule approval/rejection endpoints | ✅ DONE | Run 5 |
> | 27 | HTTP tests for /api/workspaces and /api/brands | ❌ PENDING | (Sprint C) |
> | 28 | MCP read-only enforcement test | ❌ PENDING | (Sprint C TEST-5) |
> | 29 | Playwright managed dev-server | ❌ PENDING | (Sprint C H-12) |
> | 30 | scripts/prod-smoke.ts | ❌ PENDING | (Sprint C TEST-13) |
> | 31 | Coverage threshold gate | ❌ PENDING | (Sprint C L-7) |
> | 32 | Provision staging D1/KV/R2 | ❌ PENDING | (Sprint F M-17 — needs user confirmation for resource creation) |
> | 33 | Sentry / structured logs / dashboards | ❌ PENDING | (Sprint E M-16) |
> | 34-36 | UI rebuild (auth, workspaces, brands) | ❌ PENDING | (Sprint D — multi-week, C-5) |
> | 37 | Pagination on list endpoints | ❌ PENDING | (Sprint E M-3) |
> | 38 | DNS rebinding mitigation | ❌ PENDING | (M-4) |
> | 39 | Centralise magic numbers | ❌ PENDING | (L-4) |
> | 40 | Drop @cloudflare/workers-types | ✅ DONE | Run 1 |
> | 41 | Drop SESSION_SECRET | ✅ DONE | Run 3 |
> | 42 | Scheduler exports retrieval | ✅ DONE | Run 5 |
> | 43 | Transactional manual export | ✅ DONE | Run 5 |
> | 44 | Audit log on logout | ✅ DONE | Run 3 |
> | 45 | Audit log on website-scan | ✅ DONE | Run 3 |
>
> ### Suggested execution order for Run 8+
>
> 1. **Prompt 18** — ImageGenerationWorkflow with Workers AI Flux + R2 upload + media proxy route (Sprint A).
> 2. **Prompt 20** — Kimi via AI Gateway routing in ModelRouter (Sprint A).
> 3. **Prompts for the 2 remaining workflow stubs** — ApprovalSchedulingWorkflow and DMAutomationSetupWorkflow (Sprint B; not numbered in this file because they're follow-ons of 15/17).
> 4. **Prompt 16** — switch routes to `WORKFLOW.create({...})` for the 4 already-real workflows (Sprint B).
> 5. **Prompts 5, 6, 13, 27, 28, 29, 30, 31** — full HTTP integration test suite (Sprint C). This is the gate before Stripe live activation.
> 6. **Prompt 32** — provision staging (Sprint F). Requires user confirmation for resource creation.
> 7. **Prompt 3** — Git remote + CI workflow (Sprint F H-4). Requires user confirmation for the remote URL.
> 8. **Prompts 34-36** — UI rebuild (Sprint D, multi-week).
> 9. **Sprint G** — Stripe live activation (after #5 passes). Requires user confirmation for secret writes.
>
> See `19_RELEASE_GO_NO_GO.md` reconciled verdicts for the full release-readiness picture.

---

## Original prompt list (baseline 2026-05-08; status reconciliation above is authoritative)

40+ self-contained prompts. Each is independently executable. Order matches `18_FIX_ROADMAP.md` sprints. Run them top-down.

---

### Prompt 1: Patch dependency vulnerabilities (Sprint 0.1)

**Goal:** Bring `hono`, `react-router`, `vite`, `undici`, `lodash`, `minimatch`, `picomatch`, `rollup`, `brace-expansion`, `postcss` to versions without high-severity advisories.

**Evidence:** `npm audit` reports 15 vulnerabilities (5 moderate, 10 high). Hono 4.11.1 has cookie injection (`GHSA-5pq2-9x2x-5p6w`); react-router 7.9.6 has CSRF/XSS; vite 6.4.1 has path traversal.

**Files to inspect:** `package.json`, `package-lock.json`.

**Files to edit:** `package.json` (and `package-lock.json` via npm).

**Exact work:**
1. Run `npm audit fix --force`. This will bump hono → 4.12.18+, react-router → 7.15+, vite → 6.4.2+, etc.
2. Inspect breaking changes for each upgrade (especially react-router 7.9 → 7.15). Update imports if needed.
3. Re-run typecheck, lint, test, build.

**Acceptance:**
- `npm audit --audit-level=high` reports 0 high.
- `npm run typecheck && npm run lint && npm run test && npm run build` all green.
- Existing test count (`5 files / 12 tests`) preserved.

**Run:**
```
npm audit fix --force
npm run typecheck
npm run lint
npm run test
npm run build
```

**Do not:** Run `wrangler deploy`. This is a code-only patch; deploy comes after CI is set up.

---

### Prompt 2: Add securityHeaders middleware (Sprint 0.2, gap H-7)

**Goal:** Apply CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy to every response.

**Evidence:** `src/server/index.ts` does not register a security-headers middleware. SPA responses to `mustbeviral.com` lack CSP/HSTS.

**Files to inspect:** `src/server/index.ts`, `src/server/middleware/`.

**Files to edit:**
- New: `src/server/middleware/security-headers.ts`
- Edit: `src/server/index.ts` (register middleware before `app.use("*", requestLogging())`).

**Exact work:**
1. Create `securityHeaders()` middleware using `createMiddleware<AppHonoContext>` from `hono/factory`.
2. Set headers via `c.header(...)` after `await next()`:
   - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: geolocation=(), microphone=(), camera=()`
   - `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://fonts.googleapis.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https://imagedelivery.net; connect-src 'self' https://api.stripe.com; frame-ancestors 'none'`
3. Register before request-logging middleware in index.ts.

**Acceptance:**
- A request to any route returns the headers.
- Add a test that does `app.fetch(new Request("http://localhost/api/health"))` and asserts headers.

**Run:** typecheck/lint/test/build.

---

### Prompt 3: Push to GitHub remote and add CI (Sprint 0.3, gap H-4)

**Goal:** Establish a remote source of truth and run typecheck/lint/test/build on every PR.

**Evidence:** `git remote -v` returns empty.

**Files to inspect:** none new — confirm `package.json` scripts.

**Files to edit:**
- New: `.github/workflows/ci.yml`

**Exact work:**
1. (Manual user step:) Create a new GitHub repo `mustbeviral/mustbeviral` (or chosen path). Run `git remote add origin <url>` then `git push -u origin master`.
2. Create `.github/workflows/ci.yml`:
   - Trigger: `pull_request`, `push: branches: [master]`.
   - Job: ubuntu-latest, Node 22.
   - Steps: checkout, setup-node (cache npm), `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
3. Add a status badge to `README.md`.

**Acceptance:**
- Pushing a branch and opening a PR triggers CI; all 4 commands run; PR shows green/red status.
- `git remote -v` shows `origin`.

**Do not:** Push secrets (Stripe, Kimi, etc.) to GitHub. Use repository secrets.

---

### Prompt 4: Correct BUILD_LOG and DECISIONS_LOG misstatements (Sprint 0.6, gap H-8)

**Goal:** Bring docs in line with shipped code so future contributors are not misled.

**Evidence:** BUILD_LOG Milestone 7 result text says "MarketingAgent callable state methods" implying the spec's 20-method surface. Reality (from `src/server/agents/MarketingAgent.ts:85-94`): only 5 endpoints work; 14 of 20 spec methods return 501. Migration's `autonomy_level <= 89` ceiling is undocumented.

**Files to inspect:** `final-strategy/BUILD_LOG.md`, `final-strategy/DECISIONS_LOG.md`, `docs/system-dna/AGENT_SPEC.md`.

**Files to edit:**
- `final-strategy/BUILD_LOG.md` — Milestone 7 "Result" section.
- `final-strategy/DECISIONS_LOG.md` — add new entry under 2026-05-08 explaining route-helper pattern; add entry explaining `autonomy_level` 0-89 ceiling.

**Exact work:** rewrite Milestone 7 result to say "MarketingAgent DO exposes 5 lifecycle endpoints (state/command-center/pause/resume/activity/onboarding-start). The remaining 15 of 20 spec methods are exposed as plain API routes that read/write D1 directly (route-helper pattern); see DECISIONS_LOG 2026-05-08 entry on route-helper pattern." Add the route-helper decision entry. Add the autonomy_level ceiling entry.

**Acceptance:** docs accurately describe shipped code.

---

### Prompt 5: Add HTTP-level integration test for /api/auth signup→login→me→logout (Sprint 1.1, gap C-6)

**Goal:** Cover the auth flow end-to-end at HTTP level.

**Evidence:** `tests/unit/auth-security.test.ts` only covers password primitives. No test exercises the actual routes.

**Files to inspect:** `src/server/index.ts`, `src/server/routes/auth.ts`, `tests/setup.ts`, `vitest.config.ts`.

**Files to edit:**
- New: `tests/integration/auth.test.ts`
- Edit: `vitest.config.ts` if a separate `integration` project / pool is needed.

**Exact work:**
1. Use `app.fetch(new Request(...))` to drive the Hono handler in-process.
2. Mock D1 via `miniflare` or use the test D1 via `unstable_dev` (preferred).
3. Test:
   - `POST /api/auth/signup` with weak password → 400 `WEAK_PASSWORD`
   - `POST /api/auth/signup` with valid creds → 201, sets cookie
   - `POST /api/auth/signup` again with same email → 409 `EMAIL_IN_USE`
   - `POST /api/auth/login` wrong password → 401, increments lockout counter
   - 5 wrong logins in a row → 423 `ACCOUNT_LOCKED`
   - `POST /api/auth/login` correct → 200, new cookie
   - `GET /api/auth/me` → 200 with user + workspaces[]
   - `POST /api/auth/logout` → 200, cookie cleared
   - `GET /api/auth/me` after logout → 401

**Acceptance:** all 8 cases pass.

**Run:** `npm run test`.

---

### Prompt 6: Add multi-brand tenant-isolation test (Sprint 1.1, gap H-9)

**Goal:** Prove cross-tenant access is blocked.

**Evidence:** `services/access.ts::getBrandAccess` joins through `workspace_members`, but no test exercises a 403 across users.

**Files to edit:** New: `tests/integration/tenant-isolation.test.ts`

**Exact work:**
1. Set up: user A signs up, creates workspace WA, brand BA.
2. User B signs up (different email, different workspace WB, brand BB).
3. Drive `app.fetch` calls:
   - `GET /api/brands/BA` with user B's cookie → 403 `FORBIDDEN`
   - `GET /api/brands/:BB/command-center` with user A's cookie → 403
   - `POST /api/brands/:BA/website-scans` with user B's cookie → 403
   - `POST /api/workspaces/WA/brands` with user B's cookie → 403
4. Sanity: same user accessing own brand → 200.

**Acceptance:** all 5 cases pass with right HTTP status.

**Run:** `npm run test`.

---

### Prompt 7: Add IP-based rate limiting on /api/auth/login and /signup (Sprint 1.2, gap M-6)

**Goal:** Reduce account-enumeration / credential-stuffing.

**Evidence:** `routes/auth.ts:96-145` lockout is per-account only.

**Files to inspect:** `src/server/middleware/`, `src/server/env.ts`, `wrangler.jsonc` (KV binding).

**Files to edit:**
- New: `src/server/middleware/rate-limit.ts`
- Edit: `src/server/routes/auth.ts` (apply middleware to signup/login)

**Exact work:**
1. Use `env.CACHE` (KV) to store `ratelimit:ip:<sha256(ip)>` counter with TTL.
2. Defaults: 30 req/min for login, 60 req/min for signup, per IP.
3. On exceed: 429 `RATE_LIMITED`.
4. Use `c.req.header("CF-Connecting-IP")` as IP source.

**Acceptance:** Test that 31 logins in a minute from same IP → 429.

**Run:** typecheck/lint/test/build.

---

### Prompt 8: Block IPv4-mapped IPv6 in SSRF guard (Sprint 1.6, gap SEC-7)

**Goal:** SSRF guard rejects `::ffff:127.0.0.1`.

**Evidence:** `services/security/ssrf.ts:51-77` doesn't address IPv4-mapped IPv6.

**Files to edit:** `src/server/services/security/ssrf.ts`, `tests/unit/auth-security.test.ts`.

**Exact work:**
1. In `isPrivateHostname`, add: if hostname starts with `::ffff:`, parse the trailing IPv4 portion (split on `:` then `.`) and recurse the IPv4 octet check.
2. Add test: `normalizeScanUrl("http://[::ffff:127.0.0.1]/").ok` is false.

**Acceptance:** Test added; passes.

---

### Prompt 9: Re-validate redirect targets in createWebsiteScan (Sprint 1.7, gap M-5)

**Goal:** Prevent redirect-based SSRF.

**Evidence:** `services/website-scan.ts:74-86` follows redirects without re-validation.

**Files to edit:** `src/server/services/website-scan.ts`, tests.

**Exact work:**
1. Change `fetchWebsiteText` to set `redirect: "manual"` and follow up to 3 redirects manually, calling `normalizeScanUrl` on each `Location`.
2. Stop on rejection.
3. Add test: hosting a fake redirect to `127.0.0.1` triggers blocked.

**Acceptance:** Test passes.

---

### Prompt 10: Wrap fire-and-forget DO calls with executionCtx.waitUntil (Sprint 2.2, gap H-6)

**Goal:** Ensure DO state writes complete reliably.

**Evidence:** `routes/brands.ts:530-549::startAgentIfAvailable` does `await stub.fetch(...)` but inside async helper called without `waitUntil`.

**Files to edit:** `src/server/routes/brands.ts`.

**Exact work:**
1. Change `await startAgentIfAvailable(c, brand, "onboarding/start")` to `c.executionCtx.waitUntil(startAgentIfAvailable(c, brand, "onboarding/start"))`.
2. Ensure DO state changes are durable across request lifecycle.
3. Add test that simulates concurrent onboarding/start calls.

**Acceptance:** DO state writes complete; concurrent requests don't lose activity log entries.

---

### Prompt 11: Expose pause/resume/activity through API routes (Sprint 2.3, gap H-1)

**Goal:** Make MarketingAgent's lifecycle endpoints reachable from clients.

**Evidence:** `src/server/agents/MarketingAgent.ts:45-56` implements `/pause`, `/resume`, `/activity`. No outer API route forwards there.

**Files to inspect:** `src/server/routes/brands.ts`, `src/server/agents/MarketingAgent.ts`.

**Files to edit:** `src/server/routes/brands.ts`.

**Exact work:**
1. Add `POST /api/brands/:brandId/agent/pause`, `/resume`, `GET /agent/activity`, `GET /agent/state`.
2. Each forwards to the DO via `idFromName("brand:${brandId}")`.
3. Wrap with `requireBrandAccess()` middleware.

**Acceptance:** Tests for each endpoint return DO state.

---

### Prompt 12: Document route-helper pattern + revise spec for missing agent methods (Sprint 2.1, gap H-1)

**Goal:** Resolve spec drift.

**Files to edit:** `final-strategy/DECISIONS_LOG.md`, `docs/system-dna/AGENT_SPEC.md`.

**Exact work:**
1. Add DECISIONS_LOG entry: "Agent surface uses hybrid pattern. The MarketingAgent DO holds state and lifecycle (pause/resume/onboarding-start). The 14 callable methods documented in AGENT_SPEC.md (getBrandProfile, generateContentCalendar, etc.) are implemented as Hono API routes that call services directly while reading/writing D1. The DO is not on the request path for those methods."
2. Update AGENT_SPEC.md to add a "Surface" annotation per method: DO | API route | both.

**Acceptance:** spec accurately describes architecture.

---

### Prompt 13: Add tests for MarketingAgent DO state transitions (Sprint 2.4, gap TEST-3)

**Goal:** Cover the DO state machine.

**Files to edit:** New: `tests/integration/marketing-agent.test.ts`.

**Exact work:**
1. Use `unstable_dev` to spin up a Worker with the DO.
2. Drive HTTP calls to DO endpoints (via API routes from Prompt 11):
   - GET /state initial → idle, paused=false
   - POST /onboarding/start → status=onboarding, activity logged
   - POST /pause → status=paused, paused=true
   - POST /resume → status=idle, paused=false
   - GET /activity → 4 entries
3. Test concurrent: two POST /pause in parallel; only one activity entry.

**Acceptance:** all transitions verified.

---

### Prompt 14: Remove or implement MUSTBEVIRAL_MCP DO (Sprint 2.5, gap L-2)

**Goal:** Remove dead code.

**Files to edit:** `src/server/mcp/MustBeViralMCP.ts`, `src/server/index.ts`, `wrangler.jsonc` (DO migrations).

**Exact work option A (remove):**
1. Delete `src/server/mcp/MustBeViralMCP.ts`.
2. Remove export in `src/server/index.ts`.
3. Add new DO migration tag `v2` with `deleted_classes: ["MustBeViralMCP"]`.
4. Remove DO binding in wrangler.jsonc default + env blocks.

**Exact work option B (implement):**
1. Move `runReadOnlyTool` from `routes/mcp.ts` into the DO.
2. DO endpoints: `/tools`, `/query` (proxy from API routes).

**Acceptance:** DO either gone (production manifests don't bind it) or fully functional.

---

### Prompt 15: Implement BrandOnboardingWorkflow real steps (Sprint 3.1, gap C-2)

**Goal:** Replace `runWorkflowStub` with real `step.do(...)` orchestration.

**Evidence:** `src/server/workflows/BrandOnboardingWorkflow.ts` is 14 lines.

**Files to inspect:** `services/brand-operations.ts::createMockOnboardingArtifacts`, `services/website-scan.ts`, `services/model-router.ts`, `final-strategy/07_FINAL_AGENT_WORKFLOW_STRATEGY.md`.

**Files to edit:** `src/server/workflows/BrandOnboardingWorkflow.ts`, `src/server/workflows/base.ts`.

**Exact work:**
1. Define `BrandOnboardingInput = { brandId, workspaceId, requestedBy?: string }`.
2. Implement `run(event, step)` with steps:
   - `step.do("create-workflow-run", () => writeWorkflowRun({brandId, status: "running", progress: 5}))`
   - `step.do("scan-website", () => createWebsiteScan(db, {brandId, url}))` (with retry config)
   - `step.do("score-marketing", () => generateMarketingScore(db, {scanId}))`
   - `step.do("infer-profile", () => inferBrandProfile(db, {scanFindings, brand}))` (calls ModelRouter)
   - `step.do("research-target-market", () => researchTargetMarket(db, {brand}))` (calls ModelRouter)
   - `step.do("seed-first-calendar", () => maybeSeedCalendar(db, {brand}))` (optional skip if user prefers manual)
   - `step.do("complete-workflow-run", () => writeWorkflowRun({status: "complete", progress: 100, output_json}))`
3. Each step should be idempotent. Use `step.do` retry hints (max retries, backoff).
4. Return `{ scanId, scoreId, profileId, targetId }`.

**Acceptance:** Brand onboarding via Workflow returns structured output. `workflow_runs` row updates `progress` from 5 → 100 across steps.

---

### Prompt 16: Wire brand-create to BrandOnboardingWorkflow (Sprint 3.2, gap H-5)

**Goal:** Move synchronous onboarding out of the request path.

**Files to edit:** `src/server/routes/workspaces.ts:200-216` (brand-create), `src/server/routes/brands.ts:78-89` (onboarding-start).

**Exact work:**
1. Replace `await createMockOnboardingArtifacts(db, {brand, requestedBy})` with `const instance = await c.env.BRAND_ONBOARDING_WORKFLOW.create({ params: { brandId: brand.id, workspaceId, requestedBy: auth.userId } })`.
2. Store `instance.id` in `workflow_runs.external_workflow_id`.
3. Return 202 with `{workflowInstanceId, status: "running"}`.
4. Add `GET /api/workflow-runs/:id` to poll status.

**Acceptance:** Brand creation is non-blocking; client polls workflow status.

---

### Prompt 17: Implement ContentCalendarWorkflow with real ModelRouter (Sprint 3.3)

**Goal:** Replace `generateMockContentCalendar` with workflow.

**Files to edit:** `src/server/workflows/ContentCalendarWorkflow.ts`, `src/server/services/brand-operations.ts`, `src/server/routes/brands.ts`.

**Exact work:**
1. Workflow input: `{ brandId, workspaceId, days?: number }`.
2. Steps: load brand profile → for each day, generate post via ModelRouter (`category: "premium_text"`) → insert content_post + variant.
3. Update `routes/brands.ts:211-220` to invoke workflow.

**Acceptance:** 30 brand-specific posts generated.

---

### Prompt 18: Implement ImageGenerationWorkflow with real Workers AI Flux + R2 (Sprint 3.4, gap H-2)

**Goal:** Generate real images and store in R2.

**Evidence:** `services/brand-operations.ts:438-455` writes a fictional `r2_key`.

**Files to edit:** `src/server/workflows/ImageGenerationWorkflow.ts`, `src/server/services/brand-operations.ts`, `src/server/routes/brands.ts`.

**Exact work:**
1. Verify Workers AI Flux model IDs (likely `@cf/black-forest-labs/flux-1-schnell` is canonical; the `flux-2-*` IDs in env are unverified).
2. Workflow input: `{ brandId, postId?, prompt, category }`.
3. Steps:
   - `step.do("generate", async () => env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, num_steps: 4 }))` returns binary.
   - `step.do("upload", async () => env.MEDIA_BUCKET.put(`brands/${brandId}/creatives/${creativeId}.png`, body, { httpMetadata: { contentType: "image/png" } }))`.
   - `step.do("record", async () => insertGeneratedCreative(...))`.
4. Update env defaults in wrangler.jsonc to verified models.

**Acceptance:** R2 object retrievable via signed URL; `generated_creatives.r2_key` matches.

---

### Prompt 19: Implement real Workers AI text generation in ModelRouter (Sprint 3.5, gap C-3)

**Goal:** Stop returning placeholder strings when `USE_MOCK_AI=false`.

**Evidence:** `services/model-router.ts:33-47` returns `"Configured workers_ai call placeholder for ..."` instead of calling `env.AI.run`.

**Files to edit:** `src/server/services/model-router.ts`, `tests/integration/model-router.test.ts` (new).

**Exact work:**
1. When `USE_MOCK_AI === "false"`, call `env.AI.run(this.env.DEFAULT_TEXT_MODEL, { messages: [{ role: "system", content: SYSTEM_PROMPT }, { role: "user", content: request.prompt }] })`.
2. Parse response (Workers AI returns `{response: string}` for text models).
3. Compute `cost_estimate_cents` from response usage if available; fallback to per-1000-char heuristic.
4. Wrap in try/catch; on failure, return error response with provider="workers_ai", failure_reason.
5. Sanitize `request.prompt` via `sanitizeUntrustedText` if `category` is `"compliance_review"` or origin marked untrusted.

**Acceptance:** Tests verify both mock and real branches return correct shape.

---

### Prompt 20: Implement Kimi via AI Gateway (Sprint 3.6, gap AI-3)

**Goal:** Route Kimi calls through Cloudflare AI Gateway.

**Evidence:** `Env.AI_GATEWAY_TOKEN` and `KIMI_API_KEY` declared but unused.

**Files to edit:** `src/server/services/model-router.ts`, secrets documented in `.dev.vars.example`.

**Exact work:**
1. When `DEFAULT_TEXT_MODEL` starts with `kimi-` and `KIMI_API_KEY` set, route to `https://gateway.ai.cloudflare.com/v1/<accountId>/<gatewayId>/moonshot-ai/chat/completions` with `Authorization: Bearer ${KIMI_API_KEY}`.
2. Use `env.AI_GATEWAY_TOKEN` if available for gateway auth.
3. Make accountId / gatewayId configurable via vars.

**Acceptance:** Test that Kimi path works (mockable).

---

### Prompt 21: Implement Stripe webhook event handlers (Sprint 4.1, gap C-4)

**Goal:** Process Stripe events and advance subscription state.

**Evidence:** `routes/webhooks.ts:13-45` only inserts `webhooks_inbox`.

**Files to inspect:** `routes/webhooks.ts`, `services/stripe/signature.ts`, schema `subscriptions`.

**Files to edit:**
- New: `src/server/services/stripe/events.ts`
- Edit: `src/server/routes/webhooks.ts`.

**Exact work:**
1. After signature + webhooks_inbox INSERT, dispatch on `event.type`:
   - `checkout.session.completed`: extract `metadata.workspace_id`, set `subscriptions.stripe_customer_id`, `stripe_subscription_id`, `status='active'`, `plan = metadata.plan`.
   - `customer.subscription.created`/`updated`: update `status` (trialing/active/past_due/canceled/incomplete), `current_period_end`.
   - `invoice.payment_failed`: set `status='past_due'`.
   - `customer.subscription.deleted`: set `status='canceled'`.
2. After successful processing, update `webhooks_inbox.status='processed'` + `processed_at`.
3. On unknown event types, set `status='ignored'`.
4. Audit log every successful processing.

**Acceptance:** Tests for each event type.

---

### Prompt 22: Pass user email + workspace metadata to Stripe checkout (Sprint 4.2, gap BIL-2)

**Files to edit:** `src/server/routes/billing.ts`.

**Exact work:** Add to `URLSearchParams`:
- `customer_email`: from `c.get("auth").email`.
- `client_reference_id`: workspaceId.
- `metadata[user_id]`: userId.

**Acceptance:** Verify checkout session in Stripe dashboard shows the metadata.

---

### Prompt 23: Add Stripe API error handling and Idempotency-Key (Sprint 4.3, gaps BIL-3, BIL-4)

**Files to edit:** `src/server/routes/billing.ts`, `src/server/middleware/idempotency.ts` (new).

**Exact work:**
1. After `fetch(...)`, check `response.ok`. On 4xx/5xx, parse `error.code/error.message` from Stripe and return `errorEnvelope("STRIPE_ERROR", details, 502)`.
2. Add `Idempotency-Key: ${requestId}` header to Stripe POSTs.
3. Implement `withIdempotency()` middleware that uses `idempotency_keys` table for app-level idempotency.

**Acceptance:** Tests for error paths and idempotency replay.

---

### Prompt 24: Implement plan-based entitlement enforcement (Sprint 4.4, gap H-11)

**Files to edit:**
- New: `src/server/services/entitlements.ts`
- Edit: route handlers (`workspaces.ts` brand-create, `brands.ts` AI routes).

**Exact work:**
1. Define plan caps: starter (1 brand, 50 posts/mo, 100 AI calls/mo), growth (5/500/2000), agency (15/2000/10000), managed (unlimited).
2. Read `subscriptions.plan` and aggregate `usage_events` for the workspace's current month.
3. Enforce caps with 402 `PAYMENT_REQUIRED` errors when exceeded.

**Acceptance:** Tests for each plan boundary.

---

### Prompt 25: Wire idempotency_keys for mutating routes (Sprint 4.5, gap M-2)

**Files to edit:** `src/server/middleware/idempotency.ts` (new), `src/server/routes/{workspaces,brands,billing}.ts`.

**Exact work:**
1. Middleware reads `Idempotency-Key` header.
2. If present, hash request body+key; check `idempotency_keys` table.
3. On replay, return cached response.

**Acceptance:** Tests verify duplicate-request safety.

---

### Prompt 26: Add DM rule approval endpoints (Sprint 4.6, gap M-15)

**Files to edit:** `src/server/routes/brands.ts`.

**Exact work:** Add `PATCH /:brandId/dm-rules/:ruleId` accepting `{action: "approve" | "reject"}`. Update `dm_rules.status` accordingly. Audit log.

**Acceptance:** Tests for state transitions.

---

### Prompt 27: Add HTTP-level integration tests for /api/workspaces and /api/brands (Sprint 5.1)

**Files to edit:** `tests/integration/workspaces.test.ts`, `tests/integration/brands.test.ts`.

**Exact work:** Drive `app.fetch` for: workspace create, brand create (both with and without `startOnboarding`), brand fetch, command-center fetch, profile patch, calendar generate, calendar list, approvals list, approval approve, manual export, scheduler 409 path, DM rule create.

**Acceptance:** ≥40 integration test cases.

---

### Prompt 28: Add MCP read-only enforcement test (Sprint 5.4, gap TEST-5)

**Files to edit:** `tests/integration/mcp.test.ts`.

**Exact work:** With admin user, send `POST /api/mcp/query` with:
- `{tool: "query_readonly", input: {sql: "SELECT * FROM users LIMIT 10"}}` → 200
- `{tool: "query_readonly", input: {sql: "INSERT INTO users (id) VALUES ('foo')"}}` → 400
- `{tool: "query_readonly", input: {sql: "SELECT * FROM users; DROP TABLE users"}}` → 400
- `{tool: "describe_table", input: {table: "users"}}` → 200
- `{tool: "describe_table", input: {table: "../etc/passwd"}}` → 400

**Acceptance:** All cases return correct status.

---

### Prompt 29: Add Playwright managed dev-server for e2e (Sprint 5.5, gaps TEST-7, H-12)

**Files to edit:** `playwright.config.ts`.

**Exact work:** Configure `webServer: { command: "npm run dev -- --host 127.0.0.1 --port 5176", url: "http://127.0.0.1:5176/", reuseExistingServer: !process.env.CI }`. Adjust e2e to use that port.

**Acceptance:** `npm run test:e2e` runs both specs against running dev server in CI.

---

### Prompt 30: Add scripts/prod-smoke.ts (Sprint 5.6, gap TEST-13)

**Files to edit:** New: `scripts/prod-smoke.ts`.

**Exact work:** TypeScript script that:
1. Reads `PROD_BASE_URL` env (default `https://mustbeviral.com`).
2. Runs through Codex's manual smoke: signup, login, /me, workspace create, two brand creates, command-center, onboarding rerun (idempotent assertion), website scan (private URL → 400), website scan (real URL → 201), profile, target-market, calendar, approvals, manual export 409 (unapproved), approve a post, manual export 200, image gen, dm rule, weekly report, growth, admin/MCP 403 as normal user.
3. Cleans up created users/workspaces/brands.

**Acceptance:** Script runs end-to-end against production with `npx tsx scripts/prod-smoke.ts`.

---

### Prompt 31: Add coverage gate (Sprint 5.7, gap L-7)

**Files to edit:** `vitest.config.ts`, `package.json`.

**Exact work:** Configure coverage thresholds: `lines: 70, functions: 70, branches: 60, statements: 70` for `src/server/services/**`. Add a `coverage:check` script that fails if below threshold.

**Acceptance:** CI fails if coverage drops below threshold.

---

### Prompt 32: Provision staging D1/KV/R2 (Sprint 6.1, gap M-17)

**Goal:** Make staging deployable.

**Files to edit:** `wrangler.jsonc` (env.staging), `scripts/cf-bootstrap.ts`.

**Exact work:**
1. (Manual user step:) `wrangler d1 create mustbeviral-staging`, `wrangler kv namespace create mustbeviral-staging-cache`, `wrangler r2 bucket create mustbeviral-staging-media`.
2. Capture IDs and patch `wrangler.jsonc` env.staging block (replace `00000000-…`).
3. Run `wrangler d1 migrations apply DB --env staging --remote`.
4. Configure DNS for `staging.mustbeviral.com`.

**Acceptance:** `npx wrangler deploy --env staging` succeeds.

---

### Prompt 33: Add Sentry / structured logging / dashboards (Sprint 6.2, gap M-16)

**Files to edit:** `src/server/middleware/error.ts`, `src/server/middleware/request-logging.ts`.

**Exact work:**
1. Install `@sentry/cloudflare` (or use Cloudflare's `tail` workers).
2. Wire DSN secret.
3. Capture exceptions in `handleError`.
4. Configure structured logging with `request_id`, `user_id`, `workspace_id`, `route`, `latency_ms`.
5. Add Cloudflare Analytics dashboards (4xx/5xx/p95, by route).

**Acceptance:** Errors surface in Sentry; dashboards show metrics.

---

### Prompt 34: Build /signup and /login UI (Sprint 6.3 phase A, gap C-5)

**Files to edit:** `app/routes.ts`, new files under `app/routes/`, components under `app/components/`.

**Exact work:**
1. Add routes `/signup`, `/login`.
2. Use React Router 7 `action` to POST to `/api/auth/signup` and `/api/auth/login`.
3. Show validation errors (mapped from envelope `error.details`).
4. Redirect to `/` on success.
5. Add a sign-out link in the global nav once authenticated.

**Acceptance:** Users can sign up + log in via browser; e2e test covers flow.

---

### Prompt 35: Build /workspaces and /brands creation UI (Sprint 6.3 phase B)

**Files to edit:** `app/routes/workspaces.tsx`, `app/routes/workspaces.$workspaceId.tsx`, `app/routes/brands.tsx`, `app/routes/brands.new.tsx`, components.

**Exact work:** Forms + tables consuming `/api/workspaces/*` and `/api/brands/*`.

**Acceptance:** Create workspace + brand via browser end-to-end.

---

### Prompt 36: Build core flow UI (onboarding → intelligence → profile → calendar → approvals) (Sprint 6.3 phase C)

**Files to edit:** Many under `app/routes/`.

**Exact work:** Each route loads data from its `/api` endpoint; renders status; allows actions (approve/reject, regenerate, manual export).

**Acceptance:** All MVP user actions reachable via browser.

---

### Prompt 37: Add pagination to list endpoints (Sprint 6.4, gap M-3)

**Files to edit:** `src/server/routes/{workspaces,brands}.ts`, plus tests.

**Exact work:** Accept `?limit=&cursor=` (encoded `created_at_id` pair). Default limit 20, max 100.

**Acceptance:** Tests cover pagination.

---

### Prompt 38: Split routes/brands.ts into per-feature files (Sprint 6.5, gap M-12)

**Files to edit:** `src/server/routes/brands/{onboarding,profile,intelligence,calendar,approvals,media,scheduler,dm,reports,growth,agent}.ts`, `src/server/routes/brands/index.ts`.

**Exact work:** Mechanical extraction of route groups; each file ≤200 lines.

**Acceptance:** All existing tests still pass.

---

### Prompt 39: Centralise magic numbers (Sprint 6.6, gap CQ-3, L-4)

**Files to edit:** New: `src/server/config.ts`. Edit: services importing constants.

**Exact work:** Move iteration counts, timeouts, lockout thresholds, max sizes into named constants.

**Acceptance:** No magic numbers in services; config exports typed.

---

### Prompt 40: Drop @cloudflare/workers-types per Wrangler deprecation (Sprint 6.7, gap L-5)

**Files to edit:** `package.json`, `tsconfig.cloudflare.json`, `tsconfig.node.json`.

**Exact work:** `npm uninstall @cloudflare/workers-types`. Remove from `tsconfig.json` `types`. Verify `worker-configuration.d.ts` still resolves all bindings.

**Acceptance:** typecheck passes; no warnings.

---

### Prompt 41: Drop or wire SESSION_SECRET (Sprint 6.8, gap L-3)

**Files to edit:** `src/server/env.ts`. If keeping: `src/server/services/auth/session.ts` to mix into hash.

**Exact work:** Either remove from `AppSecrets` interface OR use as HMAC key when computing `hashedToken`.

**Acceptance:** Either declaration removed OR sessions use the secret.

---

### Prompt 42: Add scheduler exports retrieval endpoint (Sprint 6.9, gap M-13)

**Files to edit:** `src/server/routes/brands.ts` (or new `routes/brands/scheduler.ts`).

**Exact work:** `GET /:brandId/scheduler/exports?status=&since=` returns `scheduled_posts` + post metadata + parsed `metadata_json`. Optional `?format=csv`.

**Acceptance:** Test coverage; CSV downloads parse cleanly.

---

### Prompt 43: Make multi-post manual export transactional (Sprint 6.10, gap M-14)

**Files to edit:** `src/server/routes/brands.ts:337-401`.

**Exact work:** Wrap loop in `db.batch([statements])` (D1 batch API). On any per-post failure, return rollup `{exported: [...], failures: [...]}` instead of partial state.

**Acceptance:** Tests for partial failure scenario.

---

### Prompt 44: Drop empty Phase 2 tables OR document (Sprint 6.11, gap M-11)

**Files to edit:** Either DECISIONS_LOG (if keeping) or new migration (if dropping).

**Exact work:** Decide per-table whether `social_scans`, `competitor_scans`, `analytics_snapshots`, `dm_events`, `creator_profiles`, `marketplace_matches`, `brand_assets` are Phase 2. Document or drop.

**Acceptance:** Schema matches Phase 1 use cases or Phase 2 plan documented.

---

### Prompt 45: Add competitor_scans index (Sprint 6.14, gap L-1)

**Files to edit:** New migration `0002_indexes.sql`.

**Exact work:** `CREATE INDEX IF NOT EXISTS idx_competitor_scans_brand ON competitor_scans(brand_id, created_at DESC);`

**Acceptance:** Migration applies cleanly.

---

## Order of execution

Run prompts 1-4 first (Sprint 0). Then 5-9 (Sprint 1). Then 10-14 (Sprint 2). Then 15-20 (Sprint 3 — biggest sprint). Then 21-26 (Sprint 4). Then 27-31 (Sprint 5). Then 32-45 (Sprint 6, in parallel with continued UI work).

The follow-up "fix-loop" prompt the user supplied:

> Read the entire `codex-audit/` directory. Do not re-audit unless a file is missing or contradictory. Execute `codex-audit/20_NEXT_CLAUDE_CODE_FIX_PROMPTS.md` in order. ...

…will iterate through these prompts one by one with the discipline rules listed (smallest safe patch, full validation gate after each, no production deploys, no live Stripe).
