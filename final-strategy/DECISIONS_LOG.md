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
