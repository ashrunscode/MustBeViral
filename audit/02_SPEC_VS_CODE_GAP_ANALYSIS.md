# 02_SPEC_VS_CODE_GAP_ANALYSIS.md

## Intended Product

Per `PRODUCT_DNA.md` + `llms.txt`:

> A Cloudflare-native multi-brand AI marketing autopilot. One user → many workspaces → many brands. Each brand owns a persistent `MarketingAgent` (Durable Object) that runs onboarding scans (website + social + competitor), generates a brand intelligence report and 30-day content calendar with FLUX images, manages an approval queue, schedules approved posts via Vista Social / Buffer / Manual Export, runs DM automation through approved integrations only, generates weekly reports, and proposes growth opportunities. Stripe billing across Starter/Growth/Agency/Managed tiers. Admin dashboard from day 1.

## Actual Current Code

```
Lines of TypeScript:    0
Lines of TSX:           0
Lines of SQL applied:   0
Routes implemented:     0
Components shipped:     0
Tests:                  0
Migrations applied:     0
Cloudflare resources:   0 (provisioning script not present)
Stripe integration:     0
Auth implementation:    0
```

The only "code" is in `setup.py`'s 13 string templates, none of which is sufficient to compile or run.

## Major Alignment

When the spec set is internally consistent with itself, alignment is high:

- ✅ Stack choice (Workers, Hono, React Router, Tailwind, ShadCN, Drizzle-or-light-typed-layer, Vite) is coherent.
- ✅ Multi-brand / multi-workspace data model in `DATABASE_SCHEMA.sql` matches the personas in `PRODUCT_DNA.md`.
- ✅ `MarketingAgent` per-brand model is consistent across `ARCHITECTURE.md`, `AGENT_SPEC.md`, `wrangler.jsonc`, `llms.txt`.
- ✅ Workflow set in `wrangler.jsonc` exactly matches `WORKFLOWS_SPEC.md` (7 entries).
- ✅ Approval-first publishing rule appears in `PRODUCT_DNA.md` UX rules, `AGENT_SPEC.md` guardrails, `SECURITY_CHECKLIST.md`, `llms.txt` golden rules — consistent.
- ✅ "Untrusted scanned content" rule appears in 3 places — consistent.
- ✅ Pricing tiers in `PRODUCT_DNA.md` align with cost guardrails in `COST_MODEL.md`.

## Major Contradictions

Real spec defects that will bite implementers:

| # | Contradiction | Source |
|---|---|---|
| 1 | `wrangler.jsonc` declares `BROWSER`, `LOADER`, `VECTORIZE`, `CACHE`, queue producers, and 7 Workflow bindings, but `setup.py`'s `Env` type only declares `DB`, `MEDIA_BUCKET`, `AI`, `MARKETING_AGENT`, `MUSTBEVIRAL_MCP`. Implementer will get type errors or write `as any` everywhere. | `wrangler.jsonc` ↔ `setup.py:src/server/index.ts` |
| 2 | `setup.py` references `c.env.ASSETS` in the request handler but `Env` does not declare `ASSETS: Fetcher`. | `setup.py` line 119 vs lines 104–110 |
| 3 | `wrangler.jsonc` sets `DEFAULT_TEXT_MODEL: "kimi-2.6"`, implying Workers AI binding usage. Kimi is Moonshot AI; not on the `env.AI.run()` catalog. Must be called via `fetch` to AI Gateway. The variable name suggests otherwise. | `wrangler.jsonc:19` |
| 4 | FLUX.2 model identifiers (`@cf/black-forest-labs/flux-2-klein-9b/4b/dev`) are unverified against Workers AI catalog. As of public knowledge, only FLUX.1 family is on Workers AI. **Models may not exist.** | `wrangler.jsonc:20-22`, `RESEARCHED_PLATFORM_NOTES.md:50-58` |
| 5 | `DEPLOYMENT_RUNBOOK.md` creates Vectorize at `dimensions=1536`. Workers AI native embeddings are 768/1024 dim. If embeddings default to Workers AI to control cost, the index is wrong. | `DEPLOYMENT_RUNBOOK.md:19` |
| 6 | `DATABASE_SCHEMA.sql` has no `password_hash`, no `sessions`, no `oauth_accounts` table, but `DEPLOYMENT_RUNBOOK.md` provisions `SESSION_SECRET`. Auth scheme is undefined. | `DATABASE_SCHEMA.sql:7–16` ↔ `DEPLOYMENT_RUNBOOK.md:27` |
| 7 | `API_CONTRACTS.md` defines `POST /api/auth/signup` with `email/password` body but `DATABASE_SCHEMA.sql` has no password column. | `API_CONTRACTS.md:32–37` ↔ `DATABASE_SCHEMA.sql:7–16` |
| 8 | `MarketingAgent` callable methods include `scheduleApprovedPosts`, `generateWeeklyReport`, `getGrowthOpportunities`, `createCampaignFromOpportunity`, but `setup.py`'s stub class only defines 3 (`getCommandCenter`, `pauseAgent`, `resumeAgent`) — implementer must add all the rest from scratch. | `AGENT_SPEC.md:32–53` ↔ `setup.py:144–184` |
| 9 | `WORKFLOWS_SPEC.md`'s `BrandOnboardingWorkflow` has 23 steps. `setup.py`'s placeholder is 2 steps. | `WORKFLOWS_SPEC.md:28–52` ↔ `setup.py:204–222` |
| 10 | `API_CONTRACTS.md` documents `/mcp` endpoint but neither `setup.py` nor `wrangler.jsonc` show how the `MustBeViralMCP` Durable Object is mounted onto that route. `McpAgent.serve("/mcp")` or equivalent wiring is missing. | `API_CONTRACTS.md:144` ↔ all other files |
| 11 | `ARCHITECTURE.md` says "scheduled weekly task on MarketingAgent" triggers `WeeklyReportWorkflow`, but `AGENT_SPEC.md` lists no scheduling primitive in callable methods. The Cloudflare Agents SDK has `this.schedule(...)` — needs explicit call site. | `ARCHITECTURE.md:148–154` ↔ `AGENT_SPEC.md:32–53` |
| 12 | `wrangler.jsonc` configures `worker_loaders` binding `LOADER`. No spec section explains why MustBeViral needs dynamic Worker loading. This is unjustified scope. | `wrangler.jsonc:30–34` ↔ no other doc |
| 13 | `WORKFLOWS_SPEC.md`'s `DMAutomationSetupWorkflow` says "push to provider or store manual"; `ARCHITECTURE.md` says "send to Vista Social adapter where available". **Vista Social does not currently expose an automation/DM-rules API** that I can verify; spec assumes vendor capability that may not exist. | `ARCHITECTURE.md:135–144`, `WORKFLOWS_SPEC.md:139–149` |
| 14 | `PROMPT_ROADMAP.md` prompts 78–84 are duplicates ("Hardening pass 4..10"), useless without elaboration. | `PROMPT_ROADMAP.md` |
| 15 | `CLOUDFLARE_TEMPLATES_AUDIT.md` recommends `react-router-hono-fullstack-template` but `setup.py` does not scaffold from it — it writes its own minimal `vite + react` (no React Router config, no Hono routing pattern). Implementers using `setup.py` will skip the chosen template entirely. | `CLOUDFLARE_TEMPLATES_AUDIT.md` ↔ `setup.py` |
| 16 | `setup.py` writes `src/client/main.tsx` using `createRoot` directly with `<div>MustBeViral command center scaffold</div>` — no router, no provider, no Tailwind import order. Diverges from the React Router base template. | `setup.py:265–273` |
| 17 | `setup.py` lists no `tsconfig.json`, no `vite.config.ts`, no `tailwind.config.js`, no `postcss.config.js`. `npm run build` will fail immediately. | `setup.py` |
| 18 | `setup.py` writes `0001_initial.sql` with only the comment `-- Replace with DATABASE_SCHEMA.sql content from System DNA package.` Manual step, not automation. | `setup.py:283` |

## Missing Required Systems

Systems that the product needs but no spec defines fully:

1. **Auth implementation choice.** Custom email/password vs OAuth (Google/Apple) vs `openauth-template` vs magic link. `CLOUDFLARE_TEMPLATES_AUDIT.md` says "Evaluate" — undecided.
2. **Session storage.** No `sessions` table, no KV-backed session model, no JWT secret rotation strategy.
3. **CSRF** strategy for SPA + Worker.
4. **Rate-limit schema** in KV (key naming, sliding window vs token bucket).
5. **Drizzle vs raw D1.** Spec defers to implementer; will yield inconsistent code.
6. **Prompt templates.** Brand voice extraction prompts, scoring rubric prompts, content calendar generation prompts — none are written. Implementers must invent them, leading to inconsistent output.
7. **Compliance review prompts / forbidden-phrase lists.** `AGENT_SPEC.md` says "ComplianceApprovalAgent" exists; no rules defined.
8. **Per-plan limits enforcement.** `COST_MODEL.md` lists limits; no service module spec'd to check them on each generation request.
9. **Stripe webhook handler design.** No raw-body handling spec; Hono needs explicit `c.req.raw.clone().text()` for HMAC verification.
10. **`SchedulerProvider` interface.** Mentioned in `PROMPT_ROADMAP.md` but never defined in the spec set.
11. **Browser Run extraction prompts** (services/offers/voice/visuals).
12. **Image generation cost ceiling** per request / per brand / per day.
13. **Logging/observability format.** `wrangler.jsonc` enables `observability` but no structured-log conventions are defined.
14. **MCP authentication.** `/mcp` endpoint is read-only per spec but no auth or scoping per workspace/brand is specified.
15. **Pagination/cursor convention** for list endpoints (`/api/brands/:brandId/posts`).
16. **WebSocket auth** for real-time agent updates.
17. **CI/CD pipeline.** No `.github/workflows/*.yml` design.
18. **Backup / disaster recovery** for D1 and R2.
19. **Tenant isolation tests.** No spec for cross-workspace data leak detection.
20. **Cost guard middleware.** Spec mentions caps; no design for blocking generation when budget hit.

## Existing Systems Worth Preserving

From the SPEC SET (no code exists to preserve):

- **Multi-brand schema** — keep as-is, it is well thought out.
- **Workflow taxonomy** — 7 workflows match the product flow; do not collapse.
- **Approval-first publishing rule** — keep, codify in middleware.
- **Untrusted-content rule for scans** — keep, implement as a sanitizer pass.
- **Per-brand `MarketingAgent`** — architecturally correct.
- **Cost categorization in `COST_MODEL.md`** — keep, drives `usage_events` schema.
- **UI route map in `UI_WIREFRAMES.md`** — solid product-level information architecture.
- **Pricing tiers** — coherent.

## Existing Systems That Should Be Rebuilt

The only existing "system" is `setup.py`. It should be **deleted or completely rewritten** because:

- It does not scaffold from the recommended Cloudflare template (`react-router-hono-fullstack-template`).
- It hand-rolls a minimal Vite/React app that cannot build (missing configs).
- It produces a `package.json` with `"latest"` for every dependency — non-reproducible builds.
- It writes a placeholder migration that requires manual edit (not automation).
- It generates type-incorrect server code (`Env` missing `ASSETS` and other bindings).
- It does not initialize git, install deps, or seed Cloudflare resources.

**Recommendation:** Replace `setup.py` with a Bash/PowerShell bootstrap that runs `npm create cloudflare@latest --template react-router-hono-fullstack-template`, copies in the spec files as `docs/`, applies the schema migration, and provisions Cloudflare resources via `wrangler` (capturing IDs back into `wrangler.jsonc`).

## Verdict

This is greenfield. There is nothing to refactor. The "rebuild vs salvage" question is moot: **build from scratch, using the specs as design intent and the recommended Cloudflare template as the structural starting point.** Treat `setup.py` as a hint, not a tool.
