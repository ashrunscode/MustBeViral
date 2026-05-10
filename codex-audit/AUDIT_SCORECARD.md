# Audit Scorecard (current, post-Run-7)

> Source of truth as of 2026-05-08 after Runs 1-7. The original baseline scorecard is archived at `codex-audit/_archive/AUDIT_SCORECARD_baseline_2026-05-08.md`.

20 categories scored 0-10.

| # | Category | Score | Reason | Required to reach 10 |
|---|---|---|---|---|
| 1 | Product alignment | **6** | Real Workers AI for `@cf/`, Stripe events, plan caps, real-step in 4/7 workflows. UI still static | UI rebuild (C-5); external AI providers (AI-3) |
| 2 | Multi-brand readiness | **8** | UNIQUE(workspace_id, slug); RBAC enforces brand isolation | Multi-brand integration test (H-9) |
| 3 | Cloudflare readiness | **8** | wrangler.jsonc correct, types in sync, DOs registered, 4/7 Workflows now real `step.do`, 0002 migration ready | Provision staging (M-17); finish remaining 3 workflows |
| 4 | Production safety | **8** | CVEs patched, security headers, plan caps, webhook events, idempotency-key on Stripe POSTs | Git remote + CI (H-4); observability (M-16) |
| 5 | Auth correctness | **9** | PBKDF2-SHA512 100k, salted, timing-safe, secure cookies, lockout, soft-delete check, KV IP rate limit, audit-on-logout | Session rotation flow when needed |
| 6 | RBAC correctness | **8** | requireAuth/requireAdmin/requireWorkspaceMember/requireBrandAccess; tenant isolation in queries; agent endpoints gated | Multi-brand integration test (H-9) |
| 7 | Database correctness | **9** | 37 tables, JSON-validated, status enums, indexes, 0002 migration adds 3 follow-on indexes | Phase 2 utilisation of `analytics_snapshots`, `creator_profiles`, etc. |
| 8 | Agent architecture | **6** | Hybrid pattern documented; 16 of 20 methods reachable; 4 outer API routes for DO lifecycle (state/activity/pause/resume) | Implement 4 missing methods (regenerateBrandField, generatePost, createCampaignFromOpportunity, getWorkflowStatus) |
| 9 | Workflow architecture | **5** | 4 of 7 workflows now real `step.do` with retry config (Run 7) | Finish remaining 3 stubs; wire `WORKFLOW.create` from routes (H-5) |
| 10 | API correctness | **8** | Stripe error handling, DM rule lifecycle, scheduler exports endpoint, transactional batch | Pagination (M-3), idempotency-key wiring (M-2), routes/brands.ts split (M-12) |
| 11 | UI/UX completeness | **1** | Still static — Sprint D | UI rebuild (multi-week, Prompts 34+) |
| 12 | AI model/cost safety | **6** | Real Workers AI branch for `@cf/...`, prompt-injection sanitisation opt-in, token-based cost estimate. External providers still mock | AI Gateway routing for Kimi/OpenAI/Anthropic (AI-3); image gen (H-2) |
| 13 | Scheduler readiness | **9** | Atomic batch export + retrieval endpoint, manual-only contract preserved | Vista/Buffer adapters when policy approved |
| 14 | DM automation safety | **9** | Approval lifecycle endpoints; rules-only with `requires_approval=1` hardcoded; `browserBot=false` metadata | DM execution path is Phase 2 by intent |
| 15 | Billing readiness | **8** | Webhook event handlers, plan caps, Stripe API error handling, Idempotency-Key | Integration tests on 402 cap path + Stripe replay; live key activation |
| 16 | Security posture | **8** | 0 high-CVEs, security headers, IP rate limit, IPv4-mapped IPv6 SSRF, redirect re-validation | DNS rebinding (M-4); password reset (M-7); email verification (M-8) |
| 17 | Test coverage | **4** | 12 → 24 tests. Still no HTTP integration | Sprint C — full HTTP integration suite |
| 18 | Deployment readiness | **5** | Migration 0002 ready; staging not provisioned; CI not built | Provision staging (M-17); Git remote + CI (H-4); prod-smoke script |
| 19 | Maintainability | **6** | Strict TS + clean lint; routes/brands.ts is 770 lines; magic numbers scattered | Centralise constants (L-4); split routes/brands.ts (M-12) |
| 20 | MVP sellability | **5** | API surface is sellable to operators. Browser self-serve still blocked | UI rebuild (C-5); real image gen (H-2); external AI providers (AI-3) |

## Aggregate

| Tier | Score range | Categories |
|---|---|---|
| 9-10 | Excellent | Auth (9), DB correctness (9), Scheduler (9), DM safety (9) |
| 7-8 | Good | Multi-brand (8), Cloudflare (8), Production safety (8), RBAC (8), API (8), Billing (8), Security (8) |
| 5-6 | Adequate | Product alignment (6), Agent (6), Workflow (5), AI (6), Deployment (5), Maintainability (6), MVP sellability (5) |
| 3-4 | Weak | Test coverage (4) |
| 0-2 | Critical | UI (1) |

**Mean post-Run-7:** ~6.85 / 10. **Median:** 8.

## Headline takeaways

1. **Bones still solid; flesh significantly filled in.** Auth, DB, multi-brand, Cloudflare runtime, scheduler, DM safety remain top-tier.
2. **Bleeding stopped.** No high-CVEs, security headers live, plan enforcement live, Stripe events processed.
3. **Critical-tier categories collapsed from 5 to 1.** AI moved 2→6, Workflows 1→5, Test coverage 2→4. Only UI remains in 0-2.
4. **Single critical-blocker for paid launch is now the UI rebuild (Sprint D, multi-week).** Everything else is integration-test work + staging provisioning + Stripe activation.
