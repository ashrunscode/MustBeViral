# MustBeViral Option D — Master Build & Dark-Deploy Roadmap (Codex Execution Spec)

> **Authoritative single source of truth** for the "real platform integration" build, post-Run-20. Codex must read this file in full before any tool call. There is no separate amendment file — every dark-deploy clarification is baked in here.

## 0. Strategy — Dark Deploy (build, don't launch)

**Build all four platform adapters** (LinkedIn, X, Meta, TikTok) and ship them to production **behind feature flags that default to OFF**. Customer-facing behaviour after this run is **identical to Run 20**: AI drafting + approval workflow + manual export. Launching any platform to real customers is a **future per-platform decision** made by flipping its flag — **explicitly out of scope of this run**.

### Build vs Launch

| Run | Result |
|---|---|
| **Build (this run)** | All 4 adapters compiled, tested, deployed to production with flags OFF. Dogfooded against the founder's own sandbox/dev accounts on staging with a temporary flag flip during smoke. Founder verifies code is real, end-to-end, and reversible. |
| **Launch (future, per-platform)** | Founder picks a single platform, confirms platform-specific approvals/credentials, flips its production flag from `"false"` to `"true"`, and notifies customers. Each platform launches independently. |

### Why dark deploy

- Decouples expensive/slow platform approvals (LinkedIn Marketing API, Meta App Review, X Basic tier upgrade) from the code build. Code lands while approvals are in flight.
- Eliminates the $200/mo X Basic tier cost during build — X runs on Free tier through smoke; upgrade only at X-launch decision time.
- Per-platform reversibility: a problem with one platform's API doesn't take down the others.
- Zero customer-visible risk during build. Production behaviour stays exactly as it is today.

## 1. Hard rules (binding across every phase)

- **Feature flags default to `"false"` in production for this entire run.** Production flag-flips happen only at future launch decisions, never inside this build.
- **Approval-before-publish + approval-before-reply stay.** No code path may publish or reply without `content_posts.status = 'approved'` or `dm_events.status` in the explicit approved set.
- **Use each platform's official OAuth + API.** No browser automation, no headless scrapers, no reused unofficial endpoints, no TOS bypass.
- **Fail-closed everywhere when a flag is OFF.** OAuth routes 503, webhook endpoints return `200 {ignored: "feature_disabled"}` (platforms penalise non-2xx with noisy retry queues), cron polling skips, UI hides Connect buttons.
- **Token encryption at rest.** Refresh + access tokens encrypted in KV (AES-GCM, key derived from `TOKEN_ENCRYPTION_KEY` Worker secret). D1 holds metadata only (platform, scopes, expiry, KV key).
- **Per-platform rate-limit honour** with explicit exponential backoff. No 429 retry-loops.
- **Audit log every outbound platform call.** `audit_logs` row with `action='platform.<verb>'`, external request id, response status, elapsed_ms.
- **Approval-before-reply is symmetric to approval-before-publish.** Inbound comment → `dm_events.status='received'` → AI drafts reply → `'pending_approval'` → human approval → `'approved'` → outbound reply call.
- **No regression to the Run 1-17 baseline.** Security headers, CSRF, rate limit, SSRF guard, raw-body Stripe webhook verification, admin/MCP RBAC, manual export, DM safety — all preserved.
- **No token writes via `wrangler.jsonc` vars.** Only via `wrangler secret put` or via the encrypted-KV path. Never log a token; never echo it in chat or audit rows. Logs scrub `Bearer .{20,}` and `access_token=\S+` patterns.
- **Staging-first for every deploy.** Phase smoke on staging before the production deploy. Production deploy ends with flag-OFF state confirmed.
- **Halt on platform-approval delay.** Document in `KNOWN_FAILURES.md`; do not fabricate credentials or stub real OAuth. Other phases continue in parallel.
- **No live Stripe activation in this run.** Stripe stays in test mode. Live activation is a separate authorised run.
- **No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` writes.** User has deferred both. `KIMI_API_KEY` is optional and only written if user provides a value.

## 2. Current state snapshot (verify before starting)

- Production worker: `mustbeviral-production` v `15ce175b-4870-4005-9c83-f042f5831177`. Runs Run 1-17 hardened code.
- Staging worker: `mustbeviral-staging` v `88c739f1-3dfc-4f91-8984-229e5b623b1c`.
- D1 production: `b9a428e0-038a-4df7-a59d-3a5ddde54550`. Staging: `04b2303a-d7b1-4773-8fd7-cb44bbff88cb`.
- KV production: `ff374abd8ca141e8af086afb593e8a8a`. Staging: `158d36f839a54e5baac85bdcbcff8555`.
- R2 production: `mustbeviral-production-media`. Staging: `mustbeviral-staging-media`.
- Stripe test mode wired in both envs; 4 products + 4 prices + 1 webhook endpoint.
- Admin user seeded in production: `admin+ops@mustbeviral.com` (role=admin).
- GitHub remote: `https://github.com/ernijsansons/MustBeViral` (private). master = `491998d`. Run 20 doc edits uncommitted.
- Local gate: typecheck ✅ / lint ✅ / test ✅ (12 files / 46 tests) / build ✅ (worker bundle 620 KB) / audit ✅ (0 high-CVE) / e2e ✅ (6/6).

### What's NOT built (this roadmap delivers all of it)

- Zero OAuth flow for any social platform (the `oauth_accounts` table exists in schema but no route writes to it).
- `brand_social_profiles` table exists; no route writes to it.
- `services/scheduler/index.ts` `VistaSocialAdapter` and `BufferAdapter` return `status: "failed"` with explicit "typed skeleton" message.
- `DMAutomationSetupWorkflow` hard-codes `outboundExecution: "none"` + `browserBot: false`.
- Zero `fetch(...)` calls in `src/` to any social platform domain.

## 3. Feature-flag set (the heart of dark deploy)

In `wrangler.jsonc` under **both** `env.staging.vars` and `env.production.vars`, add 8 flags, all defaulting to `"false"`:

```jsonc
"ENABLE_LINKEDIN_PUBLISH": "false",
"ENABLE_LINKEDIN_INGEST":  "false",
"ENABLE_X_PUBLISH":        "false",
"ENABLE_X_INGEST":         "false",
"ENABLE_META_PUBLISH":     "false",
"ENABLE_META_INGEST":      "false",
"ENABLE_TIKTOK_PUBLISH":   "false",
"ENABLE_TIKTOK_INGEST":    "false"
```

### Fail-closed surface behaviour

| Surface | Behaviour when flag is OFF |
|---|---|
| `GET /api/brands/:brandId/oauth/<platform>/start` | `503 {code: "FEATURE_DISABLED", platform}` |
| `GET /api/oauth/<platform>/callback` | `503` same; never write a `social_account_tokens` row |
| `POST /api/webhooks/<platform>` | `200 OK {ignored: "feature_disabled"}` — platforms penalise non-2xx with retries that pollute their queues, so silent drop |
| `ApprovalSchedulingWorkflow` publish step | Skips platform path; falls through to manual-export (current behaviour) |
| Cron polling tick | `if (!isPlatformEnabled(env, platform, "ingest")) continue;` |
| UI `/connections` page | Filters platforms by enabled-publish flag; OFF platforms hidden |

### Helper

```ts
// src/server/services/platforms/feature-flags.ts (new)
import type { Env } from "../../env";

export type PlatformId = "linkedin" | "x" | "meta" | "tiktok";
export type PlatformCapability = "publish" | "ingest";

export function isPlatformEnabled(
  env: Env,
  platform: PlatformId,
  capability: PlatformCapability,
): boolean {
  const key = `ENABLE_${platform.toUpperCase()}_${capability.toUpperCase()}` as keyof Env;
  return env[key] === "true";
}
```

Type-gen note: `Env` is regenerated by `wrangler types` after `wrangler.jsonc` edits, so the new flag keys appear as `"false" | "true"` literal-union types automatically.

## 4. Platform priority order + rationale

1. **LinkedIn** — start here. B2B-aligned. OAuth 2.0 straightforward. UGC Posts + Comments APIs documented and stable. Marketing Developer Platform approval can take 1-7 days; **development-mode app works fine for build + staging smoke**.
2. **X (Twitter)** — second. v2 API well-documented. **Build entirely on Free tier** — supports app dev + writing tweets + reading specific tweet IDs. Basic tier ($200/mo) is required only for mention-polling at any useful scale; defer to X-launch decision.
3. **Meta (Instagram Business + Facebook Page)** — third. Most complex. Requires Meta Business verification + App Review for `instagram_basic`, `instagram_content_publish`, `pages_manage_posts`, `pages_read_engagement`. Build runs in **Development Mode** (works against test users only — fine for dogfood smoke).
4. **TikTok for Business** — fourth. Content Posting API newer. OAuth 2.0. Build runs in **Sandbox Mode** until full approval.
5. **Threads** — deferred. API still alpha; revisit after build is complete.

## 5. Architecture

### 5.1 Adapter pattern

```ts
// src/server/services/platforms/types.ts (new)
export type PlatformId = "linkedin" | "x" | "meta" | "tiktok";

export interface PlatformPublishInput {
  brandId: string;
  workspaceId: string;
  postId: string;
  caption: string;
  mediaR2Keys: string[];   // R2 keys of attached images/videos
  scheduledAt: string;     // ISO; if past, publish immediately
  approvedBy: string;      // approver user id (audit chain)
}

export interface PlatformPublishResult {
  platform: PlatformId;
  status: "published" | "scheduled" | "failed" | "feature_disabled";
  externalPostId?: string;
  externalUrl?: string;
  errorCode?: string;
  errorMessage?: string;
  rateLimitReset?: number;
}

export interface PlatformReplyInput {
  brandId: string;
  workspaceId: string;
  inboundEventId: string;       // dm_events row id
  externalCommentId: string;
  replyBody: string;
  approvedBy: string;
}

export interface PlatformReplyResult {
  platform: PlatformId;
  status: "sent" | "failed" | "feature_disabled";
  externalReplyId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PlatformAdapter {
  id: PlatformId;
  publish(input: PlatformPublishInput, token: AccessToken): Promise<PlatformPublishResult>;
  reply(input: PlatformReplyInput, token: AccessToken): Promise<PlatformReplyResult>;
  ingestInbound?(payload: unknown, signature: string | null, env: PlatformEnv): Promise<IngestResult>;
}
```

`services/scheduler/index.ts` keeps the existing `SchedulerProvider` interface for backward compatibility but is now backed by a `PlatformAdapter` factory. Vista Social and Buffer skeletons remain in place (still return `status: "failed"`) — they are superseded but not deleted.

### 5.2 Token storage

D1 metadata + KV ciphertext.

```sql
CREATE TABLE IF NOT EXISTS social_account_tokens (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin','x','meta','tiktok')),
  external_account_id TEXT NOT NULL,
  account_label TEXT NOT NULL,
  scope_csv TEXT NOT NULL,
  token_kv_key TEXT NOT NULL,
  access_token_expires_at TEXT NOT NULL,
  refresh_token_expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  last_used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_id, platform, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_tokens_brand_platform
  ON social_account_tokens(brand_id, platform, status);
```

KV value shape (encrypted JSON):
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "issued_at": "2026-05-12T00:00:00Z",
  "platform_metadata": { ... }
}
```

Encryption: **AES-GCM** via WebCrypto. Key = `HKDF(secret = env.TOKEN_ENCRYPTION_KEY, salt = brandId, info = "social_account_tokens")`. Each KV value uses a fresh 12-byte IV stored as the first 12 bytes of the ciphertext. Stale tokens are deleted from KV when `social_account_tokens.status` flips to `revoked` or `expired`.

`env.TOKEN_ENCRYPTION_KEY` is a new secret. Generate via `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` and write via `wrangler secret put TOKEN_ENCRYPTION_KEY --env <staging|production>`.

### 5.3 Publishing flow

```
content_posts.status = 'approved'
  └→ ApprovalSchedulingWorkflow (extended):
       └→ for each connected social account on the brand for this platform:
            ├→ if (!isPlatformEnabled(env, platform, "publish")) → skip, fall through to manual export
            ├→ load token via getDecryptedToken(socialAccountId, env)
            ├→ if expired, refresh; on refresh failure mark status=expired and surface to UI
            ├→ adapter.publish({brandId, postId, caption, mediaR2Keys, ...}, token)
            ├→ INSERT INTO published_posts
            ├→ UPDATE content_posts.status = 'published'
            ├→ INSERT audit_logs action='platform.publish'
            └→ on rate-limit/transient error: retry with workflow step.do backoff
```

```sql
CREATE TABLE IF NOT EXISTS published_posts (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  external_post_id TEXT NOT NULL,
  external_url TEXT,
  social_account_token_id TEXT NOT NULL REFERENCES social_account_tokens(id),
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  UNIQUE(platform, external_post_id)
);
CREATE INDEX IF NOT EXISTS idx_published_posts_brand_platform_published_at
  ON published_posts(brand_id, platform, published_at DESC);
```

### 5.4 Comment ingestion flow

```
inbound webhook (or cron polling tick) → /api/webhooks/<platform>
  └→ if (!isPlatformEnabled(env, platform, "ingest")) → return 200 {ignored: "feature_disabled"}
  └→ verify platform signature
  └→ INSERT OR IGNORE INTO webhooks_inbox (idempotency)
  └→ resolve published_post (or brand if it's a mention)
  └→ INSERT INTO platform_comments
  └→ INSERT INTO dm_events with rule_id = NULL, status = 'received'
  └→ (optional) AI drafts reply per brand's DM rules → dm_events.status = 'drafted'
  └→ operator reviews in UI → approves → dm_events.status = 'approved'
  └→ ApprovalSchedulingWorkflow (extended) calls adapter.reply
  └→ on success: dm_events.status = 'sent'
  └→ audit_logs action='platform.reply'
```

```sql
CREATE TABLE IF NOT EXISTS platform_comments (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  published_post_id TEXT REFERENCES published_posts(id),
  platform TEXT NOT NULL,
  external_comment_id TEXT NOT NULL,
  parent_external_comment_id TEXT,
  author_external_id TEXT,
  author_handle TEXT,
  body TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
  ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(platform, external_comment_id)
);
CREATE INDEX IF NOT EXISTS idx_platform_comments_brand_post
  ON platform_comments(brand_id, published_post_id, ingested_at DESC);
```

Cron trigger in `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": ["*/5 * * * *"]
}
```

The cron handler is added to `src/server/index.ts::default export { fetch, scheduled }`, and its first action per platform is `if (!isPlatformEnabled(env, platform, "ingest")) continue;`.

### 5.5 UI additions

- New page `/app/brands/:brandId/connections` — list of connected social accounts. Per platform: a "Connect <platform>" button **only when the platform's publish flag is ON** (otherwise the platform row is hidden).
- Each Connect button kicks off `GET /api/brands/:brandId/oauth/<platform>/start` → 302 to the platform's auth URL → callback at `GET /api/oauth/<platform>/callback?code=...&state=...`.
- `state` parameter is HMAC-signed and carries `{brandId, csrfNonce, ts}`. Validated in the callback before touching D1.
- Approvals page extended with platform badges + post-publish status (✅ published, ⏱ scheduled, ❌ failed with reason).
- New "Comments" page per brand, paginated list of `platform_comments` with reply box. Approve → send.

### 5.6 Rate limiting per platform

- Each adapter exposes `getRateLimitState(env): Promise<{remaining, reset}>`.
- KV `CACHE` namespace stores rolling counters keyed by `rate:<platform>:<accountId>:<window>`.
- On 429, adapter parses `Retry-After` (or platform-specific equivalent), persists into KV with TTL = retry-after, workflow's `step.do` retries with exponential backoff respecting that floor.

## 6. Phases (each is a Codex halt-and-report gate)

### Phase 0 — Pre-flight + Run 20 commit

- Verify env (wrangler whoami, gh auth status, stripe config --list, node ≥ v22).
- Verify local gate green.
- Commit + push Run 20 doc edits (see `FIX_LOG.md` Post-Run-20 Override "Files changed this run" for exact list).
- Halt; ask user "begin Phase A?".

### Phase A — Foundation (Days 1-2, no platform deps)

**Deliverables:**
- Migration `0003_platform_integration.sql` containing `social_account_tokens`, `published_posts`, `platform_comments` (and optional rollup index migration). Apply to **local + staging D1 only**. Production migration deferred to Phase F.
- `src/server/services/platforms/types.ts` — adapter interface.
- `src/server/services/platforms/token-storage.ts` — encrypted KV read/write.
- `src/server/services/platforms/oauth-state.ts` — HMAC-signed state encode/decode.
- `src/server/services/platforms/rate-limit.ts` — KV-backed rate-limit store.
- `src/server/services/platforms/feature-flags.ts` — the helper from section 3.
- **`wrangler.jsonc` patched with the 8 feature flags defaulting to `"false"` in BOTH `env.staging.vars` AND `env.production.vars`.**
- `wrangler types` regenerated so `Env` includes the new flag keys.
- Unit tests for token-storage (round-trip encrypt/decrypt with a stub `TOKEN_ENCRYPTION_KEY`), oauth-state (tamper rejection, 5-min replay window), and feature-flags (true/false resolution).
- `wrangler secret put TOKEN_ENCRYPTION_KEY --env staging` and `--env production`. Generate fresh 32-byte values per env.

**Acceptance:**
- Migration applies cleanly to local + staging D1. `sqlite_master` count rises from 38 tables / 39 indexes to 41 tables / 42 indexes (staging only).
- New unit tests pass; total test count rises from 46 to ~50.
- `wrangler secret list --env <env>` shows `TOKEN_ENCRYPTION_KEY` in both envs.
- Local gate green; no source-code regression.
- Staging + production deploy from this phase: **all 8 flags read `"false"` in `wrangler.jsonc`; verified post-deploy via `wrangler deployments versions view --name <worker> <version-id>` env block.**

### Phase B — LinkedIn (Days 3-7)

**Founder pre-reqs (parallel-track from Day 1):**
- LinkedIn Developer app created in **Development Mode**. Required products: **Sign In with LinkedIn using OpenID Connect**, **Share on LinkedIn**, **Community Management API**.
- Submission for Marketing Developer Platform access (gates only the customer-facing launch, NOT this build).

**Deliverables:**
- Secrets: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `LINKEDIN_REDIRECT_URI` (= `https://mustbeviral.com/api/oauth/linkedin/callback` and the staging equivalent).
- Routes (all flag-gated):
  - `GET /api/brands/:brandId/oauth/linkedin/start` — issues `state`, 302 to LinkedIn auth URL.
  - `GET /api/oauth/linkedin/callback` — exchanges `code` for tokens, calls `/userinfo` to resolve org URN, writes `social_account_tokens` + KV ciphertext.
  - `DELETE /api/brands/:brandId/social-accounts/:accountId` — revoke + delete KV + flip D1 status.
- Adapter `src/server/services/platforms/linkedin.ts`:
  - `publish` — `POST /rest/posts` with `LinkedIn-Version: <YYYYMM>` header. Text-only, image, video.
  - `reply` — `POST /rest/socialActions/<urn>/comments` for replies to comments on owned posts.
  - `ingestInbound` — Community Management API webhook handler. Verifies `X-LinkedIn-Signature` (HMAC-SHA-256 with `LINKEDIN_CLIENT_SECRET`).
- Cron handler polls `/rest/socialActions/<post-urn>/comments` every 5 min for each connected LinkedIn account (webhook fallback).
- UI: `/app/brands/:brandId/connections` shows LinkedIn connect button — visible only when `ENABLE_LINKEDIN_PUBLISH` is `"true"`. Approvals page shows LinkedIn publish badge.
- HTTP integration tests: OAuth start (302), callback success + state tamper, publish (mocked LinkedIn API), reply (mocked), webhook signature tamper, **flag-OFF fail-closed for all four surfaces**.

**Acceptance (in dark deploy):**
- Code compiles, unit tests pass, integration tests pass with mocked external calls.
- Deployed to staging with `ENABLE_LINKEDIN_PUBLISH = "false"` — `/api/brands/:brandId/oauth/linkedin/start` returns 503 `FEATURE_DISABLED`; `/api/webhooks/linkedin` returns `200 {ignored}`.
- **Dogfood smoke**: founder temporarily flips `ENABLE_LINKEDIN_PUBLISH` + `ENABLE_LINKEDIN_INGEST` to `"true"` on **staging only** via `wrangler secret put ENABLE_LINKEDIN_PUBLISH --env staging` (or vars edit + redeploy). Connects own LinkedIn dev account, publishes a real post, receives a real comment, replies. After smoke, **flags flip back to `"false"` on staging**.
- Deployed to production with **all LinkedIn flags `"false"`**. Customer-visible production behaviour identical to Run 20.
- Smoke 21/21 + new LinkedIn integration tests pass.

**Halt conditions:**
- LinkedIn Marketing API approval rejected. Capture reason in `KNOWN_FAILURES.md`; surface to user; continue with Phase C (LinkedIn launch later, build done).
- LinkedIn API rate limits hit during smoke (suggests a bug).
- Webhook signature can't be verified (LinkedIn changed format; check docs).

### Phase C — X (Twitter) on Free Tier (Days 8-11)

**Founder pre-reqs:**
- X Developer signup at **Free tier** ($0/mo). Sufficient for build + dogfood smoke. **Basic tier ($200/mo) upgrade is a launch-time decision, not a build-time one.**

**Deliverables:**
- Secrets: `X_CLIENT_ID`, `X_CLIENT_SECRET`, `X_REDIRECT_URI`. OAuth 2.0 with PKCE — `code_verifier` per-request, stored in JWT `oauth_state` (not as a secret).
- Routes mirroring LinkedIn pattern: `start`, `callback`, `disconnect`.
- Adapter `src/server/services/platforms/x.ts`:
  - `publish` — `POST https://api.x.com/2/tweets`. Text-only first; media via `POST /2/media/upload` chunked then attach via `media_ids`.
  - `reply` — `POST /2/tweets` with `reply.in_reply_to_tweet_id`.
  - `ingestInbound` — X v2 doesn't have webhooks at Free/Basic tier; cron polls `GET /2/users/:id/mentions` every 5 min using `since_id` cursor stored in KV `cursor:x:<accountId>`.
- HTTP integration tests + dogfood smoke pattern.

**Acceptance (in dark deploy):**
- Code compiles, tests pass.
- Production deploy with `ENABLE_X_PUBLISH = "false"` + `ENABLE_X_INGEST = "false"`.
- Dogfood smoke on staging with flags temporarily ON: founder posts a real tweet via own dev account, mention ingested via cron within 5 min, founder replies.
- After smoke, X flags return to `"false"` everywhere.

**Halt conditions:**
- X API surface changed (X has historically changed surfaces; check Recent Updates page).
- Free tier write quota saturated during smoke (~1,500 writes/mo total — should be plenty for smoke).

### Phase D — Meta (Instagram Business + Facebook Page) (Days 12-18)

**Founder pre-reqs (parallel-track from Day 1):**
- Meta App created in **Development Mode**. Test users added.
- Meta Business verification + App Review submission (2-4 weeks; gates customer launch, not this build).

Required permissions for launch: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`.

**Deliverables:**
- Secrets: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`.
- Routes + adapter for both Instagram Business and Facebook Page. Two `external_account_id` rows per connection (page id + ig-user id).
- Adapter `src/server/services/platforms/meta.ts`:
  - `publish` — Instagram: 2-step container API (`POST /<ig-user>/media` then `POST /<ig-user>/media_publish`). Facebook: `POST /<page-id>/feed` or `POST /<page-id>/photos`.
  - `reply` — `POST /<comment-id>/replies` or `POST /<comment-id>/comments`.
  - `ingestInbound` — Meta webhook for `instagram` + `page` subscription. Verifies `X-Hub-Signature-256` with `META_APP_SECRET`.
- Webhook subscription verification endpoint: `GET /api/webhooks/meta` returns the `hub.challenge` parameter (only when `ENABLE_META_INGEST` is ON; otherwise 503).

**Acceptance (in dark deploy):**
- Same pattern as B/C.
- Dogfood smoke uses Meta App test users; founder publishes test post to test IG business + test FB page.

**Halt conditions:**
- App Review rejection during smoke prep (rare; Development Mode shouldn't need full review).

### Phase E — TikTok for Business in Sandbox (Days 19-21)

**Founder pre-reqs:**
- TikTok for Business app in **Sandbox Mode**. Full approval is a launch-time prereq.

**Deliverables:**
- Secrets: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`.
- OAuth 2.0 + routes + adapter.
- Content Posting API for publish (initially video-only; image posts via Photo Mode API where available).
- Comment Management API for read + reply.
- Webhook handler for comment events.

**Acceptance (in dark deploy):**
- Same pattern. Sandbox accounts only for smoke.

### Phase F — Production rollout (Day 21) — flags STAY OFF

**Deliverables:**
- Production D1 migration `0003_platform_integration.sql` applied (and any companion migrations from Phase A). Verified via `sqlite_master` count.
- Production deploy of all code from Phases A-E.
- **Verified: every `ENABLE_<X>_*` flag is `"false"` in production.** Captured via `wrangler deployments versions view --name mustbeviral-production <version>` env block check, or via curl to `/api/health` extended to include a flag-state summary (admin-only or no-leak version).
- Sentry alert rules (assumes Sentry from Run 21, otherwise Workers Observability dashboards):
  - Any `platform.publish` failure with non-rate-limit error → on-call channel.
  - Any token decryption failure → security channel.
  - Any unexpected 5xx from an adapter → on-call.
- Docs:
  - `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md` — platform connections, token revocation, scope drift, App Review revoked, **flag-flip procedure per platform**, rollback runbook.
  - Updated `docs/system-dna/SECURITY_CHECKLIST.md` with platform-token sections.
  - Updated `docs/system-dna/TEST_PLAN.md` with platform integration coverage.
- `SHIP_LOG.md` extended with Phase A-F timeline + flag-state matrix.

**Acceptance:**
- Production deploy green. **Every flag `"false"`.** Customer-visible behaviour identical to Run 20.
- Smoke 21/21 still passes (the existing functional smoke is unaffected by the flag-OFF adapters).
- `19_RELEASE_GO_NO_GO.md` adds verdict **"Platform integration code-ready"** = ✅ GO. Per-platform "<platform> launched" verdicts stay ❌ NO-GO until each flag flips.

## 7. Database migration order

```
0001_initial.sql                    # already applied (prod + staging)
0002_indexes_and_phase2.sql         # already applied (prod + staging)
0003_platform_integration.sql       # Phase A → staging only; Phase F → production
```

`0003` can be a single file covering `social_account_tokens`, `published_posts`, `platform_comments`, plus their indexes. Codex may split into multiple files if convenient (one per table) but all must be present and idempotent (`CREATE TABLE IF NOT EXISTS`).

## 8. Validation strategy

Every phase ends with the full local gate plus phase-specific HTTP integration tests plus staging deploy + smoke. The `scripts/smoke.sh` from Run 19 is extended with per-platform check steps that **skip when the relevant flag is OFF** (no false failures from flag-OFF surfaces).

A new check is added to the post-deploy smoke for **all** phases: confirm each `ENABLE_<X>_*` flag reads `"false"` in the deployed `wrangler.json` env block. This catches accidental flag flips.

Codex must NOT run a real publish/reply test against a production-linked platform account during automated smoke. Real-account tests live in `scripts/smoke-live-platforms.ps1` and require explicit founder invocation **plus** a temporary staging-flag flip.

## 9. Security checklist (additions)

- Token encryption-at-rest verified by a unit test (decrypt a value written in a separate runtime invocation).
- OAuth `state` validated for tamper + replay (5-minute window).
- Webhook signatures verified on every inbound platform event.
- Rate-limit floors honoured per platform.
- Token scope drift: if a refresh returns a `scope` field missing a required scope, row flips to `status='error'`, operator alerted in UI.
- Logs scrub tokens (regex match on `Bearer .{20,}`, `access_token=\S+`, etc.).
- **Flag-OFF fail-closed paths covered by integration tests** so a future regression that "leaks" a partially enabled state is caught.

## 10. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| LinkedIn Marketing API approval delay | Medium | Low (build) / High (launch) | Build proceeds in Development Mode; submission runs parallel |
| X API pricing change | Medium | Low (build) / Medium (launch) | Build entirely on Free tier; Basic upgrade only at X-launch |
| Meta App Review rejection | High | Low (build) / High (launch) | Development Mode for build; submit App Review Day 1; expect 1-3 cycles |
| TikTok quota too low for production | Low | Low (build) / Medium (launch) | Sandbox for build; confirm quota at app-approval time |
| Token compromise via Worker subprocess | Low | Critical | AES-GCM encryption-at-rest; periodic `TOKEN_ENCRYPTION_KEY_NEXT` rotation with dual-read |
| Comment volume saturates D1 | Low | Medium | Indexed; archive to R2 if rows exceed 10M |
| Approval fatigue (rubber-stamping replies) | Medium | Low | UI surfaces AI confidence + content warnings; adversarial intent flagged |
| **Accidental production flag flip during build** | Low | High | Phase-boundary check; integration test asserts flag-OFF surface behaviour; deploy-time verification step |

## 11. Definition of Done — split into Build-done and Launch-done

### Build-done (THIS run, after Phase F)

1. All 4 platform adapters compile + pass unit tests with mocked APIs.
2. HTTP integration tests for all 4 platforms pass with mocked external calls (including flag-OFF fail-closed paths).
3. Founder has personally smoked one publish + one reply per platform against own dev/sandbox accounts **on staging only**, with flags temporarily ON for the smoke window. After smoke, flags return to `"false"` on staging.
4. Production deploy green; every `ENABLE_<X>_*` flag is `"false"` in production at end of run.
5. Every public surface fail-closes when its flag is OFF (OAuth 503, webhook 200+ignored, cron skip, UI hide).
6. `wrangler secret list --env production` shows `TOKEN_ENCRYPTION_KEY` but **no platform-credential secrets unless founder explicitly wrote them** — and missing credentials don't crash anything because flags are OFF.
7. **No customer-visible behaviour change in production vs Run 20.** A real customer logging in today vs after this run has identical experience.
8. Local + CI gate green.
9. `docs/system-dna/PLATFORM_INTEGRATION_RUNBOOK.md` exists with flag-flip procedure + per-platform launch checklists.
10. `19_RELEASE_GO_NO_GO.md` adds verdict **"Platform integration code-ready"** = ✅ GO; existing post-Run-20 verdicts unchanged.

### Launch-done (FUTURE per-platform decision, separate from this run)

For each platform independently, when the founder decides to launch:

1. Platform-specific approvals complete (LinkedIn Marketing API, X Basic tier, Meta App Review, TikTok full approval).
2. Production credentials written via `wrangler secret put <PLATFORM>_*`.
3. Webhook endpoint registered on the platform's developer portal pointing at production.
4. Production flag flip: `wrangler secret put ENABLE_<PLATFORM>_PUBLISH --env production` (paste `"true"`) and same for `_INGEST`.
5. Real-account smoke against production (founder's own real business account).
6. Customer announcement (out of MustBeViral scope).
7. Verdict flip in `19_RELEASE_GO_NO_GO.md`: "<platform> launched" = ✅ GO.

## 12. Founder action items — split into Build-blockers and Launch-blockers

| Action | Build-blocker? | Launch-blocker (per-platform)? |
|---|---|---|
| Generate `TOKEN_ENCRYPTION_KEY` (32-byte base64) | **YES** (Phase A) | n/a |
| LinkedIn Developer app in Development Mode + creds | **YES** (Phase B) | n/a |
| Submit LinkedIn Marketing API access | No (parallel) | **YES** for LinkedIn launch |
| X Developer app on Free tier + creds | **YES** (Phase C) | n/a |
| X Basic tier upgrade ($200/mo) | No (parallel) | **YES** for X launch |
| Meta App in Development Mode + creds | **YES** (Phase D) | n/a |
| Submit Meta App Review (parallel) | No (parallel) | **YES** for Meta launch |
| TikTok app in Sandbox + creds | **YES** (Phase E) | n/a |
| TikTok full app approval | No (parallel) | **YES** for TikTok launch |
| Sentry org/project (optional) | No | Recommended at launch |

Only **5 items** block the build (the encryption key + four dev-mode app credentials). All slow approvals/upgrades are parallel-track and don't gate the code build.

## 13. Cost (build vs launch)

| Item | During build (this run) | Post-launch (per platform flipped) |
|---|---|---|
| Cloudflare Workers / D1 / R2 / KV / Workers AI | within free tier; $20-50/mo at scale | same |
| Stripe (test mode) | $0 | $0 (live mode if/when activated, separate run) |
| LinkedIn API | $0 | $0 (free, throttled) |
| X (Twitter) | **$0 (Free tier)** | **+$200/mo (Basic) at X launch** |
| Meta API | $0 | $0 (free, App Review required) |
| TikTok API | $0 | $0 |
| Sentry (Team plan, optional) | $0-26/mo | $26/mo |
| **Total** | **$0-26/mo** | **$226-276/mo if all four platforms launched** |

Dark deploy saves **~$200/mo** until the X-launch decision flips that flag.

## 14. Codex execution prompt (paste into a fresh Codex session)

```
=== BEGIN PROMPT — MustBeViral Option D (DARK DEPLOY) ===

IDENTITY & GOAL
You are Codex resuming MustBeViral after Run 20. Your charter is:
codex-audit/D_REAL_PLATFORM_INTEGRATION_ROADMAP.md (read in full — there is no
separate amendment file; dark deploy is baked into the master).

Build all four platform adapters (LinkedIn, X, Meta, TikTok) and deploy them
to production behind feature flags that DEFAULT TO "false". Do NOT launch any
platform to customers in this run. Production behaviour after this run is
IDENTICAL to production behaviour today (AI drafting + approval + manual
export). Launching a platform is a future per-platform decision made by
flipping its flag.

WORKING DIRECTORY
C:\Users\ernij\OneDrive\Documents\V2\dev\MustBeViral

PRE-FLIGHT (do not skip)
1. Verify env: wrangler whoami, gh auth status, stripe config --list, node ≥ v22.
2. Verify local gate green: typecheck / lint / test / build / audit / e2e /
   git diff --check.
3. Read the charter file above plus the truth-file list in roadmap section 15.
4. Commit + push the Run 20 doc edits to origin/master (see FIX_LOG.md
   Post-Run-20 Override "Files changed this run" list).
5. Halt and ask the user "begin Phase A?" before continuing.

EXECUTION GATES (HALT AND REPORT AT EACH PHASE BOUNDARY)

PHASE 0: pre-flight + Run 20 commit. Halt.

PHASE A: Foundation (Days 1-2).
  - Migration 0003 → local + staging D1 only (NOT production).
  - Adapter interface, token storage, oauth-state, rate-limit, feature-flag helper.
  - Patch wrangler.jsonc with 8 flags defaulting to "false" in BOTH staging and
    production. wrangler types regen.
  - Write TOKEN_ENCRYPTION_KEY to both envs (founder generates value).
  - Unit tests. Open PR. Wait for explicit "merge Phase A" before merging.
  - Halt and report.

PHASE B: LinkedIn (Days 3-7). Pause until founder provides LINKEDIN_CLIENT_ID
  and LINKEDIN_CLIENT_SECRET via AskUserQuestion. All flags stay OFF in
  production at end of phase. Dogfood smoke uses temporary staging-flag flip;
  staging flags return to "false" after smoke.

PHASE C: X on Free tier (Days 8-11). Pause until founder provides X creds.
  Same dark-deploy pattern.

PHASE D: Meta in Development Mode (Days 12-18). Pause until founder provides
  Meta creds. Same pattern.

PHASE E: TikTok in Sandbox (Days 19-21). Pause until founder provides TikTok
  creds. Same pattern.

PHASE F: Production rollout — FLAGS STAY OFF. Migration 0003 applied to
  production. Sentry alert rules. Documentation. SHIP_LOG.md updated.
  19_RELEASE_GO_NO_GO.md adds verdict "Platform integration code-ready" = ✅ GO.
  Final report: build-done: true.

HARD RULES (binding throughout — see roadmap section 1 for full list)
- Feature flags default to "false" in production for entire run.
- NEVER flip a production flag during this run. Staging flag flips for
  dogfood smoke are allowed; staging must return to "false" after smoke.
- OAuth start/callback fail-closed (503 FEATURE_DISABLED) when flag OFF.
- Webhook endpoints return 200 + {ignored: "feature_disabled"} when flag OFF.
- Cron polling skips OFF platforms.
- UI hides Connect buttons for OFF platforms.
- Approval-before-publish + approval-before-reply: NEVER bypass.
- Use platform OAuth + official APIs. No browser automation, no scrapers.
- Token encryption at rest in KV; D1 metadata only. Never echo a token.
- Per-platform rate-limit honour with backoff.
- Audit log every outbound platform call.
- No source-code regression to Run 1-17 baseline.
- Staging-first for every deploy.
- Halt on platform-approval delay; document in KNOWN_FAILURES.md; other
  phases continue in parallel.
- No live Stripe activation.
- No OPENAI_API_KEY or ANTHROPIC_API_KEY writes.

DEFINITION OF DONE (BUILD-DONE — NOT Launch-done)
Roadmap section 11. 10 numbered acceptance criteria; the headline is "every
ENABLE_<X>_* flag is 'false' in production at end of run".

OUT OF SCOPE
- Customer-facing launch of any platform (separate future per-platform
  decision via flag flip).
- Threads.
- Live Stripe.
- OpenAI / Anthropic key writes.

FINAL OUTPUT
After each phase: phase-name, pass/fail, files touched, version IDs deployed,
flag-state confirmation in production (8-row table of all flags' values),
halt/continue indicator.
After Phase F: build-done: true. List every flag's value in production
(should all be "false"). Confirm production customer-visible behaviour
matches Run 20.

=== END PROMPT ===
```

## 15. Required truth-file reads (for any Codex run executing this roadmap)

1. `codex-audit/D_REAL_PLATFORM_INTEGRATION_ROADMAP.md` (this file)
2. `codex-audit/FIX_LOG.md` — Post-Run-20 Override footer
3. `codex-audit/NEXT_EXECUTION_PLAN.md`
4. `codex-audit/KNOWN_FAILURES.md`
5. `codex-audit/19_RELEASE_GO_NO_GO.md`
6. `codex-audit/17_GAP_REGISTER.md`
7. `final-strategy/BUILD_LOG.md` — Milestone 19 + 20
8. `docs/system-dna/DEPLOYMENT_RUNBOOK.md`
9. `docs/system-dna/SECURITY_CHECKLIST.md`
10. `docs/system-dna/TEST_PLAN.md`
11. `wrangler.jsonc`
12. `src/server/index.ts`
13. `src/server/services/scheduler/index.ts`
14. `src/server/workflows/ApprovalSchedulingWorkflow.ts`
15. `src/server/workflows/DMAutomationSetupWorkflow.ts`
16. `src/server/db/migrations/0001_initial.sql`
17. `src/server/db/migrations/0002_indexes_and_phase2.sql`
18. `src/server/services/stripe/events.ts`
19. `src/server/middleware/security-headers.ts`
20. `src/server/middleware/csrf.ts`

## 16. Decisions baked in (no longer "open questions")

These were section-15 open questions in the pre-dark-deploy draft. Dark deploy resolves all of them:

| Question | Decision |
|---|---|
| Is X in scope despite $200/mo Basic tier? | **YES, build it.** Build entirely on X Free tier ($0/mo). Basic upgrade deferred to X-launch decision. |
| Is Meta in scope despite 2-4 week App Review? | **YES, build it.** Build in Development Mode. App Review submission runs parallel from Day 1. |
| Is TikTok in scope despite video-first content? | **YES, build it.** Build in Sandbox. Full approval is a launch-time prereq, not a build prereq. |
| Observability provider? | Defer to a separate "Run 21 observability" task. Sentry recommended, Workers Observability dashboards already on. Not on the critical path for build-done. |
| LinkedIn org type to support first? | All three (company / showcase / personal-as-creator). UGC API supports all; scope-set varies per type. Adapter handles by detecting the URN type from the OAuth `/userinfo` response. |

## 17. What this run does NOT change

- Vista Social / Buffer skeletons stay as-is — superseded by direct adapters but not deleted (deletion is a separate cleanup pass).
- Manual export remains the default for any platform with its flag OFF (i.e., all of them at end of this run).
- Threads remains deferred.
- Stripe stays in test mode.
- OpenAI / Anthropic keys remain unwritten.
- Existing approval-before-export, manual export, DM safety, SSRF, raw-body Stripe webhook verification, admin/MCP RBAC code paths are untouched.

---

**Status: MASTER ROADMAP — not yet executed.** Run 21+ will record per-phase progress against the acceptance criteria in section 6. Build-done = production deployed with every flag `"false"`. Launch-done = future per-platform decision.
