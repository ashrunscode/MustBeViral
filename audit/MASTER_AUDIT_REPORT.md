# MASTER_AUDIT_REPORT.md

## Executive Verdict

The working directory contains **only a system-DNA spec package and no source code**. There is no git history, no `package.json`, no Wrangler config in the working tree (it sits inside the extracted spec folder), no migrations applied, no dependencies installed, and no compiled artifacts. The "audit" of MustBeViral is therefore an audit of the *specifications* and a *build plan*, not a salvage operation.

The specifications are coherent at the architectural level (Cloudflare-native multi-brand AI marketing autopilot with `MarketingAgent` Durable Objects, Workflows, D1, R2, Workers AI, Browser Run, Stripe). They are also incomplete in concrete ways that will trip up implementers: undefined auth scheme, hardcoded model identifiers that may not exist on Workers AI, placeholder Cloudflare resource IDs, an `Env` type missing 60% of bindings, no SSRF guard, no compliance review module, no `SchedulerProvider` interface, no Stripe webhook handler, and a 84-prompt build roadmap of which 7 are filler.

**Can this repository become MustBeViral?** Yes — the specs are good enough to drive a clean build. **Can the existing code (`setup.py`'s output) be patched into a working MVP?** No. **Should we rebuild?** That is the wrong question, because nothing exists to rebuild. **Build fresh.**

## Can This Repo Become MustBeViral?

Yes, if:
1. The recommended Cloudflare template (`react-router-hono-fullstack-template`) is used as the structural starting point — not `setup.py`.
2. The 18 spec defects called out in this audit are corrected before/during scaffolding.
3. The build sequence in `CLAUDE_CODE_FIX_ROADMAP.md` is followed in order.
4. Workers AI model identifiers (FLUX.2 family, "kimi-2.6") are verified at implementation time and an HTTP-based model router is built as the indirection layer.
5. Per-brand cost guards, SSRF guards, untrusted-content sanitizer, Stripe webhook signature verification, and tenant-isolation tests land before any beta user is added.

## Keep / Refactor / Rebuild Decision

**Build fresh from `cloudflare/templates/react-router-hono-fullstack-template`.** Treat the spec set as design intent, treat `setup.py` as discarded, treat `PROMPT_ROADMAP.md` as a draft replaced by this audit's `CLAUDE_CODE_FIX_ROADMAP.md`.

## Top 25 Blockers

(Strictly in order of severity for shipping a Phase 1 MVP.)

| # | Blocker | Reference |
|---|---|---|
| 1 | **No code exists; greenfield only.** Build everything per roadmap. | audit 01 |
| 2 | **Auth scheme undefined** — no `password_hash`, no `sessions`, no OAuth flow. | audit 06, 11 (C1) |
| 3 | **Wrangler placeholders** for D1/R2/KV/Vectorize IDs. Cannot deploy. | audit 01, 05 |
| 4 | **`Env` type missing ~60% of bindings**, will TS-fail on first build. | audit 02 (#1), 05 |
| 5 | **`kimi-2.6` is not a Workers AI model**; must route via AI Gateway HTTP. | audit 02 (#3), 12 |
| 6 | **FLUX.2 model identifiers unverified.** May not exist on Workers AI. | audit 02 (#4), 12 |
| 7 | **No SSRF guard.** Browser Run + fetch fallback wide open. | audit 11 (C2) |
| 8 | **No prompt-injection sanitizer** for scanned content. | audit 11 (C3) |
| 9 | **Stripe webhook signature handling unspec'd.** | audit 11 (C4), 14 |
| 10 | **`SchedulerProvider` interface never defined.** Implementers will diverge. | audit 13 |
| 11 | **No CSRF strategy** (cookie SPA risk). | audit 11 (C5) |
| 12 | **No rate limiting** for cost-heavy AI endpoints. | audit 11 (C6), 12 |
| 13 | **No per-brand cost ceiling enforcement.** | audit 11 (C7), 12 |
| 14 | **17 of ~20 `MarketingAgent` callable methods unimplemented.** | audit 07 |
| 15 | **23-step `BrandOnboardingWorkflow` is a 2-step stub.** | audit 08 |
| 16 | **No `tsconfig.json` / `vite.config.ts` / `tailwind.config.js`** — first build fails. | audit 16 |
| 17 | **`worker_loaders` binding unjustified** (drop for MVP). | audit 02 (#12), 04 |
| 18 | **`ANALYTICS_INGEST_QUEUE`** premature scope (drop for MVP). | audit 04 |
| 19 | **Vectorize** included with mismatched dimension assumptions; defer. | audit 02 (#5), 04 |
| 20 | **No batch-approve API** despite UX needing it. | audit 09 |
| 21 | **No invitations table** despite agency/multi-member persona. | audit 06 |
| 22 | **No idempotency_keys table** for safe POST retries. | audit 06 |
| 23 | **No webhooks_inbox table** for Stripe duplicate protection. | audit 06, 14 |
| 24 | **No CI pipeline** designed. | audit 16 |
| 25 | **No tests of any kind.** | audit 15 |

## Top 25 Missing Systems

| # | System |
|---|---|
| 1 | Auth (signup/login/logout/me + sessions) |
| 2 | RBAC middleware (`requireWorkspaceMember`, `requireBrandAccess`, `requireAdmin`) |
| 3 | SSRF guard (`assertSafeUrl`) |
| 4 | Untrusted-content sanitizer |
| 5 | Compliance review service (forbidden phrases, risk classification) |
| 6 | Cost guard middleware + KV-summarized usage ledger |
| 7 | Rate limit middleware |
| 8 | Idempotency middleware |
| 9 | Audit logging middleware |
| 10 | Model router with capability discovery + AI Gateway routing |
| 11 | `SchedulerProvider` interface + `ManualExportAdapter` |
| 12 | Stripe checkout / portal / webhook |
| 13 | All 7 Workflows (real implementations) |
| 14 | All ~20 MarketingAgent callable methods |
| 15 | 13 sub-agent role functions (BusinessIntake, WebsiteResearch, ...) |
| 16 | Prompt template store (versioned) |
| 17 | Browser Run service with safe URL + size/time caps |
| 18 | R2 upload service + signed URL helper |
| 19 | Cloudflare Images variant pipeline |
| 20 | DM rule CRUD + provider gating |
| 21 | Weekly report PDF generator (`pdf-lib`) |
| 22 | Real-time agent WebSocket protocol |
| 23 | Admin dashboard + failed-job retry endpoint |
| 24 | Tenant isolation tests |
| 25 | E2E onboarding journey test |

## Top 25 Useful Existing Ideas / Files

| # | Asset | Why useful |
|---|---|---|
| 1 | `PRODUCT_DNA.md` | Coherent product framing |
| 2 | `ARCHITECTURE.md` | Clear stack decisions and request flows |
| 3 | `wrangler.jsonc` | 90% of bindings correctly listed |
| 4 | `DATABASE_SCHEMA.sql` | Well-structured 33-table multi-brand schema |
| 5 | `AGENT_SPEC.md` | Methods + guardrails are correct shape |
| 6 | `WORKFLOWS_SPEC.md` | Correct workflow taxonomy |
| 7 | `API_CONTRACTS.md` | Good response envelope; route shapes are sane |
| 8 | `UI_WIREFRAMES.md` | Solid IA for every product surface |
| 9 | `COMPONENT_MAP.md` | Reasonable component decomposition |
| 10 | `SECURITY_CHECKLIST.md` | Captures the right concerns even though all unchecked |
| 11 | `COST_MODEL.md` | Cost categorization aligns with `usage_events` schema |
| 12 | `RESEARCHED_PLATFORM_NOTES.md` | Cloudflare anchor list saves research time |
| 13 | `CLOUDFLARE_TEMPLATES_AUDIT.md` | Picks the right base template |
| 14 | `llms.txt` | Concise "what to do / what not to do" reference |
| 15 | `TEST_PLAN.md` | Right test categories, even if shallow |
| 16 | `DEPLOYMENT_RUNBOOK.md` | Lists every secret that must exist |
| 17 | Pricing tier definitions | Plug-and-play into `plans.ts` |
| 18 | Multi-brand ID convention (`UNIQUE(workspace_id, slug)`) | Correct |
| 19 | `usage_events` table | Drop-in cost ledger |
| 20 | `audit_logs` table | Drop-in audit ledger |
| 21 | `workflow_runs` and `agent_runs` tables | Operational visibility from day 1 |
| 22 | `marketing_scores` 8-dim model | Concrete rubric anchor |
| 23 | `growth_opportunities` schema | Reusable for cross-sell + content gap |
| 24 | Rejected scope list (containers, Postgres, microfrontend) | Saves wasted effort |
| 25 | Approval-first publishing rule | Codified across multiple docs |

## Security Risk Summary

7 Critical, 10 High, 8 Medium, 4 Low (audit 11). The criticals are dominated by *missing* foundational controls (auth, SSRF guard, prompt injection, webhook signature, CSRF, rate limit, cost guard). **None can ship without these.**

## Cloudflare Compatibility Summary

Architecture is Workers-native and the binding choice is sound. Three concrete drops (`worker_loaders`, `ANALYTICS_INGEST_QUEUE`, `Vectorize` for MVP) eliminate scope risk. Resource IDs must be provisioned via a bootstrap script. Workers AI model identifiers must be verified at implementation time with a fallback path.

## Product Logic Summary

17 P0 features, 9 P1 features, 5 P2, 1 P3. The "magic moment" path (signup → workspace → brand → onboarding scan → intelligence report → calendar → approvals → manual schedule → weekly report) is well-designed; everything required is in spec but unimplemented. Build it as one vertical slice end-to-end with mocks before adding breadth.

## UI/UX Summary

Wireframe set is solid; component map is granular enough. Mobile approval-first stance is correct. The big design risks are: chat-first creep, generic "viral" UX, missing empty/loading/error primitives. Build a tight design system in week 1, never chase ShadCN updates blindly.

## Data Model Summary

33 tables, well-shaped. **6 tables to add** (sessions, oauth_accounts, password row or column on users, invitations, webhooks_inbox, idempotency_keys). **7 indexes to add**. **CHECK constraints for status enums.** D1 foreign-key enforcement caveat documented.

## Agent / Workflow Summary

Per-brand `MarketingAgent` is the right shape. Sub-agents should be functions, not DOs. All 7 Workflows must be implemented from scratch using `step.do` idempotency, R2 for large step outputs, and Workflow → Agent progress callbacks via `onWorkflowProgress/Complete/Error`.

## Testing / Build Summary

No tests, no builds. Establish Vitest + Playwright + `@cloudflare/vitest-pool-workers` from day 1. CI must run typecheck, lint, test, build on every PR; staging deploy + E2E smoke on `main`; production deploy via manual approval.

## Recommended Final Architecture

(Detail in audit 04.)

```
src/client      React Router SPA
src/server      Hono entrypoint, middleware, routes, agents, workflows, services, prompts, db
src/shared      Zod schemas + enums shared client/server
tests           unit / integration / e2e
docs            specs preserved + runbooks
scripts         cf-bootstrap, cf-secrets, seeds
```

Drop from MVP: `worker_loaders`, `ANALYTICS_INGEST_QUEUE`, Vectorize, influencer marketplace UI.

## Recommended Implementation Sequence

1. **Bootstrap** — scaffold from template; lock dep versions; commit lockfile; init git.
2. **Cloudflare resources** — bootstrap script provisions and patches `wrangler.jsonc`.
3. **Foundation** — Hono entrypoint + `Env` + middleware (auth/rbac/audit/cost/rate/idempotency) + Drizzle.
4. **Auth + workspaces + brands** — vertical slice landing the IA.
5. **MarketingAgent shell** — DO with all callable signatures (mocked bodies returning plausible data).
6. **Onboarding workflow with mocks** — full 23-step path returning fake but realistic data; ship the scan UI.
7. **Brand intelligence report UI** — magic moment one.
8. **Brand profile editor + locks/regen.**
9. **Calendar generation workflow** with mocks.
10. **Calendar UI + approval queue + manual export adapter.**
11. **Image generation** — wire FLUX (with capability probe) to `MarketingAgent`.
12. **Replace mocks with real LLM calls** progressively, gated by cost guard + compliance review.
13. **Stripe billing** — checkout, portal, webhook, plan enforcement.
14. **Admin dashboard** — workflow retry, usage viewer, audit viewer.
15. **Weekly report + growth opportunities + DM rule CRUD.**
16. **MCP read-only server.**
17. **Hardening** — security headers, CSP, structured logging, observability.
18. **Tests** — climb to coverage thresholds; tenant isolation; webhook fixtures.
19. **Staging deploy + E2E.**
20. **Production launch checklist.**

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| FLUX.2 ids invalid on Workers AI | Med | High (image gen breaks) | Capability probe + FLUX.1 fallback |
| Vista Social DM API doesn't exist as assumed | High | Med (DM provider path useless) | Defer DM activation; CRUD only |
| Browser Run blocked by social platforms | High | Med (thin signal from social scan) | Graceful degradation; show what was found |
| Cost runaway from regenerate loops | Med | High | Cost guard + per-action confirms |
| Auth choice changes mid-build | Med | High | Decide auth scheme in week 1; lock |
| Migration churn | Med | Med | Drizzle Kit; never edit applied migrations |
| Stripe webhook missed events | Low | High | Stripe retries automatically; poll subscription state on read |
| Tenant data leak | Low | Critical | Tenant isolation tests + middleware everywhere |
| Worker bundle size > 1MB | Low | Med | Tree-shake; avoid `moment`/`lodash`; use `pdf-lib` not `pdfkit` |
| DO storage growth on agent state | Low | Low | Cap state arrays; offload to D1 |

## Fix Plan (One Page)

1. **Decide auth model.** (See Repair Plan Phase 0.)
2. **Scaffold from template + commit.**
3. **Bootstrap Cloudflare resources.**
4. **Land foundation middleware.**
5. **Land schema + migrations.**
6. **Vertical slice signup → brand → mocked onboarding → calendar → approval → manual schedule.**
7. **Replace mocks with real services in cost-guarded order.**
8. **Stripe + plan enforcement.**
9. **Admin + observability.**
10. **Hardening + tests + staging launch.**

## Final Verdict

```
FINAL VERDICT:
- Product idea:        STRONG (clear ICP, magic moment, retention loop, pricing tiers)
- Current codebase:    NONE (rebuild not applicable; greenfield build required)
- Architecture:        CORRECT (Cloudflare-native, multi-brand, agent + workflow split)
- Cloudflare readiness:PARTIAL (config valid in shape; placeholders + Workers AI model ids unverified)
- MVP readiness:       NOT READY (no code; ~6–10 weeks of disciplined build to MVP)
- Recommendation:      CLEAN BUILD from cloudflare/templates/react-router-hono-fullstack-template,
                       executing CLAUDE_CODE_FIX_ROADMAP.md in order.
```

## Exact Next Command / Prompt to Run

```bash
# Step 1 — scaffold from the chosen Cloudflare template into the working directory.
# (Run interactively; the template wizard will name the project.)
cd C:\Users\ernij\OneDrive\Documents\V2\dev\MustBeViral
npm create cloudflare@latest -- mustbeviral --template=cloudflare/templates/react-router-hono-fullstack-template --no-deploy --git
```

Then open Claude Code in the new project and start at `CLAUDE_CODE_FIX_ROADMAP.md` Prompt 1.
