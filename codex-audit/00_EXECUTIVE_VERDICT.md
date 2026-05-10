# 00 — Executive Verdict (current, post-Run-7)

> Source of truth as of 2026-05-08 after Runs 1-7. The original baseline TL;DR + verdicts are archived at `codex-audit/_archive/00_EXECUTIVE_VERDICT_baseline_2026-05-08.md`.

## TL;DR

**The Codex baseline build was a clean Cloudflare-native scaffold with strong security primitives but mostly mocks behind every customer-visible feature. Runs 1-7 turned it into a sellable foundation.** Auth, RBAC, multi-brand isolation, DB schema, security primitives, Stripe webhook event handling, plan-cap enforcement, real Workers AI for `@cf/...` models, security headers, IP rate limit, and 4 of 7 Workflows now run real `step.do` orchestration. **Still blocking paid-customer launch:** the UI rebuild (multi-week C-5), HTTP integration test suite (C-6), real image generation + R2 (H-2), AI Gateway routing for external providers (AI-3), `WORKFLOW.create` route invocation (H-5), staging provisioning (M-17), Git remote + CI/CD (H-4), observability (M-16).

## Audit verdicts

| Question | Answer |
|---|---|
| Did Codex actually build a sellable MVP, or mostly a skeleton? | **Skeleton + significant flesh.** Plumbing is real, security is real, billing event handling is real, plan enforcement is real, real Workers AI for `@cf/...` models. UI is still a static placeholder; external AI providers and image gen still pending |
| Is production deployment safe? | **Yes.** CVEs patched. Security headers live. Plan caps enforced. Webhook processes events. Stripe live-activation gate is technically met but recommended to gate on integration tests |
| Is production deployment useful to customers? | **For API consumers, yes.** For browser users, **no** until UI rebuild ships |
| Are auth/RBAC truly implemented or skeleton? | **Truly implemented.** Strongest area still |
| Is multi-brand truly implemented and protected? | **Yes.** No integration test yet (H-9 still open) |
| Is MarketingAgent real or mostly stub? | **Hybrid pattern documented.** DO has 5 lifecycle endpoints + 4 outer API routes (state/activity/pause/resume). 16 of 20 spec methods reachable via API; 4 still missing |
| Are Workflows real or mostly stub? | **4 of 7 real `step.do` with retry config.** Image / ApprovalScheduling / DMAutomationSetup still stubs. Routes still call sync mocks (H-5 pending) |
| Is onboarding real or deterministic mock? | **Mock-safe** generator now wrapped in real `step.do`. Real per-step decomposition pending |
| Is brand intelligence real or mock? | **Mock** |
| Is content calendar real or mock? | **Mock** |
| Are approvals enforced? | **Yes** |
| Is manual export real? | **Yes — atomic batch + retrieval endpoint** |
| Is DM automation safe? | **Yes — plus approval/reject/pause/activate endpoints** |
| Is Stripe safe? | **Yes — webhook events processed, idempotent, replay-aware. Live keys still off until integration tests pass** |
| Are tests sufficient? | **Better — 24 tests up from 12. Still no HTTP integration suite. C-6 / Sprint C is the next gate** |
| Should development continue from Codex's work or roll back/rebuild parts? | **Continue.** No rebuild needed |
| What must be fixed before live customers? | UI (C-5), real image gen (H-2), AI Gateway external providers (AI-3), HTTP integration tests (Sprint C) |
| What must be fixed before live Stripe? | Integration tests covering plan-cap 402 + Stripe replay (Sprint C). Then secret writes |
| What must be fixed before production remains public? | Already safe |
| What is the exact next fix? | **Prompt 18 — ImageGenerationWorkflow + Workers AI Flux + R2 upload + media proxy** |

## Top 10 open gaps (post-Run-7)

1. **(Critical, C-5)** UI rebuild — `app/routes/home.tsx` is still a static info dashboard. No forms, no fetch calls. Customers cannot use the product through a browser. Multi-week scope (Sprint D).
2. **(Critical, C-6)** No HTTP-level integration test suite. 24 unit tests + 2 unrun e2e specs. Sprint C blocks Stripe live activation.
3. **(High, H-2)** Image generation never calls Workers AI Flux and never uploads to R2. `generated_creatives.r2_key` still points at a mock path. **Prompt 18 — top priority.**
4. **(High, H-4)** No Git remote, no CI/CD. All deploys manual from a developer's laptop.
5. **(High, H-5)** Synchronous onboarding inside POST `/:workspaceId/brands`. Workflows are now ready to be invoked but routes still call sync mock generators. **Prompt 16.**
6. **(Critical-partial, C-3 finish / AI-3)** External AI providers (Kimi, OpenAI, Anthropic) fall back to mock; AI Gateway routing not wired. **Prompt 20.**
7. **(Critical-partial, C-2 finish)** ImageGeneration / ApprovalScheduling / DMAutomationSetup workflows still stubs.
8. **(Medium, M-16)** No Sentry / structured dashboards / alerts.
9. **(Medium, M-17)** Staging bindings still placeholder; staging is not deployable. **Prompt 32 (needs user confirmation).**
10. **(High-partial, H-1 finish)** 4 spec methods still missing on MarketingAgent surface (regenerateBrandField, generatePost, createCampaignFromOpportunity, getWorkflowStatus).

(See `17_GAP_REGISTER.md` for all 51 gaps with current status.)

## Immediate next 10 fixes (Run 8+ recommended order)

1. **Prompt 18** — ImageGenerationWorkflow + Workers AI Flux + R2 upload + `GET /api/brands/:brandId/media/:creativeId` proxy.
2. **Prompt 20** — Kimi / external providers via AI Gateway routing in ModelRouter.
3. Finish remaining 2 workflow stubs (ApprovalSchedulingWorkflow, DMAutomationSetupWorkflow).
4. **Prompt 16** — Switch routes to `c.env.X_WORKFLOW.create({params: {...}})`. Add `GET /api/workflow-runs/:id` for status polling.
5. **Prompts 5, 6** — HTTP integration tests for /api/auth and multi-brand isolation.
6. **Prompts 27, 28, 29** — HTTP integration tests for workspaces/brands, MCP read-only, e2e managed dev-server.
7. **Prompt 30** — `scripts/prod-smoke.ts` for production smoke from CI.
8. **Prompt 31** — Coverage threshold gate.
9. **Prompt 32** — Provision staging (requires user confirmation).
10. **Prompt 3** — Git remote + CI workflow (requires user confirmation).

## Codex's claim verification rollup (post-Run-7 reconciliation)

| Claim category | Status |
|---|---|
| Toolchain (typecheck/lint/test/build pass) | ✅ Confirmed every run |
| Test count "5 files / 12 tests" (baseline) | ✅ Confirmed; now grown to **7 files / 24 tests** |
| Production deploy + apex/www routes | ✅ Confirmed via wrangler.jsonc; live deploy version unverified by audit |
| Workers PBKDF2 limit fix at 100k | ✅ Real and tested |
| Onboarding rerun idempotency | ✅ Real (`brand-operations.ts:101-119`) |
| SSRF block | ✅ Real, tested, hardened (Run 1 added IPv4-mapped IPv6) |
| Approval-before-export guard | ✅ Real |
| Stripe webhook signature | ✅ Real |
| Stripe live charges disabled | ✅ Still off; gates documented |
| MarketingAgent "20 callable methods" | ⚠️ Hybrid pattern — 16 reachable via API, 4 missing. Documented in AGENT_SPEC.md |
| 7 Workflows | 🟡 4 of 7 now real `step.do`; 3 still stubs |
| `npm audit` | ✅ 0 high-CVEs (was 15 advisories at baseline) |
