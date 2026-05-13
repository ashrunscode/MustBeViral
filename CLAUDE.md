# CLAUDE.md

> MustBeViral — Cloudflare-native multi-brand AI marketing autopilot. Live at `https://mustbeviral.com`.
> Read this file fully on session start. On conflict with `~/.claude/CLAUDE.md`, this file wins.

## 🚦 Quickstart (read first, ≤ 60 seconds)

1. Latest run: **Run 21** (Option D — all 4 platform adapters dark-deployed), `shipped: true`. Public-launch verdict: ⚠️ pending only M-16 observability + at least one platform flag-flipped.
2. Production worker `2f0e51da-7134-422f-949a-06c55d9b0a11`. All 8 platform `ENABLE_<X>_<Y>` flags = `"false"` — customer-visible behaviour identical to Run 20.
3. Per-platform launches are single-flag flips. Procedure in `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md`.
4. For any complex change → read `codex-audit/FIX_LOG.md` Post-Run-21 Override footer + `codex-audit/NEXT_EXECUTION_PLAN.md`.
5. Validation gate: `npm run typecheck && npm run lint && npm run test && npm run build`. All exit 0 on `master`.

## 📊 Operational state (post-Run-21, 2026-05-13)

| Surface | Value |
|---|---|
| Production worker | `mustbeviral-production` v `2f0e51da-7134-422f-949a-06c55d9b0a11` |
| Staging worker | `mustbeviral-staging` v `f775e2d5-6548-461c-bb8c-4e21c8000366` |
| D1 prod / staging | `b9a428e0-…` / `04b2303a-…` — **41 tables / 44 indexes** (post-0003) |
| KV prod / staging | `ff374abd…` / `158d36f8…` |
| R2 prod / staging | `mustbeviral-production-media` / `mustbeviral-staging-media` (ENAM) |
| Migrations applied | `0001_initial.sql` + `0002_indexes_and_phase2.sql` + **`0003_platform_integration.sql`** on both envs |
| Stripe | Test mode (`sk_test_*` on `acct_1SRvMXFMXFyeuIPx`). 4 products + 4 prices + 1 webhook. 6 secrets per env |
| Platform flags (prod) | **All 8 `ENABLE_<X>_<Y>` = `"false"`** (LinkedIn/X/Meta/TikTok × publish/ingest) |
| Admin user (prod) | `admin+ops@mustbeviral.com` (role=admin) |
| Cloudflare account | `d2897bdebfa128919bd89b265e6a712e` |
| GitHub master HEAD | Phase F commit (post-Run-21) |
| Local tests | 25 files / 178 unit + integration + 6/6 Playwright. Worker bundle 757.40 KB |

If `wrangler whoami` / `git log` / `stripe products list` disagrees → **stop and reconcile before any new work**.

## ⛔ Hard rules (non-negotiable; numbered for chat reference)

1. **Approval-before-publish.** No path may publish/schedule/export without `content_posts.status = 'approved'`. Same for replies via `dm_events.status`.
2. **Manual export is default.** Direct platform publishing only via Option D adapters behind feature flags (currently all flags `"false"`).
3. **No unsafe DM/comment automation.** `outboundExecution: "none"` + `browserBot: false` unless platform flag ON + human approval on the inbound event.
4. **SSRF-safe scanning.** `services/security/ssrf.ts::normalizeScanUrl` blocks private IPs, IPv4-mapped IPv6, localhost. Manual redirects ≤ 4 hops, each re-validated.
5. **Raw-body Stripe webhook verification.** HMAC-SHA-256, 300s tolerance, timing-safe compare. Replay-aware via `webhooks_inbox` `INSERT OR IGNORE`.
6. **Admin + MCP routes RBAC-protected.** `requireAdmin()` on all admin/MCP routes. 403 verified per env.
7. **No live Stripe activation** without explicit `"activate Stripe live"` instruction.
8. **Feature flags default `"false"` in production.** Production flag flips are launch decisions, not build decisions.
9. **Token encryption at rest.** Platform OAuth tokens in KV ciphertext (AES-GCM with `TOKEN_ENCRYPTION_KEY`-derived key). D1 metadata only. Never echo tokens.
10. **No `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` writes.** `KIMI_API_KEY` optional, mock-safe fallback otherwise.
11. **Two-tsconfig structure preserved.** Cross-project imports use structural typing (`DispatchDb`, `EntitlementsDb`). Never add `worker-configuration.d.ts` to `tsconfig.node.json` — cascades the entire server tree.
12. **Commits require explicit user instruction** (per global CLAUDE.md). Push requires `git push` instruction.
13. **No destructive ops** without explicit per-resource auth: `d1_database_delete`, `kv_namespace_delete`, `r2_bucket_delete`, `wrangler secret delete`, `git push --force/--no-verify/--amend`.

## 🛠 Commands

### Validation gate (run after every meaningful change)

```bash
npm run typecheck   # wrangler types + react-router typegen + tsc -b
npm run lint        # eslint
npm run test        # vitest run (unit + HTTP integration)
npm run build       # react-router build → build/client + build/server
npm audit --audit-level=high
npm run test:e2e:list
npm run test:e2e    # Playwright, managed dev-server on :5173
git diff --check
```

### Deploy (when authorised)

`wrangler deploy --env <name>` is a **no-op** because the Cloudflare Vite plugin flattens `build/server/wrangler.json` without env blocks. Always patch first:

```bash
npm run build
node scripts/patch-deploy-config.mjs <staging|production>
node ./node_modules/wrangler/bin/wrangler.js deploy        # no --env flag
```

Post-deploy: `bash scripts/smoke.sh <env>` (21 numbered steps incl. Stripe tamper/replay + image-gen).

### Cloudflare ops (read-only via API MCP)

API MCP works independently of CLI auth. Use `mcp__cf__d1_database_query`, `mcp__cf__kv_namespace_get`, `mcp__cf__r2_bucket_get` etc. For resource creation, prefer the API MCP over `wrangler` because of explicit-per-resource authorisation.

### Local dev servers

`.claude/launch.json` has two configs. Start via `preview_start`:

| Name | Port | Purpose |
|---|---|---|
| `react-router dev (Vite + Cloudflare Worker)` | 5173 | Hot-reload dev |
| `vite preview (built production bundle)` | 4173 | Build + preview |

## 📁 File map

| Path | Purpose |
|---|---|
| `src/server/index.ts` | Worker entry + Hono app + middleware order |
| `src/server/routes/{auth,workspaces,brands,billing,webhooks,admin,mcp,health}.ts` | API routes (route-helper pattern) |
| `src/server/middleware/{auth,rbac,csrf,security-headers,rate-limit,error,request-logging}.ts` | Pre-route middleware |
| `src/server/services/auth/{password,session}.ts` | PBKDF2-SHA512 (100k cap), 30-day sessions |
| `src/server/services/security/{ssrf,prompt-injection}.ts` | Security primitives |
| `src/server/services/stripe/{signature,events}.ts` | Stripe webhook verify + event dispatcher |
| `src/server/services/scheduler/index.ts` | `ManualExportAdapter` + skeleton Vista/Buffer (superseded by Option D) |
| `src/server/services/model-router*.ts` | Workers AI + AI Gateway routing, image gen |
| `src/server/services/entitlements.ts` | Plan caps (starter/growth/agency/managed) |
| `src/server/services/brand-operations.ts` | Mock generators + helpers |
| `src/server/agents/MarketingAgent.ts` | Durable Object (5 lifecycle endpoints) |
| `src/server/workflows/*.ts` | 7 real `step.do` orchestrations |
| `src/server/db/migrations/*.sql` | Authoritative schema (38 tables / 39 indexes) |
| `src/server/db/{schema,client,sql,seed}.ts` | DB helpers |
| `app/routes/*.tsx` | React Router 7 routes |
| `tests/unit/*.test.ts` | Vitest unit tests |
| `tests/integration/api-flow.test.ts` | HTTP integration suite (Miniflare) |
| `tests/e2e/command-center.spec.ts` | Playwright e2e |
| `scripts/patch-deploy-config.mjs` | **Required before every wrangler deploy** |
| `scripts/smoke.sh` | Post-deploy 21-step smoke driver |
| `scripts/cloudflare-readiness.ts` | Read-only CF resource inventory |
| `wrangler.jsonc` | Worker config + bindings + env blocks |
| `worker-configuration.d.ts` | Auto-generated by `wrangler types`. Don't edit |

## 📚 Truth files (read priority order)

1. `codex-audit/FIX_LOG.md` — **THE source.** Always read the latest "Authoritative Post-Run-N Override" footer first.
2. `codex-audit/NEXT_EXECUTION_PLAN.md` — "Exact Next Command" + remaining task list.
3. `codex-audit/D_REAL_PLATFORM_INTEGRATION_ROADMAP.md` — Option D Phase-2 charter (dark deploy). Section 14 has the paste-ready Codex prompt.
4. `codex-audit/KNOWN_FAILURES.md` — documented environment quirks.
5. `codex-audit/19_RELEASE_GO_NO_GO.md` — verdicts.
6. `codex-audit/17_GAP_REGISTER.md` — gap table.
7. `codex-audit/DEEP_AUDIT_RUN.md` — latest baseline.
8. `final-strategy/{BUILD_LOG,DECISIONS_LOG}.md` — milestone history + ADRs.
9. `docs/system-dna/{DEPLOYMENT_RUNBOOK,SECURITY_CHECKLIST,TEST_PLAN}.md` — runbooks.

`codex-audit/_archive/` = superseded baselines. Read-only, never edit.

## 🔧 Common tasks — exact patterns

### Add a new API route

1. Add handler in `src/server/routes/<file>.ts` using the route-helper pattern.
2. Mount under `/api/<prefix>/*` in `src/server/index.ts`.
3. Add Zod schema for body validation via `parseJsonBody(c, schema)`.
4. Use `successEnvelope(data, requestId)` / `errorEnvelope(code, msg, requestId)` for responses.
5. Add `requireAuth()` / `requireWorkspaceMember()` / `requireBrandAccess()` / `requireAdmin()` as appropriate.
6. Add audit log via `writeAuditLog(db, {...})` for mutating routes.
7. Add HTTP integration test in `tests/integration/api-flow.test.ts`.

### Add a new D1 migration

1. Create `src/server/db/migrations/000N_<name>.sql`.
2. All statements: `CREATE TABLE/INDEX IF NOT EXISTS …` (idempotent).
3. Apply locally: `wrangler d1 migrations apply mustbeviral --local`.
4. Apply staging via API MCP: `mcp__cf__d1_database_query` against `04b2303a-…`.
5. **Production migration only via explicit user instruction.**
6. Update `tests/unit/schema.test.ts` if new tables added.

### Add a new unit test

1. Create `tests/unit/<feature>.test.ts` using vitest.
2. Mock D1 with structural `DispatchDb`-style stubs (see `tests/unit/stripe-events.test.ts` for the pattern).
3. Cross-project file must be included in `tsconfig.node.json` `include[]`.
4. Run: `npm run test -- tests/unit/<feature>.test.ts`.

### Deploy

See "Commands → Deploy" above. **Never skip `patch-deploy-config.mjs`.**

### Touch a workflow

1. Edit `src/server/workflows/<Name>Workflow.ts`.
2. Every `step.do` callback must return JSON-narrow types — `Record<string, unknown>` is rejected by TS.
3. Use `{ retries: { limit, delay, backoff: "exponential" } }` for transient-error steps.
4. Route invocation: `await env.<WORKFLOW>.create({ params: buildBrandWorkflowParams({...}) })` for fire-and-forget; result is `{id: workflowInstanceId}`.

### Wire a new feature flag

1. Add to `wrangler.jsonc` under **both** `env.staging.vars` AND `env.production.vars`, default `"false"`.
2. `wrangler types` to regen `worker-configuration.d.ts`.
3. Gate the code path with `isPlatformEnabled(env, "<platform>", "<capability>")` (or equivalent helper).
4. Add fail-closed integration test for the OFF path.

## 🤝 Decision authority

| Action | Claude decides | Needs `AskUserQuestion` |
|---|---|---|
| Edit a source file behind a green-gate change | ✅ | |
| Add a new test | ✅ | |
| Edit audit/build docs | ✅ | |
| Run `npm run *` commands | ✅ | |
| Read-only Cloudflare API MCP calls | ✅ | |
| Write to `.claude/launch.json` | ✅ | |
| `git commit` | | ✅ "commit" instruction |
| `git push` | | ✅ "push" instruction |
| `wrangler deploy` | | ✅ "deploy <env>" instruction |
| `wrangler secret put` | | ✅ secret value from user |
| Create Cloudflare resource (D1/KV/R2) | | ✅ per-resource auth |
| Flip a production feature flag | | ✅ "launch <platform>" |
| Activate Stripe live | | ✅ "activate Stripe live" + live keys |
| Delete any resource | | ✅ per-resource auth |

When in doubt → `AskUserQuestion` rather than guess.

## 🐛 Gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `spawn npm ENOENT` from `preview_start` | Windows + nvm — spawner doesn't inherit PATH | Use absolute `node.exe` path + direct CLI script in `.claude/launch.json` |
| `wrangler deploy --env staging` silently no-ops | Vite plugin flattens `build/server/wrangler.json` without env blocks | Run `node scripts/patch-deploy-config.mjs <env>` first; deploy without `--env` |
| `Wrangler requires Node.js v22.0.0` warning, exit 0 | Default shell Node 20 < Wrangler floor | Run the type chain via bundled Codex Node 24 (see Quickstart) |
| `future.unstable_viteEnvironmentApi` throws | RR 7.15 stabilised the flag | Already `v8_viteEnvironmentApi` in `react-router.config.ts`; don't revert |
| `D1Database` type not found in tsconfig.node | Adding `worker-configuration.d.ts` cascades server tree | Use structural typing (`DispatchDb`, `EntitlementsDb` patterns) |
| Synthetic `stripe trigger` leaves `cus_*`/`sub_*` NULL | Trigger doesn't include real customer/subscription objects | Expected; real-card Checkout via browser populates them |
| Cloudflare API MCP works but `wrangler whoami` says not logged in | Independent auth surfaces | API MCP fine for resource ops; CLI needed only for `deploy`/`secret put`/`tail` |
| `npm audit --audit-level=high` reports 0 but a CVE seems present | High floor; medium/low CVEs are tracked separately | Use `npm audit` (no flag) to see all; don't bump deps without lockfile review |

## 🔭 Currently open work (priority order)

1. **Pick a launch platform** — LinkedIn is the natural first launch (B2B, fastest Marketing API approval). Procedure in `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md`. Each launch = configure platform creds via `wrangler secret put` + flip 2 flags + register webhook (LinkedIn/Meta/TikTok only — X polls via cron) + real-account smoke.
2. **M-16 observability** — Sentry or Workers Observability dashboards; required for ✅ public marketing launch.
3. Optional: real-card Stripe Checkout (populate `stripe_customer_id`/`stripe_subscription_id`).
4. Optional: `staging.mustbeviral.com` DNS.
5. Live Stripe activation — separate run with `sk_live_*` auth.

## 🚫 Explicitly out of scope (don't start without instruction)

- Threads platform integration (API alpha).
- Live Stripe activation.
- OpenAI / Anthropic API key writes.
- Vista Social / Buffer adapter cleanup.
- Customer-facing launch of any Option D platform.
- SOC 2 / GDPR / DPA documentation.
- Performance hardening (Phase 2+).

## 🧠 Team structure

Inherits 4-agent + lead pattern from `~/.claude/CLAUDE.md`: Architect (Plan), Implementer (general-purpose), Tester (test-generator), Reviewer (code-reviewer), Security Scanner, Verifier. Spawn for multi-file changes; work directly for doc edits + small targeted fixes.

---

**Updated post-Run-21, 2026-05-13.** Refresh the operational-state table within one run of any production deploy or migration.
