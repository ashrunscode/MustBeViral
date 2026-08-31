---
doc_id: codex-finish-mega-prompt
---

# Codex finish-sprint mega prompt

Paste this entire document into Codex as the task. It is the operator-authorized remaining-work contract. Partner qualification, EV-01 through EV-08 recruiting, and staging-enablement invitations are **not** the next action and must not stop this run.

## Operator override

The operator rejected the partner-gate stall. Finish every remaining **implementable** accepted product item: onboarding through the paid web product and every remaining integration. Human-only evidence is a short appendix. Do the product work anyway.

Do not invent features that contradict accepted authority. Do not revive legacy V1. Do not implement agency, auto-publishing, website crawling, Shopify catalog import, queues, or a second Worker until the named evidence gate and phase authorize them.

## Cold start

1. Use Node `24.18.0` and pnpm `11.12.0` (repository pins). On Windows, prefer `C:\nvm4w\nodejs\node.exe` when PATH Node is not `24.18.0`.
2. Stay on branch `codex/viralgraph-cleanroom`.
3. Run `pnpm agent:preflight` before reading implementation files or editing.
4. Read every path preflight prints, ending with `docs/delivery/ACTIVE_WORK_PACKET.yaml`. Also read this file and the successor packet YAML files under `governance/evidence/WP-P0-001/`.
5. Confirm the active packet has no pending product decision. Treat remaining human P0 evidence as appendix, not a blocker.
6. Work only on the active packet's current step and allowed paths. After `pnpm agent:finish`, the successor becomes the active packet; continue immediately.

If dependencies are missing: `corepack pnpm install --frozen-lockfile`. Never substitute npm, Yarn, Bun, Deno, or an unpinned global CLI.

## Authority

- Root `AGENTS.md` is the agent-behavior contract.
- `PROJECT_STATE.yaml` owns phase, active packet, next action, and external-mutation policy.
- `docs/MANIFEST.yaml` assigns one accepted authority per topic.
- Product, UX, architecture, and delivery documents define intended behavior.
- Migrations, Zod/OpenAPI, typed environment schemas, and the model catalog define implemented contracts.
- Research is informative only.
- If sources conflict or a required product decision is absent, record a blocker. Do not invent a local convention.

## Cleanroom constraints

- DTC/e-commerce marketing teams first. Agency workflows stay deferred.
- ViralGraph V2: Next.js/Vercel, Supabase, one Cloudflare Core Worker, private R2, fal-first provider drivers.
- Never revive React Router, D1-auth, marketing-autopilot, multi-brand social-posting, or System DNA.
- No second documentation database, `docs/archive`, progress diary, nested `AGENTS.md`, or competing status file.
- Never expose secrets, raw environment values, account tokens, customer media, or signed URLs.
- Never perform remote destructive actions, outreach, invitations, provider spend, Stripe live writes, deploys, or production mutations unless `PROJECT_STATE.yaml` and the active packet explicitly allow the exact resource IDs and rollback evidence.
- Strict TypeScript, explicit boundaries, deterministic state machines, immutable revisions, integer money, private-by-default artifacts.
- Tests with every behavioral change. Use generated contracts. Keep browser/REST/CLI/MCP transports thin.
- Supabase/Postgres remains authoritative for permissions, revisions, runs, and money.

## Baseline facts (do not treat as next action)

- Repo was clean at SHA `5dc74e0ad28ec46ce2351991aa156ceae0490720` before this finish sprint.
- WP-P0-001 steps `p0-000` through `p0-006` are complete.
- Partner qualification is pending; no invitations; no evaluator sessions. **Do not wait for them.**
- Production Web Vitals, fully-landed usable-pack cost, and operator exit remain unproven as **human/production** evidence. Implement the in-repo instrumentation and last-mile product anyway.
- Supabase public/anon signup is disabled; one exact auth callback. Implement honest closed-enrollment signup/verification UI; do not silently enable public signup in the operator dashboard.
- Spend 0 on this wake unless the packet and operator later authorize an exact run ID and cap. Do not pay GB-02 again. Do not confirm a GB-04 run without recorded spend authorization.
- Staging Vercel READY `dpl_EFVgRCdcWm3DkrVBL8usUQgidkMN`. Worker `ce5c33dc-fdb6-4259-8fc7-e3e8fc259184`.
- Verification baseline: 709 unit / 26 integration / 122 governance. Re-run current named checks after behavioral changes; do not cite this baseline as proof of new work.
- Live Reject is already not offered. Official `fal-ai/flux-2-pro` input has no `image_url`; packshot bytes cannot ride the pinned T2I route. Do not invent a packshot-conditioned master route.
- Staging migration HISTORY diverges from repository filenames; leave it untouched for the rest of P0.
- P1a charging must use the fully-landed 60% margin guardrail (at most $1.82 per pack), not the looser $5 P0 gate.

## Execution order

Complete in this order. Do not skip to partner recruiting. After each packet's implementable acceptance is proven, `pnpm agent:finish --successor <path>` and continue.

1. Remaining P0 product (onboarding and last-mile Studio) on WP-P0-001 current step `p0-007-p0-gate-evaluation`.
2. Remaining P0 measurement instrumentation, then `p0-008-p1a-successor-handoff`.
3. Entire P1a paid single-user product using `governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml`.
4. Entire P1b programmable surface and remaining integrations using `governance/evidence/WP-P0-001/successor-WP-P1B-001.yaml`.
5. Entire P2 collaboration slice using `governance/evidence/WP-P0-001/successor-WP-P2-001.yaml`.
6. Stop before P3 scale/queues and P4 agency. Those stay evidence-driven or deferred.

Named checks for every packet: `pnpm agent:verify`, `pnpm design:check`, `pnpm governance:check`, and `pnpm verify`. Add or update tests with every behavioral change. Run `pnpm docs:generate` when contracts, catalog, or authority change.

Skills: `build-mustbeviral`; then specialist skills selected by `AGENTS.md` for the current packet. P2 skills (`durable-objects`, `realtime-sync`) only after WP-P2-001 is the active packet. Do not use `queue-master` in this sprint.

Retrieve current official provider documentation before using unstable APIs, limits, prices, model IDs, or CLI behavior.

---

## Packet A — WP-P0-001 remaining implementable product

Branch stays `codex/viralgraph-cleanroom`. Allowed paths are those in the active packet. Current step starts at `p0-007-p0-gate-evaluation`.

### A1. Authentication completeness

Canvas/screen states require sign in, sign up, verification, recovery, expired link, and rate limited. Implement the missing product surfaces against Lightfield tokens.

- [ ] Signed-out last-mile story on `/` (short launch-pack value, not a marketing site or second product).
- [ ] Sign-in remains the existing email/password Studio path.
- [ ] Sign-up exists as a real screen with the required component states.
- [ ] When public/anon signup is disabled, sign-up is honest closed-enrollment (request access / enrollment closed), not a fake success and not a silent dashboard mutation.
- [ ] Email verification, expired-link, recovery, and rate-limited states are reachable and tested.
- [ ] One exact auth callback remains; do not add a second callback origin.
- [ ] No service-role key in the web app.

### A2. Onboarding (full product onboarding)

Onboarding lives inside the campaign brief, not a separate settings app. Experience contract: progressively capture product truth, brand constraints, audience, offer, and claim rules, and explain why each required field matters.

- [ ] Guided brief steps cover packshots, product facts, offer/price/urgency/destination metadata, brand kit, audience, and claims/rights.
- [ ] Each required field explains why it matters before spend.
- [ ] Brief cannot execute until required fields and asset-rights attestations pass validation.
- [ ] Generated copy may use only supplied or explicitly approved factual claims.
- [ ] Packshot attach uses the existing signed-upload operation; quarantine and missing-rights states are real.
- [ ] Packshot honesty: bytes are stored and shown; they do not ride `fal-ai/flux-2-pro` as `image_url`.
- [ ] First-use, draft, validation-error, saving, saved, and blocked-by-rights/claims states exist.

### A3. Continue-this-campaign and shipped P0 loop

- [ ] Signed-in continue-this-campaign screen (last-mile honesty, not a project dashboard).
- [ ] Campaign brief → canvas → quote → explicit confirmation → run progress → composed Review → comparison → approval → export → receipt remains the P0 job.
- [ ] Copy on ads is headline, primary text, and short description, not a spec dump.
- [ ] Export is a private ZIP through `customer_download`, with deterministic names, manifest, QA, and immutable receipt.
- [ ] Reject remains not offered unless a durable reject operation with reason category is implemented; a local note is not a recorded rejection.
- [ ] Operator/internal visibility for runs, costs, reconciliation, and kill switches exists as the P0 internal surface (not a public settings admin).

### A4. Measurement and landed-cost instrumentation

- [ ] Canvas ≥55 FPS at 100 visible nodes and 500-node navigability remain covered by tests (already proven; do not regress).
- [ ] Web Vitals instrumentation is in the web app (LCP, INP, CLS) with a documented production-segment measurement path.
- [ ] Do not promote V2 to production or cut legacy traffic to “measure” Vitals. Production-segment numbers wait for the P1a production packet with exact IDs.
- [ ] Landed-cost instrumentation computes integer USD micros from immutable provider, storage, execution, and artifact evidence for completed packs.
- [ ] Catalog `4,550,000` micros remains the customer charge, not a fal invoice. Do not pretend it is landed cost.
- [ ] Do not mint a usable-pack denominator from operator self-sessions.

### A5. Close WP-P0-001

- [ ] Every new behavior has tests. Generated OpenAPI/types/docs are current.
- [ ] `pnpm agent:verify` and packet gates pass.
- [ ] Update only mutable packet progress/evidence/blockers/handoff fields.
- [ ] `p0-008-p1a-successor-handoff`: successor YAML is `governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml`.
- [ ] `pnpm agent:finish --successor governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml` only when remaining **implementable** P0 acceptance is proven. Human appendix items are `not_applicable` for this packet finish.

---

## Packet B — WP-P1A-001 paid single-user product

Activate only by `pnpm agent:finish` from WP-P0-001. Then `pnpm agent:start` and implement.

P1a adds the secure paid web product: production-grade identity and RLS, durable revisions, Stripe subscription and prepaid wallet, enforced entitlements and spend caps, transactional email, durable multi-step execution where proven necessary, expanded exports, operational reconciliation, and production deployment/rollback.

### B1. Identity, tenancy, enrollment

- [ ] Production-grade Supabase Auth/JWT/RLS path; Core still validates JWKS; workspace remains the tenant/billing/spend-cap boundary.
- [ ] P0 one-owner membership is preserved; later roles cannot weaken RLS.
- [ ] Closed enrollment by default; allowlisted operator account; self-service signup stays disabled until an explicit later admission decision.
- [ ] Feature flags/kill switches for generation, provider routes, charging, and signups.
- [ ] Isolated production resource **design** and sanitized evidence templates exist. Do not create or mutate production resources without exact IDs, rollback evidence, and packet authorization.

### B2. Stripe, wallet, entitlements, ledger

Pilot pricing from execution-providers-billing: `$500` setup, `$149`/month, prepaid usage wallet. Usage begins at landed provider cost plus 25% with model-specific minimums. P1a charging uses the fully-landed 60% margin guardrail (at most `$1.82` per pack). Money remains integer USD micros.

- [ ] Stripe test-mode integration in-repo: typed env schema, no secrets in Git.
- [ ] `POST /webhooks/stripe` on Core: raw-body signature verification, durable dedup, then ack.
- [ ] Subscription + setup charge + prepaid wallet commands on the shared command layer.
- [ ] Entitlements gate quote/start-run. No negative wallet. Caps remain transactional.
- [ ] Ledger `credit`, `reserve`, `capture`, `release`, `refund` reconcile to Stripe settlement without duplicate money movement.
- [ ] Immutable historical receipts are never rewritten when prices change.
- [ ] Live Stripe writes, live-mode keys, and customer charges are human-only unless the packet names exact test/live IDs and the operator authorizes them.

### B3. Email, telemetry, operations

- [ ] Resend for Supabase Auth SMTP and transactional product email (receipts, recovery, enrollment). Notification preferences stay app-owned.
- [ ] Sentry/OTel for errors, traces, and measurements; they are not business-state authority. Redact secrets, cookies, signed URLs, and customer media.
- [ ] Observability: request/workspace/run/attempt/provider/outbox/ledger correlation; alerts for cross-tenant, public artifact, unbounded spend, ledger imbalance, duplicate charge/submission, signature bypass.
- [ ] Operational reconciliation commands for provider, artifact, outbox, and ledger. Blind retry after ambiguous submit remains forbidden.

### B4. Billing UI and remaining P1a screens

From canvas-screen-states, Usage and billing is P1a.

- [ ] Usage and billing: funded, low balance, blocked, receipt detail, refund/release.
- [ ] Named-price quote still shows maximum charge, reservation, expiry, and cap impact.
- [ ] Expanded exports remain private, deterministic, and receipt-backed.
- [ ] Durable workflow only for proven multi-step waits/retries; no queues; no second executor; no collaboration Worker in P1a.

### B5. Production path and Web Vitals

- [ ] Deploy/rollback runbook remains: migrations → Worker (new behavior off) → web → catalog enablement → smoke.
- [ ] Production-segment p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 is measured only on the agreed production segment after an authorized production deploy. Until then, keep instrumentation and fail-closed evidence, not a fake pass.
- [ ] Do not cut legacy production traffic or delete legacy resources. `docs/operations/LEGACY_V1_RETIREMENT.md` still authorizes inventory, not deletion.
- [ ] Finish WP-P1A-001 into `governance/evidence/WP-P0-001/successor-WP-P1B-001.yaml`.

---

## Packet C — WP-P1B-001 integrations and programmable surface

This is “all remaining integrations” that accepted architecture names beyond the P0 fal/Moonshot/R2/Supabase/Vercel/Worker slice and the P1a Stripe/Resend/Sentry slice.

### C1. Authorization

- [ ] Production OAuth and API-key authorization with scopes, revocation, and audit UX.
- [ ] P0/P1a bearer Supabase JWT remains valid for the browser app.
- [ ] MCP/CLI/API keys cannot bypass quote confirmation or spend autonomously.

### C2. Public REST

- [ ] Supported public REST `/v1` using the same command/query handlers as the browser.
- [ ] Generated OpenAPI matches handlers. Breaking changes are a new `/vN`.
- [ ] Idempotency-Key on authenticated mutations. Safe error contract. Cursor pagination.

### C3. Production MCP

- [ ] Production MCP tools beyond the private five-operation P0 proof, still thin adapters over the same handlers.
- [ ] `start_run` still requires quote ID, `confirmed: true`, and idempotency key.
- [ ] No public discovery that implies autonomous spending.

### C4. CLI

- [ ] Thin API client. JSON by default in automation; human tables when interactive.
- [ ] Explicit environment selection. OS credential store. Non-zero stable exit codes.
- [ ] Cannot read provider or database secrets. Cannot bypass paid confirmation.

### C5. User-authored Skills

- [ ] Skills with immutable published versions (`skills`, `skill_versions`).
- [ ] No agent access to database, storage, or billing credentials.

### C6. Three-client parity

- [ ] Every shipped operation has one contract vector executed against the handler and each shipped adapter (browser/REST/MCP/CLI as applicable).
- [ ] Parity covers success, validation, authorization, conflict, expiry, idempotent replay, rate limit, provider ambiguity, and safe errors.
- [ ] Finish WP-P1B-001 into `governance/evidence/WP-P0-001/successor-WP-P2-001.yaml`.

---

## Packet D — WP-P2-001 collaboration

Use `durable-objects` and `realtime-sync` only in this packet.

- [ ] Dedicated collaboration Worker and one coordination object per canvas.
- [ ] Presence, comments, text collaboration, edit leases for expensive node configuration, checkpointing.
- [ ] Postgres revisions remain durable authority. Collaboration state is a recoverable draft, never a second money/permission/revision authority.
- [ ] Tablet comments remain within the responsive contract; mobile still has no full graph authoring.
- [ ] After P2 implementable acceptance, `pnpm agent:handoff` with exactly one next action: operator decides whether a future P3 evidence gate justifies scale work. Do **not** start queues, a separately deployable executor, direct high-volume adapters, BYOK, or agency features.

---

## Integrations checklist (complete in-repo; live credentials are human)

Implement adapters, typed env, webhooks, fail-closed missing-credential behavior, and tests. Do not paste secrets. Do not call live providers or Stripe live mode unless the active packet names exact IDs.

- [ ] Vercel / Next.js web (already P0; keep staging-only mutations unless authorized).
- [ ] Supabase Auth, Postgres, RLS, migrations (already P0; extend for P1a billing/enrollment).
- [ ] Cloudflare Core Worker HTTP/MCP/webhooks/outbox (already P0; add Stripe webhook in P1a; production MCP in P1b).
- [ ] Private R2 artifacts (already P0; keep private-by-default).
- [ ] fal transport + pinned launch trio (already P0; fail-closed; no GB-02 spend).
- [ ] Moonshot/copy route currently pinned through the catalog copy driver (already P0; do not silently swap models).
- [ ] Stripe test-mode subscription, wallet, webhook (P1a).
- [ ] Resend auth SMTP + transactional email (P1a).
- [ ] Sentry/OTel telemetry (P1a).
- [ ] Production OAuth/API keys (P1b).
- [ ] Public REST, production MCP, CLI (P1b).

Not integrations in this sprint: Google Drive import, Instagram/Facebook/Pinterest/TikTok/X publishing, Shopify catalog crawl, Hyperdrive user-path enablement without G1–G6 proof, queues, Durable Objects outside P2.

---

## Explicitly out of scope (do not implement)

- Agency accounts, client portals, white-labeling, multi-client reporting, member-invite agency workflows.
- Audio workflows, arbitrary graph loops, long-form video editing, auto-publishing, connected social posting.
- Website crawling and automatic Shopify catalog import.
- Template marketplaces, public community sharing, self-hosted control planes.
- BYOK, enterprise SSO/SCIM, internationalization, regulated/political ads.
- Full mobile graph editing.
- Multiple planning agents or autonomous provider access.
- P3 queues, separate executor, circuit breakers, canaries, DR automation unless a new accepted evidence gate exists.
- Legacy V1 retirement deletions.
- Enabling Supabase public signup in the operator dashboard.
- Partner outreach, Gmail recruiting, EV-01–EV-08 invitations, evaluator scheduling.
- Paying GB-02. Confirming GB-04 without recorded spend authorization.

---

## Human-only appendix (do not stall)

Codex must not stop because these are unfinished. Implement everything above. Leave sanitized placeholders or fail-closed evidence records where a human must act.

1. Five-to-eight qualified evaluator sessions under `docs/research/EVALUATOR_RECRUITMENT.md`. Operator self-sessions do not count.
2. Unassisted-completion, usable-concept, and workflow-preference gates that require those sessions.
3. Qualified DTC customer/design-partner staging-use plus intent-to-pay or agreed-commercial-terms evidence. Actual payment and Stripe are not required for that P0 gate.
4. Operator explicit P0 go/no-go and any pivot/stop after reading the human evidence.
5. Usable-pack denominator for landed-cost ≤$5 (needs qualified usable votes).
6. Production-segment Web Vitals numbers (need authorized production traffic; implement instrumentation now).
7. Provisioning live Stripe, Resend, Sentry, production Supabase/Worker/R2/Vercel credentials, and dashboard signup policy.
8. Any deploy, DNS cutover, invitation, or spend that needs exact resource IDs and operator authorization.
9. Staging migration HISTORY reconciliation (forbidden for the rest of P0).

When a human-only item blocks a live mutation, implement the in-repo path, record the missing operator input without secrets, and continue the next implementable item.

---

## Verification, handoff, finish

1. `pnpm agent:preflight` at the start of each packet.
2. Tests with every behavioral change.
3. `pnpm docs:generate` when generated outputs drift.
4. `pnpm agent:verify` and the packet's named gates (`pnpm design:check`, `pnpm governance:check`, `pnpm verify`).
5. `pnpm agent:handoff --next-action "..."` if the current packet still has implementable work.
6. `pnpm agent:finish --successor <yaml>` only when that packet's implementable acceptance is proven and the successor YAML is ready with status `ready`, all steps `pending`, and no blockers.
7. Do not commit unless the operator asks.
8. Never report partner EV recording as the next action.

Exactly one next action at every handoff: the next implementable checkbox in this file for the active packet.
