# 19 — Release Go / No-Go

> ## ⚠️ STATUS RECONCILIATION (post-Run-7, 2026-05-08)
>
> The original (baseline-audit) verdicts below are stale. Runs 1-7 closed C-1, C-4, H-7, H-11 and others. The reconciled verdicts in **this header** are the source of truth.
>
> ### Reconciled verdicts
>
> | Audience | Reconciled verdict | Reason |
> |---|---|---|
> | **Local development** | ✅ **GO** | All gates green (typecheck/lint/test/build); 7 files / 24 tests; 0 high-CVE |
> | **Staging** | ❌ **STILL NO-GO** | Staging D1/KV bindings still placeholder. Run Prompt 32 to provision |
> | **Production (no new code)** | ✅ **GO (safe & secured)** | C-1 patched, security headers live, plan caps enforced, Stripe webhook processes events. UI still static — but nothing user-facing breaks |
> | **Live Stripe (paid plans)** | ⚠️ **CONDITIONAL GO** | Both prerequisites met: (a) webhook event handlers (C-4 closed in Run 4) and (b) plan-cap enforcement (H-11 closed in Run 6). **Required before flipping live keys:** integration tests on the 402 plan-cap path AND the Stripe replay path (Prompts 5, 6, 27, 28). Without those, a regression could pass payments without delivering features |
> | **Closed beta (≤10 hand-held users via API)** | ⚠️ **CONDITIONAL GO** | API surface is sellable for an operator who calls `/api/*` directly. **NO-GO via browser** until UI rebuild (C-5 / Sprint D) ships at least: auth, workspaces, brands, command center, calendar, approvals, manual export |
> | **Paying customers (self-serve, browser-only)** | ❌ **STILL NO-GO** | UI rebuild blocking. AI external providers (Kimi/Anthropic/OpenAI) still mock-only — only `@cf/...` Workers AI text models are real. Real image generation (H-2) still missing |
> | **Public marketing launch** | ❌ **STILL NO-GO** | All of the above + observability (M-16) + runbooks |
>
> ### Required next gates (in order)
>
> 1. **Sprint C** — HTTP integration tests (Prompts 5, 6, 27, 28, 13, 29). Locks the 402 cap path, multi-brand isolation, Stripe replay.
> 2. **Sprint A** — Real image gen (Prompt 18) + AI Gateway routing for external providers (Prompt 20).
> 3. **Sprint B** — Wire `WORKFLOW.create({...})` from routes (Prompt 16); finish remaining 3 workflow stubs (image / approval-scheduling / dm-automation).
> 4. **Sprint F** — Provision staging (Prompt 32). Apply 0002 migration to staging. Run smoke.
> 5. **Sprint D** — UI rebuild (multi-week, Prompts 34+).
> 6. **Sprint G** — Stripe live activation (after Sprint C tests pass).
> 7. **Sprint E** — Observability + runbooks.
> 8. **Sprint H** — Final go/no-go and `SHIP_LOG.md`.
>
> ### Stripe live activation specifically
>
> Per the 2026-05-08 DECISIONS_LOG entry "Stripe Live Activation Gate": both technical prerequisites are now met. Remaining gates (operational, not code):
>
> - [ ] Run integration test suite for plan-cap and Stripe replay paths and pin the test count.
> - [ ] Configure `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` via `wrangler secret put --env production` (requires explicit user confirmation).
> - [ ] Register webhook endpoint `https://mustbeviral.com/api/webhooks/stripe` in Stripe Dashboard for events: `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`. Match the signing secret to `STRIPE_WEBHOOK_SECRET`.
> - [ ] Stripe test-mode end-to-end purchase from a test workspace; verify subscription row advances and entitlement enforcement reacts.
> - [ ] Then flip to live mode.
>
> Until those four operational gates are checked, **do not flip live secrets autonomously.**

---

## Original baseline verdicts (archived 2026-05-08)

| Audience | Verdict | Justification |
|---|---|---|
| **Local development** | ✅ **GO** | `npm install && npm run dev` works; tests/build pass; tooling solid |
| **Staging** | 🚧 **NO-GO** | Staging D1/KV bindings are placeholders (`00000000-…`). Wrangler deploys to staging would fail. (Gap M-17) |
| **Production** (current state, no further changes) | ⚠️ **CONDITIONAL GO** | Already deployed and serves the static cockpit + secured `/api/*`. Safe in the sense that nothing harmful happens, but: (1) `hono`/`react-router` CVEs remain unpatched (C-1); (2) UI is unusable; (3) AI features return canned strings; (4) no CI/CD; (5) no Git remote |
| **Live Stripe (paid plans)** | ❌ **NO-GO** | Webhook does not process events (C-4). Subscriptions never advance. Configuring `STRIPE_SECRET_KEY` today would book payments without delivering value |
| **Closed beta (≤10 users)** | ❌ **NO-GO** | Without UI, beta users cannot complete any MVP action. Without real AI, the product has no value-add |
| **Paying customers** | ❌ **NO-GO** | All AI features mocked (C-3, H-2, AI-1..AI-10). Customers would receive identical canned content for every brand |
| **Public marketing launch** | ❌ **NO-GO** | All blockers above plus discoverable static cockpit reveals the product is not real |

## Conditions to upgrade each verdict

### Staging → GO

* Provision staging D1/KV/R2 (M-17)
* Patch wrangler.jsonc env.staging with real IDs

### Production (continued use) → GO

* Sprint 0 complete (C-1 patched, security headers, GitHub remote, CI gating)

### Live Stripe → GO

* Sprint 4.1-4.4 complete (webhook event handlers, plan enforcement)
* Stripe production keys configured AFTER above

### Closed beta → GO

* Sprint 0 + Sprint 1 + Sprint 6.3 (UI build for at least: auth, workspaces, brands, onboarding, calendar, approvals, manual export)
* At least one real AI provider wired (Sprint 3.5 or 3.6)

### Paying customers → GO

* Sprint 0 → Sprint 5 complete (production safe, agents real, AI real, billing real, tests sufficient)
* Real onboarding produces brand-specific output
* Plan enforcement live
* SLAs documented (uptime, support response)

### Public marketing launch → GO

* All above plus
* Full UI polish (Sprint 6.3 complete)
* Observability (Sprint 6.2)
* Documentation public
* Marketing site separate from product

## Recommendation

**Hold the existing production deployment** as a placeholder (acceptable safety; visible cockpit is a "coming soon" page). **Do not configure Stripe or solicit users until at least Sprint 0 + Sprint 1 are complete.** **Do not announce paid plans until Sprint 0 → Sprint 4 are complete.**

Sprint 0 is the immediate priority — without dependency patches, the running Worker carries known security CVEs.
