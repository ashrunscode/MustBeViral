# AUDIT_SCORECARD.md

Scoring rule: 0 = absent, 5 = barely usable, 7 = good draft, 9 = production-ready, 10 = bulletproof. Implementation status drives most scores down because **there is no code**; spec quality lifts a few categories above the floor.

| Category | Score | Reason | Required Fix |
|---|---:|---|---|
| Product alignment | 7 | `PRODUCT_DNA.md` is coherent and matches multi-brand AI marketing autopilot intent. No code to verify. | Implement vertical slice (signup → brand → onboarding → calendar → manual schedule) before broadening. |
| Multi-brand readiness | 6 | Schema, agent shape, and IA all assume multi-brand. Implementation absent. | Build brand switcher, brand-scoped routes, and tenant-isolation tests. |
| Cloudflare readiness | 4 | Wrangler config is mostly correct but ships placeholders and unverified Workers AI model ids; `worker_loaders` and `ANALYTICS_INGEST_QUEUE` should be dropped. | Drop unused bindings; capability-probe FLUX models; bootstrap script for resource IDs. |
| Agent architecture | 4 | Per-brand DO design is correct; only ~3 of ~20 callable methods stubbed. | Build full agent shell + WebSocket + workflow callbacks. |
| Workflow architecture | 4 | 7 workflows specified; all stubbed at 1–2 steps. | Implement spec'd steps with idempotency, R2 large outputs, retries. |
| Database correctness | 6 | Solid 33-table schema; missing auth/sessions, idempotency, webhooks_inbox, invitations; no CHECK enums. | Add 6 tables, 7 indexes, CHECK constraints, FK clarifications. |
| API correctness | 4 | Response envelope OK; ~half the required endpoints missing; no OpenAPI source of truth. | Adopt OpenAPI/Zod; ship missing routes. |
| UI/UX quality | 5 | Wireframes solid; component map reasonable; missing standard primitives (EmptyState, ErrorBoundary, EvidenceLink). | Build the design system + primitives in week 1. |
| Security | 2 | No auth implementation; no SSRF guard; no prompt-injection sanitizer; no rate limiting; no Stripe webhook verification; no CSRF strategy. | Implement Phase 0+1 of `audit/REPAIR_PLAN.md`. |
| AI safety | 2 | Untrusted-content rule documented; no enforcement code; no compliance reviewer; no risk classifier; no evidence-required validation. | Build sanitizer + reviewer + risk classifier; gate every generation. |
| Cost control | 3 | Cost model documented; usage_events table exists; no enforcement, no centralized recorder, no per-brand caps. | Build model router + recordUsage + costGuard middleware. |
| Scheduler readiness | 3 | Manual + Vista + Buffer adapter idea documented; `SchedulerProvider` interface never defined; no implementations. | Lock interface; ship Manual first; gate Vista/Buffer behind flags. |
| Billing readiness | 2 | Stripe in deps + secrets; no plan map; no checkout/portal/webhook routes; no plan enforcement code. | Implement plans.ts + Stripe checkout/portal/webhook + enforcement. |
| Test coverage | 0 | No tests, no project. | Adopt Vitest + Playwright; tenant-iso, SSRF, webhook, compliance, idempotency, e2e onboarding. |
| Deployment readiness | 2 | Deployment runbook exists; resources unprovisioned; no CI; no smoke; no DR. | Bootstrap + secrets + CI + staging deploy + smoke + DR doc. |
| Maintainability | 4 | Clear stack choice; no code; conventions need to land before code. | Adopt strict TS + ESLint + Prettier + import boundaries + ADRs in week 1. |

**Overall (mean):** 3.6 / 10. **Spec quality alone:** ~7.0. **Implementation:** ~0. The gap is the project.

## Score Trajectory Targets

After Phase 0–1 completion (audit `REPAIR_PLAN.md`), expect:
- Cloudflare readiness: 4 → 7
- Agent architecture: 4 → 6 (shell only)
- Workflow architecture: 4 → 6 (mocks landed)
- Maintainability: 4 → 7

After Phase 2–3:
- Multi-brand readiness: 6 → 8
- API correctness: 4 → 7
- UI/UX quality: 5 → 7
- Database correctness: 6 → 8

After Phase 4–5:
- AI safety: 2 → 7
- Cost control: 3 → 7
- Billing readiness: 2 → 7
- Scheduler readiness: 3 → 6 (manual only) or 7 (with verified Vista posting)

After Phase 6:
- Security: 2 → 8
- Test coverage: 0 → 7
- Deployment readiness: 2 → 8

**MVP launch threshold:** every category >= 6 except AI safety / security / cost control which must reach >= 7. The rest can climb post-launch.
