# Platform Integration Runbook

> Operational guide for the LinkedIn / X / Meta / TikTok integrations shipped in Run 21 (Option D). All four adapters are deployed to production at worker version `2f0e51da-7134-422f-949a-06c55d9b0a11` (post-Run-21) with every feature flag defaulted to `"false"`. Customer-visible behaviour is unchanged from Run 20 until a flag is explicitly flipped.

## TL;DR

| Platform | Build status | Launch status | Per-platform launch unblock |
|---|---|---|---|
| LinkedIn | ✅ Code shipped | ❌ Not launched | LinkedIn Marketing API approval + creds + flag flip |
| X / Twitter | ✅ Code shipped | ❌ Not launched | X dev account (Free tier OK for build smoke) + creds + flag flip |
| Meta (FB+IG) | ✅ Code shipped | ❌ Not launched | Meta App Review + creds + webhook URL register + flag flip |
| TikTok | ✅ Code shipped | ❌ Not launched | TikTok for Business approval + creds + flag flip |

## Feature flag matrix

Eight flags live in `wrangler.jsonc` under both `env.staging.vars` and `env.production.vars`, all defaulting to `"false"`. Helper at `src/server/services/platforms/feature-flags.ts::isPlatformEnabled`.

| Flag | Effect when `"false"` | Effect when `"true"` |
|---|---|---|
| `ENABLE_LINKEDIN_PUBLISH` | `/oauth/linkedin/start` → 503 `FEATURE_DISABLED`; UI hides LinkedIn Connect button; ApprovalSchedulingWorkflow skips LinkedIn publish branch | OAuth flow active; approved posts publish via LinkedIn UGC Posts API |
| `ENABLE_LINKEDIN_INGEST` | `/api/webhooks/linkedin` → 200 `{ignored: "feature_disabled"}`; cron skips LinkedIn comment poll | Webhook signature verified + comments persisted; replies dispatched via PlatformReplyWorkflow |
| `ENABLE_X_PUBLISH` | `/oauth/x/start` → 503; ApprovalSchedulingWorkflow skips X branch | OAuth 2.0 PKCE flow; tweets publish via v2 API |
| `ENABLE_X_INGEST` | Cron skips X mentions poll; webhook returns 200 ignored | Cron polls `/2/users/:id/mentions` with `since_id` cursor in KV every 5 min |
| `ENABLE_META_PUBLISH` | `/oauth/meta/start` → 503 | OAuth flow; one connection writes FB Page + IG Business token rows |
| `ENABLE_META_INGEST` | `/api/webhooks/meta` → 200 `{ignored}` (silent drop avoids retry storms); `GET /api/webhooks/meta` won't return `hub.challenge` | Subscription verification active; signed payloads persist |
| `ENABLE_TIKTOK_PUBLISH` | `/oauth/tiktok/start` → 503 | OAuth flow; videos publish via Content Posting API |
| `ENABLE_TIKTOK_INGEST` | Webhook ignored | HMAC over `<timestamp>\n<body>` verified; comments persisted |

## Pre-launch checklist (per platform)

### LinkedIn

1. **App approval**: Sign In with LinkedIn using OpenID Connect + Share on LinkedIn + Community Management API products approved on the LinkedIn Developer Portal.
2. **Redirect URIs** registered on the LinkedIn app for both staging and production:
   - `https://staging.mustbeviral.com/api/oauth/linkedin/callback`
   - `https://mustbeviral.com/api/oauth/linkedin/callback`
3. **Webhook URL** registered: `https://mustbeviral.com/api/webhooks/linkedin`. The webhook signing secret from the LinkedIn dashboard goes into `LINKEDIN_WEBHOOK_SECRET`.
4. **Secrets** (run for **both** `--env staging` and `--env production`):
   ```bash
   wrangler secret put LINKEDIN_CLIENT_ID --env <env>
   wrangler secret put LINKEDIN_CLIENT_SECRET --env <env>
   wrangler secret put LINKEDIN_REDIRECT_URI --env <env>     # https://<host>/api/oauth/linkedin/callback
   wrangler secret put LINKEDIN_WEBHOOK_SECRET --env <env>
   wrangler secret put TOKEN_ENCRYPTION_KEY --env <env>      # if not already set
   ```
5. **Flag flip** (staging first, smoke, then production):
   ```bash
   echo "true" | wrangler secret put ENABLE_LINKEDIN_PUBLISH --env <env>
   echo "true" | wrangler secret put ENABLE_LINKEDIN_INGEST --env <env>
   ```
6. **Smoke** (per env): connect a real LinkedIn dev/test account via `/app/brands/<brandId>/connections` → publish an approved post → receive a comment → reply.

### X (Twitter)

1. **Dev account**: TikTok-for-Business equivalent. X Free tier ($0/mo) is sufficient for build smoke (~1,500 writes/mo app-wide). Basic tier ($200/mo) only needed for launched-customer scale.
2. **PKCE**: the adapter generates code_verifier + S256 challenge automatically. Nothing to configure server-side beyond the OAuth app.
3. **Webhook**: X v2 at Free/Basic does **not** deliver webhooks. Mentions ingest via the 5-minute cron poll. There's nothing to register; only the OAuth app config matters.
4. **Secrets** (run for **both envs**):
   ```bash
   wrangler secret put X_CLIENT_ID --env <env>
   wrangler secret put X_CLIENT_SECRET --env <env>          # optional; only for confidential clients
   wrangler secret put X_REDIRECT_URI --env <env>           # https://<host>/api/oauth/x/callback
   ```
5. **Flag flip**:
   ```bash
   echo "true" | wrangler secret put ENABLE_X_PUBLISH --env <env>
   echo "true" | wrangler secret put ENABLE_X_INGEST --env <env>
   ```
6. **Smoke**: connect → publish a tweet → wait ≤ 5 min for cron tick → mention shows up in Comments UI.

### Meta (Facebook Page + Instagram Business)

1. **App Review**: submit Meta App for review. Required permissions: `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `pages_manage_engagement`, `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`. Expect 1–3 review cycles, 2–4 weeks total. Use **Development Mode** with test users for build smoke until Review approves.
2. **Webhook subscription** in the App dashboard, with:
   - Callback URL: `https://mustbeviral.com/api/webhooks/meta`
   - Verify token: same value you put in `META_WEBHOOK_VERIFY_TOKEN`
   - Subscribe to objects: `page` (with `feed` field), `instagram` (with `comments` field).
3. **Secrets** (run for **both envs**):
   ```bash
   wrangler secret put META_APP_ID --env <env>
   wrangler secret put META_APP_SECRET --env <env>
   wrangler secret put META_REDIRECT_URI --env <env>
   wrangler secret put META_WEBHOOK_VERIFY_TOKEN --env <env>
   ```
4. **Flag flip**:
   ```bash
   echo "true" | wrangler secret put ENABLE_META_PUBLISH --env <env>
   echo "true" | wrangler secret put ENABLE_META_INGEST --env <env>
   ```
5. **Smoke**: connect → Meta returns N+M pages (N FB + M IG). For IG publish, the caller passes `platformMetadata.image_url` pointing at a publicly fetchable URL (e.g., an R2 presigned URL). Test FB feed publish first (simpler), then IG container API.

### TikTok for Business

1. **App approval**: TikTok for Business app in Sandbox Mode is sufficient for build smoke against test accounts. Full approval (review) needed for live customer use.
2. **Redirect URI** registered on TikTok app.
3. **Webhook URL** registered: `https://mustbeviral.com/api/webhooks/tiktok`. TikTok signs with HMAC-SHA-256 over `<timestamp>\n<body>` using the **client_secret** as the HMAC key. `TIKTOK_CLIENT_SECRET` doubles as the webhook signing secret.
4. **Secrets** (run for **both envs**):
   ```bash
   wrangler secret put TIKTOK_CLIENT_KEY --env <env>
   wrangler secret put TIKTOK_CLIENT_SECRET --env <env>
   wrangler secret put TIKTOK_REDIRECT_URI --env <env>
   ```
5. **Flag flip**:
   ```bash
   echo "true" | wrangler secret put ENABLE_TIKTOK_PUBLISH --env <env>
   echo "true" | wrangler secret put ENABLE_TIKTOK_INGEST --env <env>
   ```
6. **Smoke**: connect → caller passes `platformMetadata.video_url` (publicly fetchable URL) → TikTok pulls video via `PULL_FROM_URL` source → in-app approval by the user (TikTok requires this for compliance) → comment ingest via signed webhook → reply.

## Rolling back a launch (panic-flag)

If a flipped flag is causing customer impact, immediately revert:

```bash
echo "false" | wrangler secret put ENABLE_<X>_<Y> --env production
```

No redeploy required — the worker reads vars/secrets on every request. OAuth flows for that platform instantly start returning 503 FEATURE_DISABLED; webhook ingest instantly starts returning 200-ignored; cron skips that platform.

Existing `social_account_tokens` rows are **NOT** touched. The next flag-on will reactivate everything where it left off.

To force a hard revoke (e.g., suspected token compromise):

```sql
UPDATE social_account_tokens SET status = 'revoked' WHERE platform = '<x>';
```

then delete the corresponding KV ciphertext (`social_token:<brand>:<platform>:<external_account_id>`).

## Token encryption

Tokens are stored encrypted-at-rest in KV using AES-GCM with a key derived per-brand via `HKDF(TOKEN_ENCRYPTION_KEY, brand_id, "social_account_tokens")`. D1 holds only metadata (platform, scopes, expiry, `token_kv_key`).

### Rotating `TOKEN_ENCRYPTION_KEY`

The KV ciphertexts are unreadable after rotation, so rotation requires a brief dual-read window OR forcing all customers to re-connect.

**Force re-connect approach** (simpler, recommended unless you have active customers):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" \
  | wrangler secret put TOKEN_ENCRYPTION_KEY --env <env>
# Now all existing tokens become unreadable. Mark them:
wrangler d1 execute mustbeviral --remote --command \
  "UPDATE social_account_tokens SET status='revoked', updated_at=CURRENT_TIMESTAMP"
# Customers re-connect via /app/brands/<id>/connections
```

**Dual-read approach** (preserves existing connections; future work):

1. Write a new secret `TOKEN_ENCRYPTION_KEY_NEXT` alongside the existing `TOKEN_ENCRYPTION_KEY`.
2. Extend `services/platforms/token-storage.ts` to try `_NEXT` first, fall back to legacy.
3. Run a backfill that re-encrypts every active token under `_NEXT`.
4. Promote `_NEXT` to `TOKEN_ENCRYPTION_KEY` (paste same value, delete `_NEXT`).
5. Remove fallback code.

Not implemented today. Scope it as a separate run when a real rotation is needed.

## Monitoring per platform

`wrangler tail mustbeviral-production --format json | jq 'select(.message | tostring | contains("[cron]") or contains("platform."))'` shows:

- `[cron] all platform flags disabled — exiting early` — every 5 min while everything is off (expected).
- `[cron] pollXMentions failed for account=<id> reason=<code>` — X mention poll error.
- `platform.<x>.publish.success` / `platform.<x>.publish.failed` — workflow publish results.
- `platform.<x>.connected` / `platform.<x>.reply.<status>` — OAuth + reply audit events.

After M-16 observability lands, these should be wired into Sentry alert rules:

- `platform.<x>.publish.failed` with `errorCode !== "rate_limited"` → on-call channel
- Token decryption failures (`TokenStorageError code=decrypt_failed`) → security channel
- 5xx from any adapter (parsed from `errorMessage`) → on-call

## Known platform-specific gotchas

| Platform | Gotcha |
|---|---|
| LinkedIn | `r_organization_social` is restricted to Marketing Developer Platform. Personal accounts will get an empty `organizations` list — that's fine, member-URN posting still works via `w_member_social`. |
| X | Free-tier app-wide writes are ~1,500/mo. With 10 connected brands and even modest cadence you'll hit this fast. Upgrade to Basic ($200/mo) at launch. Re-rate-limit is documented in `services/platforms/x.ts` at 50 tweets / 24h per account as a Free-tier-safe floor. |
| Meta IG | IG publish requires a publicly fetchable image URL. R2 buckets with presigned URLs work; private buckets do not. The 2-step container API has a TTL — publish step must run within ~24h of container creation. |
| Meta IG | IG Business accounts must be linked to a Facebook Page. Personal IG accounts can't publish via the API. |
| TikTok | All TikTok publishes go to the user's Inbox; the user must confirm in-app before the post goes live. This is a TikTok policy; not something we can bypass. |
| TikTok | TikTok's webhook signature format is `HMAC_SHA256(client_secret, timestamp + "\n" + body)`. Note the `\n` separator — easy to miss when re-implementing. |
| All | The cron handler exits early when all flags are `"false"`, so the deploy is essentially zero-cost when nothing is launched. |

## Final-mile launch checklist

When you're ready to actually launch a platform to customers:

1. Re-run the full local gate.
2. Re-run the staging smoke against a real test account.
3. Deploy production from `master` (already done in Run 21 for the code shell).
4. Set the platform-specific secrets on production via `wrangler secret put`.
5. Register the production webhook URL on the platform's developer portal (Meta/LinkedIn/TikTok only — X has no webhook).
6. Flip the two flags from `"false"` to `"true"` via `wrangler secret put`.
7. Verify via `curl /api/health` and a manual end-to-end test through the UI.
8. Watch `wrangler tail` for 30 minutes.
9. Announce.
