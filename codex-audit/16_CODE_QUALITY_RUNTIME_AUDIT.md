# 16 — Code Quality / Runtime Audit

## TypeScript strictness

`tsconfig.json` (per Codex BUILD_LOG Milestone 2) configured with `exactOptionalPropertyTypes`. The `npm run typecheck` composite (cf-typegen + react-router typegen + tsc -b) returns 0 errors at this audit. ✅

## ESLint

`npm run lint` returns 0 issues. ✅ Codex's lint config is in `eslint.config.js` (1.4 KB).

## Code organisation

| Directory | Files | LOC | Status |
|---|---|---|---|
| `src/server/agents/` | 1 | 128 | Organised |
| `src/server/db/` | 4 + migration | ~250 | Organised |
| `src/server/http/` | 3 | ~100 (estimated) | Organised |
| `src/server/mcp/` | 1 | 19 | Stub |
| `src/server/middleware/` | 4 | ~150 (estimated) | Organised |
| `src/server/routes/` | 8 | ~1300 (sum) | Mostly organised; brands.ts is 550 lines and could be split |
| `src/server/services/` | 11 (incl. subdirs) | ~1100 (sum) | Organised |
| `src/server/utils/` | 2 | ~50 | Organised |
| `src/server/workflows/` | 8 (1 base + 7 stubs) | ~110 (sum) | Stubs are uniformly thin |

Total server LOC: ~2,871 (per Explore agent).

## Code-quality concerns

| ID | Severity | Issue | Location |
|---|---|---|---|
| CQ-1 | Medium | `routes/brands.ts` is 550 lines covering 16 endpoints. Should be split into `brands/{auth,onboarding,profile,intelligence,calendar,approvals,media,scheduler,dm,reports,growth}.ts` to keep each route group ≤200 lines | `src/server/routes/brands.ts` |
| CQ-2 | Medium | `services/brand-operations.ts` mixes mock-data generation, D1 inserts, and audit logging in the same file (474 lines). Consider extracting `mocks/` directory | `src/server/services/brand-operations.ts` |
| CQ-3 | Low | Magic numbers: 100_000 iterations, 16 saltBytes, 64 hashBytes, 5 lockout threshold, 15min lock, 30 days session, 300s tolerance, 6000ms scan timeout, 50_000 char scan truncate, 20_000 char prompt truncate. Centralise in `src/server/config.ts` | various |
| CQ-4 | Low | Unused columns: `users.email_verified_at`, `sessions.rotated_at`, `weekly_reports.pdf_r2_key`. Either wire or drop | migrations |
| CQ-5 | Low | Empty tables: `social_scans`, `competitor_scans`, `dm_events`, `analytics_snapshots`, `creator_profiles`, `marketplace_matches`, `brand_assets`, `idempotency_keys` | DB |
| CQ-6 | Low | `MUSTBEVIRAL_MCP` DO is dead code (returns 501) | `src/server/mcp/MustBeViralMCP.ts` |
| CQ-7 | Low | All 7 Workflow classes are 14-line stubs. The pattern works but obscures the spec's intent | `src/server/workflows/*.ts` |
| CQ-8 | Low | `model-router.ts` `provider === "workers_ai"` branch returns a literal string. Code reviewer should not be tricked into thinking real AI is wired | `src/server/services/model-router.ts:38-39` |
| CQ-9 | Low | `app/routes/home.tsx` static `pageMap` is 95 lines of hardcoded data. UI will need to be rebuilt against real APIs | `app/routes/home.tsx` |
| CQ-10 | Low | `routes/auth.ts` `publicUser` helper exposes `password_hash`-shaped row. Defensive programming: type-narrow or omit explicitly | `src/server/routes/auth.ts:174-176` |
| CQ-11 | Low | `routes/billing.ts` doesn't pass user email to Stripe; checkout succeeds but customer matching downstream is harder | `src/server/routes/billing.ts:112-134` |
| CQ-12 | Low | No central `config` module; env vars and constants are scattered | — |

## Runtime risks

| ID | Severity | Risk | Detail |
|---|---|---|---|
| RT-1 | High | **Synchronous onboarding inside POST /:workspaceId/brands** | `createMockOnboardingArtifacts` does 7 sequential D1 inserts inside the request. With real Workflow steps (model calls, scans, image gen), this would exceed Workers' default 30s budget. **Move to Workflow.create now** while the cost is cheap |
| RT-2 | Medium | `routes/brands.ts:537-549::startAgentIfAvailable` does fire-and-forget DO call without `c.executionCtx.waitUntil` — request returns before the DO call completes. This can mean activity log entries from concurrent requests interleave unpredictably | — |
| RT-3 | Medium | `home.tsx` SSR loader returns a `path` only. It does **not** check if the user is authenticated. Navigating to `/admin` SSR-renders the admin "page" (cosmetic only) without auth check. Once real UI is built, must move auth check into loader | — |
| RT-4 | Low | `services/website-scan.ts:74-92::fetchWebsiteText` catches all errors silently and returns "Website fetch unavailable. Using safe mock scan fallback." This is fine for safety but hides DNS/network issues from observability | — |
| RT-5 | Low | `services/model-router.ts::logUsage` does an INSERT on every text generation. Without batching, AI-heavy paths could pressure D1 writes per Worker invocation | — |
| RT-6 | Low | `services/access.ts::getBrandAccess` joins via `INNER JOIN workspace_members`. If a user has multiple workspaces with role permissions to the same brand id (impossible given `UNIQUE(workspace_id, slug)`), would return one. OK | — |
| RT-7 | Low | `services/audit.ts::writeAuditLog` does NOT batch. Every audited action writes one row | — |

## Dependency risks

| Package | Version | Severity | Status |
|---|---|---|---|
| hono | 4.11.1 | High | **19 advisories pending** |
| react-router | 7.9.6 | High | **3 advisories pending** |
| vite | 6.4.1 | High | **2 advisories pending** |
| undici | (transitive) | High | **6 advisories pending** |
| lodash | (transitive) | High | **3 advisories pending** |
| minimatch | (transitive) | High | **3 advisories pending** |
| picomatch | (transitive) | High | **2 advisories pending** |
| rollup | (transitive) | High | **1 advisory pending** |
| brace-expansion | (transitive) | Moderate | **1 advisory pending** |
| postcss | (transitive) | Moderate | **1 advisory pending** |

`@cloudflare/workers-types` deprecation: `wrangler types` now generates runtime types; the package can be removed. Codex has not actioned.

`@cloudflare/vite-plugin` 1.15.3 has known transitive vulnerabilities through miniflare; would update on `npm audit fix`.

## Refactor targets (non-blocking)

| Target | Benefit |
|---|---|
| Split `routes/brands.ts` into smaller files | Easier to navigate, reduces cognitive load |
| Extract magic numbers to `src/server/config.ts` | Easier to tune |
| Replace `INSERT` chains in mock generators with Drizzle-typed query builder when needed | Type-safety on schema changes |
| Add a single `withDb(c, async (db) => …)` helper to avoid `getDb(c.env)` in every route | DRY |
| Add `requestLogger` correlation IDs to all D1 logs | Easier debugging |
| Replace `mcp/MustBeViralMCP.ts` 501 stub with real read-only DO if MCP DO is needed | Removes dead code |
| Replace 7 Workflow stubs with one configurable stub or actually wire the workflows | Removes dead code |

## Observability

`wrangler.jsonc:7-10` sets `observability.enabled: true, head_sampling_rate: 1`. ✅ Workers Logs / Trace will capture every invocation.

* No Sentry integration
* No structured logger; `request-logging.ts` middleware (per Explore agent) likely uses `console.log`
* No metrics export
* No alerting rules

## Code quality verdict

| Dimension | Score | Reason |
|---|---|---|
| Type safety | 9/10 | Strict TS, all checks pass |
| Lint | 10/10 | Clean |
| Architecture | 6/10 | Layered correctly but UI/AI/workflow layers are stubs; large `brands.ts` route file |
| Naming | 8/10 | Clear, consistent |
| Error handling | 7/10 | Envelope pattern good; some routes throw "Brand not found after RBAC check" as raw Error |
| Comments | 5/10 | Sparse; few JSDoc; spec-side context lives in `final-strategy/` not in code |
| Security primitives | 9/10 | PBKDF2, SSRF, prompt-injection, Stripe sig, all real |
| Dependency hygiene | 3/10 | 15 unpatched advisories |
| Test coverage | 2/10 | 12 unit + 2 unrun e2e |
| Runtime correctness | 6/10 | Synchronous onboarding + fire-and-forget DO call are risks once real |

## Required fixes (immediate)

| ID | Severity | Action |
|---|---|---|
| CQ-FIX-1 | Critical | `npm audit fix --force` and re-validate the gate (typecheck/lint/test/build) |
| CQ-FIX-2 | High | Move sync onboarding to Workflow.create |
| CQ-FIX-3 | High | Add `c.executionCtx.waitUntil(...)` around fire-and-forget DO call in `startAgentIfAvailable` |
| CQ-FIX-4 | Medium | Split `routes/brands.ts` |
| CQ-FIX-5 | Medium | Add `securityHeaders()` middleware (CSP/HSTS/X-Frame-Options/Referrer-Policy) |
| CQ-FIX-6 | Medium | Centralise magic numbers to `src/server/config.ts` |
| CQ-FIX-7 | Low | Drop `@cloudflare/workers-types` per wrangler's deprecation notice |
| CQ-FIX-8 | Low | Remove `MUSTBEVIRAL_MCP` DO or implement |
