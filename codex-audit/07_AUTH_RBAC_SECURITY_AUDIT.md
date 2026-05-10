# 07 — Auth / RBAC / Security Audit

## Passwords (`src/server/services/auth/password.ts`)

| Concern | Code | Verdict |
|---|---|---|
| Algorithm | PBKDF2 with `hash: "SHA-512"` | ✅ Strong choice for WebCrypto-only (Workers) |
| Iterations | `defaultIterations = 100_000` | ✅ Workers-compatible (Codex's 120k attempt was rejected by the runtime; documented in DECISIONS_LOG 2026-05-08) |
| Salt | 16 bytes (`saltBytes = 16`), `crypto.getRandomValues` | ✅ |
| Hash size | 64 bytes (`hashBytes = 64`) | ✅ |
| Encoding | base64 | ✅ |
| Storage format | `pbkdf2-sha512$<iterations>$<base64-salt>$<base64-hash>` | ✅ Self-describing, future-proof for parameter migration |
| Verification | `derive` then `constantTimeEqual` over Uint8Arrays | ✅ Timing-safe |
| Strength validation | `validatePasswordStrength`: ≥12 chars, ≤128, requires lower/upper/digit | ✅ Reasonable; **does not** require special character |
| Per-user pepper | Not used | Acceptable (kept simple); consider per-deploy `SESSION_SECRET` mixin |

**OWASP/NIST compliance:** PBKDF2-SHA512 at 100k is below NIST SP 800-63B's recommended 600k for SHA-256 PBKDF2 but Workers can't go above 100k. Acceptable Workers-imposed compromise; should be documented as a known limitation.

## Sessions (`src/server/services/auth/session.ts`)

| Concern | Code | Verdict |
|---|---|---|
| Token format | 32 random bytes hex (64 chars) | ✅ ~256 bits of entropy |
| Server-side storage | `sessions` table; **only `hashed_token`** stored (SHA-256 of token) | ✅ Token cannot be recovered from DB compromise |
| Cookie name | `mbv_session` | ✅ |
| Cookie attributes | `httpOnly: true, secure: APP_ENV !== "development", sameSite: "Lax", path: "/", maxAge: 30d` | ✅ Lax matches the spec's expectations; `Strict` could be tighter but breaks OAuth callbacks (Phase 2) |
| Bearer token fallback | `readBearerToken(c.req.header("Authorization"))` | ✅ Useful for API clients, but **bearer tokens are the same un-hashed session token**; clients must protect them |
| Session validation | DB lookup by `hashed_token`, expiry check, revocation check, user soft-delete check; updates `last_active_at` | ✅ |
| Session revocation on logout | `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP` | ✅ |
| Session rotation on login | **Not implemented.** `createSession` always inserts a new row; no `revoked_at` update on prior sessions | ⚠️ Sessions stack indefinitely until expiry |
| Concurrent device sessions | Implicitly allowed | OK |
| `sessions.rotated_at` column | Unused | Cosmetic; remove or wire |

## RBAC (`src/server/middleware/{auth,rbac}.ts`, `src/server/services/access.ts`)

| Concern | Code | Verdict |
|---|---|---|
| `requireAuth()` | Reads cookie/bearer, validates session, sets `c.set("auth", auth)` | ✅ |
| `requireAdmin()` | Checks `auth.role === 'admin'` | ✅ But: **no admin user provisioning route exists.** Bootstrapping the first admin requires direct D1 SQL (`UPDATE users SET role='admin' WHERE email=?`) |
| `requireWorkspaceMember()` | Pulls workspaceId from URL param OR `X-Workspace-Id` header; calls `getWorkspaceMembership` | ⚠️ Header fallback could allow scope manipulation if any internal route incorrectly reads from header without trust boundaries; in practice all routes use URL param |
| `requireBrandAccess()` | Pulls brandId from URL param OR `X-Brand-Id` header; calls `getBrandAccess` (joins through workspace_members) | ✅ Brand isolation enforced through the workspace-members table |
| Tenant isolation | Every workspace/brand query filters by user's membership | ✅ |
| Cross-tenant leakage check | Routes scope queries to `workspaceId`/`brandId` from middleware-set context, never from request body | ✅ |

## SSRF (`src/server/services/security/ssrf.ts`)

| Blocked range | Detail |
|---|---|
| Loopback IPv4 | `127.0.0.0/8` (octet check `first === 127`) ✅ |
| `0.0.0.0/8` | ✅ |
| RFC1918 | `10/8`, `172.16-31`, `192.168/16` ✅ |
| Link-local | `169.254/16` (incl. AWS metadata) ✅ |
| CGNAT | `100.64-127.x` ✅ |
| Test/benchmark | `198.18-19.x` ✅ |
| Multicast | `224.0.0.0/4` (`first >= 224`) ✅ |
| IPv6 loopback / link-local / ULA | `::1`, `::`, `fe80:`, `fc/fd` ✅ |
| Hostnames | `localhost`, `*.localhost`, `metadata`, `metadata.google.internal`, `instance-data`, `169.254.169.254` (literal) ✅ |
| Schemes | `http`, `https` only; userinfo stripped; hash stripped | ✅ |

**Gaps:**

* **DNS rebinding not addressed.** `normalizeScanUrl` checks the parsed hostname (literal IP or DNS name). It does **not** resolve DNS first. A hostile DNS server could resolve `safe.example.com` to `127.0.0.1` between validation and `fetch()`. Cloudflare's runtime does its own resolution; for full safety, add DNS resolution in the SSRF guard or rely on Cloudflare's egress restrictions
* **IPv6 `::ffff:127.0.0.1` (IPv4-mapped IPv6)** is not blocked. The check only handles `::1`, `::`, `fe80:`, `fc/fd`. A IPv4-mapped IPv6 loopback may slip through
* **Redirect target not re-validated.** `fetch(url, { redirect: "follow" })` will follow 3xx redirects to potentially private IPs. SSRF guard only validates the original URL

Severity: Medium — these are real but require the attacker to control DNS or get a 3xx redirect from a domain we accept.

## Prompt injection (`src/server/services/security/prompt-injection.ts`)

5 patterns flagged: ignore-instructions, system-prompt-request, role-claim, tool-exfiltration, instruction-smuggling. Sanitisation:

* Replaces `system:`, `developer:`, `tool:` labels with `untrusted-label:`
* Removes "ignore (all) (previous|prior|above) instructions"
* Truncates at 20,000 chars

✅ Reasonable Phase 1 starter. Will not catch sophisticated multi-language or unicode-homoglyph variants.

## Stripe webhook (`src/server/services/stripe/signature.ts`, `src/server/routes/webhooks.ts`)

| Concern | Code | Verdict |
|---|---|---|
| Raw body | `c.req.raw.clone().text()` | ✅ |
| Header parsing | `t=...,v1=...` parsed; supports multiple v1 signatures | ✅ |
| Timestamp tolerance | 300 seconds | ✅ Stripe-recommended |
| HMAC | SHA-256 via WebCrypto | ✅ |
| Comparison | `constantTimeStringEqual` | ✅ Timing-safe |
| Idempotency | `INSERT OR IGNORE INTO webhooks_inbox` UNIQUE(provider, external_event_id) | ✅ |
| Replay protection | Old timestamps rejected | ✅ |
| Missing-secret behaviour | Returns 501 (not 400) when `STRIPE_WEBHOOK_SECRET` missing | ✅ Intentionally signals "not configured" rather than "bad signature" |
| **Event handling** | **Missing.** Webhook only logs receipt, does not process events | ⚠️ Subscriptions never advance |

## Other security concerns

| Concern | Detail | Severity |
|---|---|---|
| Hono CVEs | npm audit reports 19 advisories at hono ≤4.12.15. Affected paths in this app: `setCookie` for session, `getCookie` for session read, raw-body handling for webhook. Not running `npm audit fix` per BUILD_LOG | **High** |
| react-router CVEs | CSRF in Action processing, XSS via Open Redirects, SSR XSS in ScrollRestoration. Affects the React Router runtime | **High** |
| Vite dev-server CVEs | Path traversal, file read via WebSocket. Dev only | Medium |
| undici CVEs | HTTP smuggling, WebSocket parser overflow, unbounded decompression. Workers don't use undici directly, but Wrangler's local dev does | Medium |
| Rate limiting | Per-account 5-failure lockout for 15 min. **No IP-based throttling.** Could be amplified by username-enum attacks | Medium |
| CSRF | sameSite=Lax + cookie + bearer fallback. POST routes don't use a CSRF token; rely on cookie's same-site for CSRF defence | Medium — acceptable with sameSite=Lax for self-origin POSTs |
| CORS | No CORS middleware. API is single-origin; Worker serves both API and SPA | OK |
| Content Security Policy | None. Worker does not set CSP/HSTS/X-Frame-Options/Permissions-Policy headers | Medium |
| Audit logs | `writeAuditLog` is called on auth events, brand changes, post approvals, scheduler exports. **No audit on login failures**, **no audit on RBAC denials** | Low |
| Secrets in env | `AppSecrets` interface in `env.ts` declares Stripe/Kimi/OpenAI/Anthropic/Vista/Buffer keys; presence of any of these in non-production env vars would be a leak risk. Codex stores them as Wrangler secrets per DECISIONS_LOG | OK |
| Error message leakage | `errorEnvelope("FORBIDDEN", "Brand access is required.", …)` is generic — does not reveal whether brand exists | ✅ Good |
| Password reset | **Not implemented.** No `/auth/forgot-password` or token table | High for production, acceptable for Phase 1 closed beta |
| Email verification | `users.email_verified_at` column exists; never used | Medium |
| Account enumeration via signup | Returns 409 `EMAIL_IN_USE` distinct from 400 errors | Medium — acceptable trade-off for UX, but allows email enumeration |
| Account enumeration via login | Always returns 401 `INVALID_CREDENTIALS` regardless of whether user exists | ✅ Good |

## Critical security issues

1. **Hono CVE backlog (High).** Production Worker uses hono 4.11.1 with at least one known cookie-injection CVE that affects the session path. Patch immediately to ≥4.12.16.
2. **react-router CVEs (High).** Production SSR uses 7.9.6 with known CSRF/XSS in actions, scroll restoration, and open-redirects. Patch to ≥7.13.x (the safe version is on the upgrade path).
3. **No CSP/HSTS headers (Medium).** Worker should set `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `Referrer-Policy` for the SPA response.
4. **Login does not invalidate prior sessions (Medium-Low).** Sessions stack until expiry. Recommended to revoke prior `revoked_at IS NULL` sessions on each successful login (or document multi-device intent).
5. **Stripe webhook event handling missing (High for billing).** Webhook returns success without doing anything with the event. Subscriptions never advance.

## Required security fixes

| ID | Fix | Severity |
|---|---|---|
| SEC-1 | `npm audit fix --force` to patch hono, react-router, vite, undici, lodash. Test typecheck/lint/test/build after | **Critical** |
| SEC-2 | Add CSP/HSTS/X-Frame-Options/Referrer-Policy headers via a `securityHeaders()` middleware in `src/server/index.ts` | High |
| SEC-3 | Implement Stripe event handlers (`checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`) | High |
| SEC-4 | Revoke prior sessions on login | Medium |
| SEC-5 | Add IP-based rate limiting to `/auth/login` and `/auth/signup` via KV | Medium |
| SEC-6 | Validate redirect targets in `website-scan.ts` (re-run SSRF guard on each redirect) | Medium |
| SEC-7 | Block IPv4-mapped IPv6 (`::ffff:0:0/96`) in SSRF guard | Low |
| SEC-8 | Add audit log entries for login failures and RBAC denials | Low |
| SEC-9 | Implement password reset flow when email infra is available | High before opening signup to public |
| SEC-10 | Implement email verification | Medium before opening signup |
| SEC-11 | Document NIST 100k iteration limitation in DECISIONS_LOG | Low |
| SEC-12 | Add admin user provisioning route or seeding script | Medium |
