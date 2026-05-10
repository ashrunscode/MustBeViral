# 13 — Billing / Stripe Audit

## Stripe configuration

`Env` declares secrets:

```ts
STRIPE_SECRET_KEY: string;
STRIPE_WEBHOOK_SECRET: string;
STRIPE_PRICE_STARTER?: string;
STRIPE_PRICE_GROWTH?: string;
STRIPE_PRICE_AGENCY?: string;
STRIPE_PRICE_MANAGED?: string;
```

**No Stripe SDK is bundled.** `routes/billing.ts` calls Stripe via `fetch` directly:

```ts
const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
  method: "POST",
  headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({...}),
});
return response.json<Record<string, unknown>>();
```

Pros:
* ✅ Lightweight (no Node-incompatible Stripe SDK in Workers)
* ✅ Direct REST call

Cons:
* ⚠️ No error handling: if Stripe returns 4xx/5xx, the route returns Stripe's body inside `successEnvelope` with HTTP 200 (success). Callers would have to inspect `data.error.type` or `data.id` to know the truth
* ⚠️ No retry / idempotency-key on Stripe API calls (Stripe supports `Idempotency-Key` header to prevent duplicate charges; not used)
* ⚠️ Empty `customer_email` / `metadata.user_id` not propagated; metadata only includes `workspace_id`, `plan`

## Checkout flow (`routes/billing.ts:36-69`)

| Step | Code | Verdict |
|---|---|---|
| Validate plan via Zod | ✅ | Schema accepts `starter|growth|agency|managed` |
| Resolve `priceId` from env | ✅ `priceForPlan(env, plan)` | Defaults to `STRIPE_PRICE_STARTER` |
| Safe-disable when keys missing | ✅ Returns `{configured: false, message: "..."}` | OK |
| Create Stripe checkout session | ✅ | Direct REST POST |
| Log usage event `'billing.checkout_created'` | ✅ | Stored in `usage_events` |
| Return checkout session to client | ✅ | Includes session URL/id |

Missing:
* ⚠️ No `customer_email` from authenticated user passed to Stripe → harder to map customer back later
* ⚠️ No `client_reference_id` set to `workspace_id` → Stripe webhook handler must rely on metadata (which IS set, but a duplicate channel would be defensive)
* ⚠️ `success_url` and `cancel_url` are static (`/billing?checkout=success`); no per-workspace branding

## Portal flow (`routes/billing.ts:71-93`)

| Step | Code | Verdict |
|---|---|---|
| Read `subscriptions.stripe_customer_id` | ✅ | OK |
| Safe-disable if customer missing | ✅ | OK |
| Create Stripe portal session | ✅ | Direct REST POST |

Missing: nothing to add until billing event handlers exist.

## Webhook (`routes/webhooks.ts:13-45`)

Verified in 07_AUTH_RBAC_SECURITY_AUDIT.md. Highlights:

* ✅ Raw body via `c.req.raw.clone().text()`
* ✅ Signature verification (`services/stripe/signature.ts`) — HMAC-SHA-256, 300s tolerance, timing-safe
* ✅ Idempotency via `INSERT OR IGNORE INTO webhooks_inbox`
* ✅ 501 if `STRIPE_WEBHOOK_SECRET` missing (signal: "not configured")
* ✅ 400 if signature invalid

**Critical missing piece:** No event handling. The webhook only inserts the payload; it does not:

* Update `subscriptions.stripe_customer_id` from `checkout.session.completed.customer`
* Update `subscriptions.stripe_subscription_id` from `customer.subscription.created.id`
* Advance `subscriptions.status` (`incomplete → trialing → active`) on `customer.subscription.updated`
* Set `subscriptions.current_period_end` from event payload
* Mark `subscriptions.status='past_due'` on `invoice.payment_failed`
* Mark `subscriptions.status='canceled'` on `customer.subscription.deleted`

Result: Even if a real Stripe customer subscribes, MustBeViral's `subscriptions.status` stays `'incomplete'` forever, and `stripe_customer_id`/`stripe_subscription_id` stay NULL. The portal route then falls into the safe-disable branch (because `stripe_customer_id` is missing), creating a deadlock.

## Subscription seeding

`routes/workspaces.ts:87-92`:

```ts
await dbRun(db,
  `INSERT INTO subscriptions (id, workspace_id, plan, status, metadata_json)
   VALUES (?, ?, 'starter', 'incomplete', ?)`,
  [createId("sub"), workspaceId, toJson({ source: "workspace_create" })]);
```

✅ Workspace creation seeds a `subscriptions` row with `plan='starter'`, `status='incomplete'`. UNIQUE(workspace_id) prevents duplicates.

## Plan enforcement

`subscriptions.plan` is **never read** for entitlement checks. There is no code path that:

* Caps the number of brands per workspace based on plan
* Caps content_posts per month based on plan
* Caps AI usage based on plan
* Restricts MCP / admin / advanced features by plan

## Tests

* `tests/unit/auth-security.test.ts` covers Stripe webhook signature verification (happy path + tampered signature)
* No tests cover checkout creation, portal creation, webhook event handling, or subscription state transitions

## Required fixes

| ID | Severity | Fix |
|---|---|---|
| BIL-1 | Critical | Implement webhook event dispatcher: handle `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`. Update `subscriptions` table accordingly |
| BIL-2 | High | Pass authenticated user's email and workspace_id to Stripe checkout (`customer_email`, `client_reference_id`, `metadata`) |
| BIL-3 | High | Add Stripe API error handling (response.status / response.body) and return error envelopes when Stripe call fails |
| BIL-4 | High | Add `Idempotency-Key` header to Stripe checkout/portal calls (use `idempotency_keys` table) |
| BIL-5 | High | Implement plan-based entitlement enforcement for brand creation, content_posts/mo, AI requests |
| BIL-6 | Medium | Add tests for: webhook event handling (each event type), Stripe error paths, plan enforcement |
| BIL-7 | Medium | Add a `GET /api/billing/:workspaceId/usage` endpoint that aggregates `usage_events` |
| BIL-8 | Medium | Add audit logs to checkout/portal/webhook event processing |
| BIL-9 | Medium | When `subscriptions.status='canceled'` or `past_due`, gate access to paid features |
| BIL-10 | Low | Add tests for `subscriptions` UNIQUE(workspace_id) constraint |
| BIL-11 | Low | Consider using Stripe Customer Portal Configuration API to enable plan switching server-side |
| BIL-12 | Low | Document where Stripe Tax / VAT is handled (currently nowhere) |

## Stripe live charges safety

Codex's claim is that live charges are disabled. Verified:

| Path | Live charges if keys missing? |
|---|---|
| `POST /:workspaceId/checkout` | ❌ Returns `{configured: false}` if `STRIPE_SECRET_KEY` or price ID missing |
| `POST /:workspaceId/portal` | ❌ Returns `{configured: false}` if `STRIPE_SECRET_KEY` or `stripe_customer_id` missing |
| `POST /webhooks/stripe` | Returns 501 if `STRIPE_WEBHOOK_SECRET` missing |

**Stripe live charges are safely disabled in production today** because production secrets have not been configured. ✅

But: the moment secrets are configured, live charges become possible **without** the webhook event handlers existing. The system would accept payments and never advance the subscription state. **Do not configure Stripe production secrets until BIL-1 is implemented.**

## Verdict

| Dimension | Status |
|---|---|
| Checkout creation | ⚠️ Partial (works when configured, no error handling) |
| Customer portal | ⚠️ Partial (deadlock until customer_id is seeded) |
| Webhook signature | ✅ Real |
| Webhook idempotency | ✅ Real |
| Webhook event handling | ❌ **Missing** |
| Subscription state machine | ❌ **Missing** |
| Plan entitlement enforcement | ❌ **Missing** |
| Live charges safely disabled | ✅ Confirmed |
| Stripe SDK / typings | None — direct fetch |
| Tests | Signature only |

The Stripe surface is **shaped correctly** but **functionally incomplete.** The webhook is a logging shell. Subscriptions never advance. Plans don't gate anything. Going live would book payments without delivering value.
