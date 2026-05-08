# 03_PRODUCT_LOGIC_AUDIT.md

Status legend (no implementation exists; status reflects spec coverage):
- `Spec only` — described in docs, no code, no skeleton.
- `Stub in setup.py` — placeholder generator emits a code stub but no real logic.
- `Schema only` — D1 table exists in `DATABASE_SCHEMA.sql` but no service / route / UI.
- `Missing` — not in any spec.

| Feature | Status | Files (spec) | Problems | Fix Strategy | Priority |
|---|---|---|---|---|---|
| User account | Schema only | `DATABASE_SCHEMA.sql:7` | No password hash column, no OAuth provider table, no sessions table; auth scheme undefined | Pick auth strategy (custom Argon2id + sessions in D1, or `openauth-template`); add `password_hash`, `sessions`, optionally `oauth_accounts` | P0 |
| Workspace | Schema only | `DATABASE_SCHEMA.sql:18`, `API_CONTRACTS.md:38` | `role` not enumerated; no invitation/membership flow spec'd | Enum role: `owner|admin|member`; add invites table later | P0 |
| Workspace_members | Schema only | `DATABASE_SCHEMA.sql:28` | No service/route/UI; member CRUD undefined | Implement RBAC middleware checking workspace_members on every brand route | P0 |
| Brand CRUD | Schema only | `DATABASE_SCHEMA.sql:37`, `API_CONTRACTS.md:44` | Soft-delete column exists (`deleted_at`) but query patterns and admin restore undefined | Always filter `WHERE deleted_at IS NULL` in service layer | P0 |
| Brand switcher | Spec only | `UI_WIREFRAMES.md:5` | Component listed but not designed; no API for "list brands in workspace" defined | Add `GET /api/workspaces/:id/brands`, build switcher UI | P0 |
| One MarketingAgent per brand | Stub in setup.py | `AGENT_SPEC.md`, `setup.py:144` | Stub has 3 of ~20 methods; no DO routing; no ID-to-brand mapping rule (must use `idFromName(brandId)`) | Implement all 20 callable methods; document DO ID convention | P0 |
| Agentic onboarding flow | Stub in setup.py | `WORKFLOWS_SPEC.md:14`, `setup.py:204` | 23 spec'd steps, only 2 stubbed; no scan prompt templates | Implement BrandOnboardingWorkflow steps 1–23, mock external services for local dev | P0 |
| Website scan (Browser Run) | Spec only | `RESEARCHED_PLATFORM_NOTES.md:36`, `WORKFLOWS_SPEC.md:31–35` | No SSRF guard spec'd; no extraction schemas | Implement SSRF guard (block private/loopback/metadata IPs); add Zod schemas for extracted data | P0 |
| Social scan | Spec only | `WORKFLOWS_SPEC.md:38` | Public-content-only; no platform-specific HTML structure docs; high breakage risk on layout changes | Use Browser Run + structured extraction; cache findings; gracefully skip on block | P1 |
| Competitor scan | Spec only | `WORKFLOWS_SPEC.md:39` | Same as social scan | Same | P1 |
| Brand intelligence report | Spec only | `UI_WIREFRAMES.md:69`, `API_CONTRACTS.md:64` | No prompt template, no scoring rubric definitions | Define rubric in `services/brand-intelligence.ts`; store prompts under `src/server/prompts/` | P0 |
| Marketing scores (8 dimensions) | Schema only | `DATABASE_SCHEMA.sql:133` | Eight score columns exist but `evidence_json` shape undefined; no rubric in spec | Define `MarketingScore` Zod schema; require evidence per score | P1 |
| Editable brand profile + versions + locks | Schema only | `DATABASE_SCHEMA.sql:70`, `UI_WIREFRAMES.md:103` | Mechanism for "lock a field so AI can't overwrite" not designed | Implement `locked_fields_json` array + check in agent before regen | P1 |
| Target market research | Schema only | `DATABASE_SCHEMA.sql:149` | Report shape undefined; just `report_json TEXT` | Define `TargetMarketReport` Zod schema with audience/pain/triggers | P1 |
| Cross-sell engine | Spec only | `PRODUCT_DNA.md:80`, `UI_WIREFRAMES.md:125` (CrossSellOpportunityCards) | No table; presumably reuses `growth_opportunities` with `type='cross_sell'` | Use `growth_opportunities.type` enum: `cross_sell`, `upsell`, `content_gap`, `competitor_gap` | P2 |
| 30-day content calendar | Stub in setup.py | `WORKFLOWS_SPEC.md:64`, `setup.py:223` | Just a placeholder step; no actual generation logic | Implement generation: target_market + brand_profile + pillars → 30 posts × platforms | P0 |
| Platform-specific posts (variants) | Schema only | `DATABASE_SCHEMA.sql:204` | `post_variants` exists; generation logic missing | Generate per-platform copy in `CaptionHookAgent` | P1 |
| Image generation | Stub in setup.py | `WORKFLOWS_SPEC.md:80`, `setup.py:230` | Just a placeholder; FLUX model identifiers unverified | Verify Workers AI catalog at impl time; fallback to FLUX.1 if FLUX.2 absent | P0 |
| Approval queue | Schema only | `DATABASE_SCHEMA.sql:230`, `UI_WIREFRAMES.md:144` | `approvals` table records actions but state machine on `content_posts.status` undefined (`draft|pending|approved|rejected|scheduled|published|failed`) | Define state machine; central `transitionPostStatus()` service | P0 |
| Scheduler adapter (Manual / Vista Social / Buffer) | Spec only | `ARCHITECTURE.md:117`, `WORKFLOWS_SPEC.md:99` | `SchedulerProvider` interface not defined; Vista Social DM API existence unverified | Define `SchedulerProvider` TS interface; ManualExportAdapter MUST work first | P0 |
| DM automation rules | Schema only | `DATABASE_SCHEMA.sql:257`, `UI_WIREFRAMES.md:181` | Spec relies on Vista Social; no fallback; spec says "no browser-bot DMs" (good) | Implement rules CRUD; do NOT enable provider sending until Vista Social capability is confirmed | P2 |
| Analytics snapshots | Schema only | `DATABASE_SCHEMA.sql:284` | No ingestion route; provider-specific format unspecified | Define generic `AnalyticsSnapshot` with provider-specific shapes inside `metrics_json` | P2 |
| Weekly report | Stub in setup.py | `WORKFLOWS_SPEC.md:114`, `setup.py:244` | Just a placeholder; no PDF generation library chosen for Workers runtime | Use a Workers-compatible PDF lib (e.g., `pdf-lib`); store PDF in R2 | P1 |
| Improve-next-week loop | Spec only | `PRODUCT_DNA.md:88` | Behavior described, storage location ("agent memory") undefined | Use `MarketingAgent` SQL state for "last week observations" | P2 |
| Stripe billing | Spec only | `PRODUCT_DNA.md:134`, `DEPLOYMENT_RUNBOOK.md:28` | Webhook handler design absent; tier-to-Stripe-price-id mapping undefined | Implement Stripe checkout + portal + webhook with raw-body verification | P0 |
| Admin dashboard | Schema only | `UI_WIREFRAMES.md:223`, `API_CONTRACTS.md:141` | No admin route guard middleware; no failed-job retry endpoint | Add `requireAdmin()` middleware; expose `/api/admin/workflows/:id/retry` | P1 |
| Usage/cost tracking | Schema only | `DATABASE_SCHEMA.sql:348`, `COST_MODEL.md` | Insertion locations not defined (must wrap every `env.AI.run` and external HTTP call) | Centralize via `recordUsage()` helper, called inside model adapter | P0 |
| Audit logs | Schema only | `DATABASE_SCHEMA.sql:375` | No middleware spec'd to write audit entries | Wrap mutating routes with `auditLog()` middleware | P1 |
| Influencer marketplace | Schema only (creator_profiles, marketplace_matches) | `DATABASE_SCHEMA.sql:388,401` | Phase 3 per `PRODUCT_DNA.md`; should not be exposed in MVP UI | Keep tables but hide UI; remove if cruft becomes a problem | P3 |
| MCP read-only server | Stub in setup.py | `setup.py:186` | 2 placeholder tools; no real D1 reads; no `/mcp` mounting | Implement read tools (`list_brands`, `get_post`, etc.); mount via DO routing | P2 |
| Real-time agent updates | Spec only | `ARCHITECTURE.md:88`, `AGENT_SPEC.md` | WebSocket auth, reconnection, and message schema undefined | Use `Agent.broadcast()`; client subscribes to per-brand channel | P1 |
| Magic moments page (intelligence report) | Spec only | `UI_WIREFRAMES.md:69` | Critical for activation; spec'd but no concrete data shape | Build first after onboarding workflow returns mock data | P0 |

## Summary by Priority

| Priority | Count |
|---|---|
| P0 (blocks MVP) | 17 |
| P1 (required for sellable Phase 1) | 9 |
| P2 (important, can wait) | 5 |
| P3 (Phase 2/3) | 1 |

## Hardest Items

These will be the highest-risk items to implement and should be tackled with extra design care:

1. **Browser Run + extraction reliability.** Social platforms aggressively block automated rendering. The spec says "continue if Browser Run blocked using fetch fallback" — fine, but the *quality* of fallback parsing for sites like Instagram (which serves no meaningful HTML to unauthenticated browsers) will be near zero. **Set realistic expectations: social scanning may yield very thin signal.**
2. **FLUX.2 Klein availability.** If the named identifiers do not exist on Workers AI at deployment time, the entire image-generation path fails. **Recommend: probe Workers AI list-models endpoint at startup; fail loud if model unavailable; fallback to FLUX.1 schnell.**
3. **Vista Social adapter scope.** Vista Social's public API reasonably handles scheduled posts; DM automation as described in the spec is questionable. **Recommend: ship Manual Export first, Vista Social posting second, defer Vista Social DM rules until vendor capability is confirmed.**
4. **Approval state machine.** Concurrent approve/reject + scheduling races require careful transactionality on D1.
5. **Per-brand cost ceilings.** Need an atomic check-and-increment in `usage_events` (D1 doesn't have native atomic counters; use a serialized DO if precision matters, or accept eventual consistency in KV).
