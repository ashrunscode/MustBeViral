# 19 — Release Go / No-Go (current, post-Run-19)

> Source of truth as of 2026-05-10 after Runs 1-19. The original baseline verdicts are archived at `codex-audit/_archive/19_RELEASE_GO_NO_GO_baseline_2026-05-08.md`. The post-Run-18 verdicts are preserved at the bottom of this file for diffing.

## Verdicts

| Audience | Verdict | Reason |
|---|---|---|
| **Local development** | ✅ **GO** | All gates green: typecheck, lint, test (12 files / 46 unit tests), build, npm audit (0 vulns), e2e (6/6 desktop Chromium + mobile WebKit), diff hygiene |
| **Staging** | ✅ **GO** | Run 19 — `mustbeviral-staging` deployed at version `88c739f1-3dfc-4f91-8984-229e5b623b1c` with all 13 secrets written, `USE_MOCK_AI=false`, full smoke 21/21 PASS including real Workers AI Flux PNG (309 KB) written to staging R2 and signed-payload Stripe tamper + replay. Reachable via `curl --resolve` against a Cloudflare anycast IP; DNS for `staging.mustbeviral.com` not yet provisioned (non-blocking) |
| **Production (Run-1-17 hardened code)** | ✅ **GO** | Run 19 — `mustbeviral-production` redeployed at version `15ce175b-4870-4005-9c83-f042f5831177`, replacing the historic Milestone 8 worker `2f4ead0c-...`. Migration `0002_indexes_and_phase2.sql` applied. Smoke 21/21 PASS: signup → login → /me → workspaces → brands → calendar generate → manual-export-unapproved (409 `POST_NOT_APPROVED`) → starter-plan-cap (402 `PLAN_LIMIT_REACHED`) → admin/MCP RBAC denial (403) → image-gen (real `provider: "workers_ai"`) → Stripe tamper (400 `INVALID_STRIPE_SIGNATURE`) → Stripe replay (`replay: true`). Security headers (HSTS, CSP, X-Frame-Options) verified live |
| **Live Stripe (test mode)** | ✅ **GO** | 4 products + 4 monthly prices ($49 / $199 / $499 / $1999) on test account `acct_1SRvMXFMXFyeuIPx`, webhook endpoint `we_1TVPeeFMXFyeuIPxFnV66SGe` pointed at `https://mustbeviral.com/api/webhooks/stripe`, all 6 Stripe secrets written to staging + production via `wrangler secret put`. Signed-payload tamper + replay confirmed against the live worker. **No live-mode resources created.** |
| **Closed beta (≤10 hand-held users)** | ✅ **GO** | UI is real-data for the MVP page set (auth, workspaces, brand operations, approvals, media, billing, DM rules, reports, growth, admin) and proven on desktop + mobile WebKit. Real image gen (H-2) confirmed end-to-end in production with Workers AI Flux + R2 upload + media proxy. Beta can run today |
| **Paying customers (self-serve, test-mode Stripe)** | ⚠️ **CONDITIONAL GO** | All technical prerequisites met. Operational gate: a real test-mode Stripe Checkout end-to-end (start a Checkout session as a test user, complete with `4242 4242 4242 4242`, verify the subscription row advances) has not yet been performed in this run. Recommended before opening test-mode billing to additional users |
| **Public marketing launch** | ❌ **NO-GO** | Pending: M-16 observability (Sentry / structured logs / dashboards), seeded admin user for the admin-positive smoke step, real test-mode Stripe Checkout end-to-end, optional `staging.mustbeviral.com` DNS for cleaner staging access |
| **Live Stripe activation** | ❌ **NO-GO** | Out of scope for Run 19. Requires separate run with explicit live-key authorisation, live-mode product/price creation, and DNS / billing-portal verification |

## Closed in Run 19

- **Commit + push of Run 1-17 worktree** — `e104c0f` on top of `1864c48`, 93 files, +17394 / -6535.
- **Wrangler CLI auth** — restored, OAuth-bearing user is `ernijs.ansons@gmail.com`'s account `d2897bdebfa128919bd89b265e6a712e`.
- **Stripe test-mode setup** — products, prices, webhook endpoint, all 6 secrets written to both envs.
- **Staging deploy + smoke** — `88c739f1-...` green.
- **Production redeploy + smoke** — `15ce175b-...` green, replaced Milestone 8.
- **AI-3 / C-3** — Workers AI Flux + R2 upload verified end-to-end (309 KB PNG written for "abstract pastel geometric shapes on white background" prompt). One run with prompt "product hero shot" hit Cloudflare's content filter (`workers_ai_image_error:3030`) and gracefully fell back to mock with `failureReason` recorded — confirming both the live path and the mock-fallback path work as designed.

## Required next gates (in order)

1. **Real test-mode Stripe Checkout end-to-end** — `stripe trigger checkout.session.completed` against a Checkout session, verify subscription row + `entitlements` cap update flow.
2. **Sentry / observability (M-16)** — provider selection (Sentry, Logflare, Cloudflare Workers Observability dashboards), secret writes, route exception/log forwarding wired in `src/server/index.ts`.
3. **Admin user seed** — `INSERT INTO users (..., role) VALUES (..., 'admin')` in production D1 for the admin-positive smoke step (currently only admin-deny is proven).
4. **`staging.mustbeviral.com` DNS** — small additive zone-record edit so the staging hostname resolves without `curl --resolve`. Token currently has only `zone (read)`; needs `dns_records (write)` or user-side dashboard edit.
5. **Live Stripe activation** — separate run with live-key authorisation and live-mode setup.

Closed in code: image generation (H-2), workflows (C-2), HTTP integration suite (C-6), agent surface (H-1), CSRF (CSRF-1), MVP UI route set (C-5), staging Cloudflare provisioning (M-17), CI workflow + Git remote (H-4), Workers AI router real-call (C-3), Stripe operational gates (test mode).

## Stripe live activation specifically

Test mode is now operational. Live activation remains explicitly deferred:

- [x] Integration test suite covers plan-cap and Stripe replay paths.
- [x] Configured `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_*` via `wrangler secret put` (test mode).
- [x] Registered webhook endpoint `https://mustbeviral.com/api/webhooks/stripe` (test mode) for the 5 required events.
- [x] Signed-payload tamper + replay smoke against production webhook secret.
- [ ] Stripe test-mode end-to-end Checkout from a test workspace; verify subscription row advances.
- [ ] Flip to live mode (separate run, requires live-key authorisation).

## Recommendation

Production is shipping the Run-1-17 hardened worker today. Closed beta and paying-customers (test-mode) can both move forward immediately; the open paying-customers gate is operational only (one real Checkout end-to-end). Public marketing launch waits on observability + admin seed + a real test-mode purchase.

`shipped: true` — for the Run-19 deploy and smoke. Marketing launch remains `pending`.

---

## Pre-Run-19 verdicts (preserved for diff)

| Audience | Pre-Run-19 verdict |
|---|---|
| Local development | ✅ GO |
| Staging | ⚠️ CONDITIONAL GO |
| Production (no new code) | ⚠️ CONDITIONAL GO |
| Live Stripe (paid plans) | ⚠️ CONDITIONAL GO (operational gates only) |
| Closed beta | ⚠️ CONDITIONAL GO |
| Paying customers | ⚠️ CONDITIONAL GO |
| Public marketing launch | ❌ NO-GO |
