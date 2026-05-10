# Decisions Log

## 2026-05-07: Clean Build

Decision:
- Build fresh from Cloudflare `react-router-hono-fullstack-template`.

Reason:
- Actual repo state has no runnable app code. Claude audit and repo inventory agree.

## 2026-05-07: Auth

Decision:
- Use custom D1-backed email/password auth with server-side sessions and future OAuth.

Reason:
- It fits Cloudflare-native MVP requirements, supports revocation, and avoids forcing an external auth dependency before the product shell exists.

## 2026-05-07: Scheduling

Decision:
- Manual export is the only enabled Phase 1 scheduler. Vista Social and Buffer are typed skeletons until verified.

Reason:
- Phase 1 must not depend on direct social APIs or unverified provider behavior.

## 2026-05-07: AI Providers

Decision:
- Model calls go through `ModelRouter`; Kimi is external-only; FLUX IDs are configurable and probed.

Reason:
- Audit identified invalid and unverified model assumptions.

## 2026-05-07: Scaffold Location

Decision:
- Scaffold into `mustbeviral-app/` first, then move generated app files to the workspace root.

Reason:
- The workspace root already contained preserved audit, DNA, and strategy docs. A temporary scaffold directory avoided overwriting docs while still ending with root-level `package.json`, `app/`, `workers/`, and `wrangler.jsonc`.

## 2026-05-07: Local Cloudflare Placeholders

Decision:
- Use syntactically valid local placeholder IDs/names in `wrangler.jsonc` for D1, R2, and KV.

Reason:
- Wrangler 4.90 validates binding shapes during type generation and build. Invalid underscore placeholders block local gates, while real Cloudflare provisioning is intentionally deferred.

## 2026-05-08: Production Deploy Gate

Decision:
- Production deployment is in scope only after the MVP gates pass and real Cloudflare production bindings/secrets are patched.

Reason:
- Deploying the current product shell before real D1/KV/R2 IDs, Stripe secrets, and production smoke checks would put a partially configured Worker behind `mustbeviral.com`.

## 2026-05-08: Mock-Safe MVP Core

Decision:
- Implement the full Phase 1 product surface with mock-safe agent, AI, scheduler, report, image, and growth workflows before enabling live providers.

Reason:
- Phase 1 must be sellable and safe without direct social APIs, unsafe DM automation, or trusted scanned content. Manual export and approval guardrails are production prerequisites.

## 2026-05-08: Workers-Compatible PBKDF2 Cap

Decision:
- Cap the custom email/password PBKDF2-SHA512 iteration count at 100,000.

Reason:
- Cloudflare Workers rejected the previous 120,000 iteration setting during production signup with `iteration counts above 100000 are not supported`. The lower value preserves the selected WebCrypto-compatible strategy and is now covered by a regression assertion.

## 2026-05-08: Onboarding Start Idempotency

Decision:
- Treat a completed `BrandOnboardingWorkflow` as an idempotent success when onboarding is started again for the same brand.

Reason:
- Brand creation can auto-run onboarding. A later explicit `startOnboardingScan` must be safe to rerun and return existing artifact IDs instead of attempting to recreate version-1 onboarding records.

## 2026-05-08: Protected MCP In Production

Decision:
- Keep MCP routes admin-protected in production.

Reason:
- The MCP server is read-only, but it still exposes operational business data. Production smoke validates normal-user denial; admin-user MCP smoke should use an explicit admin account or seed path.

## 2026-05-08: Route-Helper Agent Surface Pattern

Decision:
- Expose the 20 MarketingAgent callable methods documented in `docs/system-dna/AGENT_SPEC.md` as a hybrid: 5 methods on the Durable Object itself (state/command-center, pause, resume, activity, onboarding/start) and 15 methods as plain Hono API routes under `/api/brands/:brandId/*` that call service helpers and read/write D1 directly (the "route-helper" pattern).

Reason:
- The DO is the right home for state-machine concerns (current status, pause/resume, activity log, onboarding lifecycle) where serialised request handling and durable storage matter. It is over-engineering for stateless reads (getBrandProfile) and synchronous writes (updateBrandProfile, approvePost) that are already tenant-isolated by RBAC and protected by D1 transactions. The route-helper pattern avoids a per-request DO round-trip for those methods while keeping the surface contract recognisable.

Caveat:
- AGENT_SPEC.md should mark each method's surface (DO vs API route vs both) so contributors know which methods can read DO state directly.

## 2026-05-08: Brand Autonomy Level Ceiling

Decision:
- `brands.autonomy_level` is constrained to 0-89 in the migration (`CHECK (autonomy_level >= 0 AND autonomy_level <= 89)`), not 0-100 as in the system DNA spec.

Reason:
- The Phase 1 non-negotiable is approval-before-publish/schedule. A 100% autonomy ceiling would imply a configuration where the agent could bypass approvals. Capping at 89 leaves explicit room for manual override and signals to operators that fully autonomous publishing is out of scope for Phase 1.

Caveat:
- Future phases can raise the cap when an automated approval workflow exists.

## 2026-05-08: Multi-Device Sessions

Decision:
- Successful login does NOT revoke prior unrevoked sessions for the same user. Each successful authentication issues an additional row in the `sessions` table (one cookie per device), and only `/auth/logout` (single-device) or future bulk revocation tooling clears existing sessions.

Reason:
- The product is a multi-brand operations cockpit; users routinely work from a phone and a laptop simultaneously. Auto-revoking on login would degrade that UX. Sessions still age out (`expires_at` 30 days), and individual sessions can be revoked by the owning user via logout. The `sessions.rotated_at` column is reserved for a future "rotate session token without invalidating the session row" behaviour and remains unused today.

Caveat:
- A future "log out everywhere" flow should iterate `sessions WHERE user_id=? AND revoked_at IS NULL` and set `revoked_at = CURRENT_TIMESTAMP` for each row. That is out of scope for Phase 1.

## 2026-05-08: Stripe Live Activation Gate

Decision:
- Do NOT configure `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / live `STRIPE_PRICE_*` IDs in production until `routes/webhooks.ts` implements event handlers (`checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`).

Reason:
- Today the Stripe webhook only inserts to `webhooks_inbox` and returns 200; no `subscriptions` row updates, no entitlement transitions. Configuring secrets without event handling would book payments without delivering value. Code returns `{configured: false}` in absence of secrets, which is the safe path until the handlers ship (`codex-audit/13_BILLING_STRIPE_AUDIT.md`, gap C-4).

## 2026-05-08: Workers AI Flux Output Shape

Decision:
- Treat Workers AI Flux image output as base64 (`{ image: string }`) inside `ModelRouter`, then decode to PNG bytes only inside the R2 upload step of `ImageGenerationWorkflow`.

Reason:
- Current Wrangler model catalog/types and Cloudflare's Flux 2 Workers Binding docs show Flux outputs as base64 image strings, while Workflow `step.do` boundaries are safer when they carry JSON-only values. R2 still stores real PNG bytes at `creatives/<brandId>/<creativeId>.png`.

Caveat:
- The image output normalizer also accepts base64 strings, `ArrayBuffer`, `Uint8Array`, and `ReadableStream` so the route remains defensive if a Workers AI model returns a different body shape later. Image cost estimates are intentionally rough until model-specific pricing is centralized.

## 2026-05-08: Kimi AI Gateway Routing

Decision:
- Treat configured `kimi-*` model IDs as external Moonshot/Kimi provider IDs routed through Cloudflare AI Gateway. Require `AI_GATEWAY_ACCOUNT_ID` and `KIMI_API_KEY`; use `AI_GATEWAY_ID=default` when omitted; attach `AI_GATEWAY_TOKEN` as `cf-aig-authorization` when configured. Missing config falls back to mock with an explicit `failureReason`.

Reason:
- `kimi-2.6` is a configured external default, not a Workers AI `@cf/...` model ID. Routing it through AI Gateway keeps provider calls observable and avoids silently rewriting the model to a different Cloudflare-hosted catalog model.

Caveat:
- If the product chooses a hosted Workers AI Kimi model later, set `DEFAULT_TEXT_MODEL` to the exact `@cf/...` model ID and `ModelRouter` will use `env.AI.run` instead of the external Gateway branch.

## 2026-05-09: Cookie-Backed Mutation CSRF Guard

Decision:
- Add a Hono middleware that blocks mutating requests carrying the `mbv_session` cookie unless the request has an allowed `Origin` or same-origin/same-site fetch metadata.

Reason:
- `SameSite=Lax` reduces CSRF exposure but does not give the API a first-party proof point. The app is cookie-authenticated for browser users, so mutating API routes need an explicit origin posture check while preserving bearer-token and webhook-style non-cookie requests.

Caveat:
- External webhooks and non-browser API calls that do not carry `mbv_session` are not blocked by this middleware. If a future external integration uses cookies, it must supply an approved same-origin posture or use a non-cookie auth model.
