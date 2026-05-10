# Audit Scorecard

> ## ⚠️ POST-RUN-7 SCORES (2026-05-08)
>
> | # | Category | Baseline | Post-Run-7 | Δ | Reason for change |
> |---|---|---|---|---|---|
> | 1 | Product alignment | 5 | **6** | +1 | Real Workers AI for @cf/, Stripe events, plan caps. UI still static |
> | 2 | Multi-brand readiness | 8 | **8** | 0 | No integration test yet — H-9 |
> | 3 | Cloudflare readiness | 7 | **8** | +1 | 4/7 Workflows now use `step.do`; new 0002 migration |
> | 4 | Production safety | 5 | **8** | +3 | CVEs patched, security headers live, plan caps |
> | 5 | Auth correctness | 8 | **9** | +1 | KV IP rate limit, audit-on-logout |
> | 6 | RBAC correctness | 8 | **8** | 0 | No integration test yet — same as Multi-brand |
> | 7 | Database correctness | 9 | **9** | 0 | 0002 migration adds indexes |
> | 8 | Agent architecture | 3 | **6** | +3 | 4 outer API routes (state/activity/pause/resume) + AGENT_SPEC route-helper annotation |
> | 9 | Workflow architecture | 1 | **5** | +4 | 4 of 7 workflows now real `step.do`; remaining 3 stubs |
> | 10 | API correctness | 7 | **8** | +1 | Stripe error handling, DM rule lifecycle, scheduler exports endpoint, transactional batch |
> | 11 | UI/UX completeness | 1 | **1** | 0 | Still static — Sprint D |
> | 12 | AI model/cost safety | 2 | **6** | +4 | Real Workers AI branch, prompt-injection sanitisation opt-in, token-based cost estimate. External providers still mock |
> | 13 | Scheduler readiness | 8 | **9** | +1 | Atomic batch export + retrieval endpoint |
> | 14 | DM automation safety | 9 | **9** | 0 | Approval lifecycle endpoints added but design remained safe |
> | 15 | Billing readiness | 4 | **8** | +4 | Webhook event handlers, plan caps, Stripe API error handling, Idempotency-Key |
> | 16 | Security posture | 5 | **8** | +3 | 0 high-CVEs, security headers, IP rate limit, IPv4-mapped IPv6 SSRF, redirect re-validation |
> | 17 | Test coverage | 2 | **4** | +2 | 12 → 24 tests. Still no HTTP integration |
> | 18 | Deployment readiness | 4 | **5** | +1 | Migration 0002 ready; staging not provisioned; CI not built |
> | 19 | Maintainability | 6 | **6** | 0 | brands.ts grew further; centralise-constants pending |
> | 20 | MVP sellability | 2 | **5** | +3 | API surface is sellable to operators. Browser self-serve still blocked |
>
> ### Aggregate (post-Run-7)
>
> | Tier | Score range | Categories |
> |---|---|---|
> | 9-10 | Excellent | Auth (9), DB correctness (9), Scheduler (9), DM safety (9) |
> | 7-8 | Good | Multi-brand (8), Cloudflare (8), Production safety (8), RBAC (8), API (8), Billing (8), Security (8) |
> | 5-6 | Adequate | Product alignment (6), Agent (6), Workflow (5), AI (6), Deployment (5), Maintainability (6), MVP sellability (5) |
> | 3-4 | Weak | Test coverage (4) |
> | 0-2 | Critical | UI (1) |
>
> **Mean post-Run-7:** ~6.85 / 10 (was 5.4). **Median:** 8.
>
> ### Headline
>
> 1. **Bones still solid; flesh significantly filled in.** Auth, DB, multi-brand, Cloudflare runtime, scheduler, DM safety remain top-tier.
> 2. **Bleeding stopped.** No high-CVEs, security headers live, plan enforcement live, Stripe events processed.
> 3. **Two remaining "0-2" categories collapsed to one — UI.** AI moved from 2→6 (real Workers AI), Workflows from 1→5 (4/7 real-step), Test coverage from 2→4.
> 4. **Single critical-blocker for paid launch is now the UI rebuild (Sprint D, multi-week).** Everything else is integration-test work + staging provisioning + Stripe activation.

---

## Original baseline scorecard (archived 2026-05-08)

20 categories scored 0-10, with reason and required fix.

| # | Category | Score | Reason | Required Fix |
|---|---|---|---|---|
| 1 | Product alignment | 5 | Plumbing matches spec; every AI feature is mock; UI is a static stub | Wire real AI (Sprint 3); build real UI (Sprint 6.3) |
| 2 | Multi-brand readiness | 8 | UNIQUE(workspace_id, slug); RBAC enforces brand isolation; tested at primitive level | Add cross-tenant integration test (Sprint 1.1) |
| 3 | Cloudflare readiness | 7 | wrangler.jsonc correct, types in sync, DOs registered, Workflows bound | But AI/R2/KV/Workflows are bound but unused. Use them or drop them (Sprints 2-3) |
| 4 | Production safety | 5 | Routes secured, live charges disabled, admin/MCP protected; but hono/react-router CVEs unpatched, no CI, no Git remote | Sprint 0 |
| 5 | Auth correctness | 8 | PBKDF2-SHA512 100k, salted, timing-safe, secure cookies, lockout, soft-delete check | Add session rotation, IP rate limit (Sprints 1.2/1.4) |
| 6 | RBAC correctness | 8 | requireAuth/requireAdmin/requireWorkspaceMember/requireBrandAccess; tenant isolation in queries | Add HTTP-level RBAC tests (Sprint 1.1) |
| 7 | Database correctness | 9 | 37 tables, JSON-validated, status enums, indexes; only minor gaps (autonomy_level docs, dead columns) | Sprint 6 cleanup |
| 8 | Agent architecture | 3 | DO has state but only 5 of 20 spec methods exposed; route-helper pattern works around the DO | Sprint 2 |
| 9 | Workflow architecture | 1 | All 7 workflows are 14-line stubs; never invoked. The "agent + workflow" architecture is in name only | Sprint 3.1-3.4 |
| 10 | API correctness | 7 | Routes well-organised, validated, audited; no pagination, no idempotency wiring, brands.ts is 550 lines | Sprints 4.5, 6.4, 6.5 |
| 11 | UI/UX completeness | 1 | App is a static info dashboard with no forms or fetch calls; users cannot do anything in a browser | Sprint 6.3 (3-5 weeks) |
| 12 | AI model/cost safety | 2 | ModelRouter is a logging shell; both "mock" and "workers_ai" branches return string literals; no real provider call; no per-plan caps | Sprint 3.5-3.10 |
| 13 | Scheduler readiness | 8 | ManualExportAdapter real; Vista/Buffer stubs explicit; approval-before-export enforced | Add export retrieval endpoint, transactional multi-post (Sprints 6.9-6.10) |
| 14 | DM automation safety | 9 | Rules-only with `requires_approval=1` hardcoded, `browserBot=false` metadata; no execution path | Add approval/rejection endpoints (Sprint 4.6) |
| 15 | Billing readiness | 4 | Skeleton present, signature/idempotency real, live charges safely disabled; webhook does not process events; subscriptions never advance; no plan enforcement | Sprint 4.1-4.4 |
| 16 | Security posture | 5 | SSRF, prompt injection, Stripe sig solid; 15 npm advisories unpatched; no CSP/HSTS; no IP rate limit; no DNS rebinding defence; no email verification or password reset | Sprint 0 + Sprint 1 |
| 17 | Test coverage | 2 | 12 unit tests + 2 unrun e2e; no route, RBAC, multi-brand, billing, workflow, MCP, DO tests | Sprint 5 |
| 18 | Deployment readiness | 4 | Production deploys; no CI/CD; no Git remote; no rollback documented; no scripted smoke; no staging | Sprint 0 + Sprint 6 |
| 19 | Maintainability | 6 | Strict TS + clean lint; routes/brands.ts too large; magic numbers scattered; dead code (MCP DO, SESSION_SECRET, several DB tables/columns) | Sprint 6 cleanup |
| 20 | MVP sellability | 2 | Brand created today shows fake scores, generic 30-day calendar, hardcoded weekly report. Customer would not get any value | Sprint 3 |

## Aggregate

| Tier | Score range | Categories |
|---|---|---|
| 9-10 | Excellent | DB correctness (9) |
| 7-8 | Good | Multi-brand (8), Cloudflare (7), Auth (8), RBAC (8), API (7), Scheduler (8), DM safety (9) |
| 5-6 | Adequate | Product alignment (5), Production safety (5), Security posture (5), Maintainability (6) |
| 3-4 | Weak | Agent (3), Billing (4), Deployment (4) |
| 0-2 | Critical | Workflow (1), UI (1), AI (2), Tests (2), MVP sellability (2) |

**Mean score:** ~5.4 / 10. **Median:** 5.5.

## Headline takeaways

1. **The bones are solid.** Database, multi-brand isolation, auth, RBAC, scheduler safety, DM safety — all real and production-grade.
2. **The flesh is missing.** Workflows, AI, UI, billing event handling, tests are stubs or mocks.
3. **The skin is bleeding.** Hono/react-router CVEs are unpatched on a live deployment; no CI; no Git remote.

The fastest path to a sellable MVP is: Sprint 0 (1 day) → Sprint 1 (3 days) → Sprint 3 (1-2 weeks) → Sprint 6.3 (UI rebuild, 3-5 weeks). About 4-7 weeks of disciplined work.
