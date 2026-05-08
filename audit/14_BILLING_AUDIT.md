# 14_BILLING_AUDIT.md

## Billing Status

Spec defines plans and pricing in `PRODUCT_DNA.md`; cost ceilings in `COST_MODEL.md`; secret in `DEPLOYMENT_RUNBOOK.md`. **No code, no Stripe price IDs mapped, no webhook handler.**

## Stripe Integration Status

| Concern | Status | Required |
|---|---|---|
| Stripe SDK setup for Workers | n/a | Use `stripe` v12+ with `Stripe.createFetchHttpClient()`; no Node http |
| Customer creation on signup | not spec'd | Create Stripe customer once per workspace; store `subscriptions.stripe_customer_id` |
| Checkout session route | missing | `POST /api/billing/checkout-session` returns Stripe URL |
| Customer portal route | missing | `POST /api/billing/portal` returns Stripe portal URL |
| Webhook route | missing | `POST /api/webhooks/stripe` with raw-body signature verification |
| Webhook idempotency | missing | `webhooks_inbox` table inserts on first receipt; rejects duplicates |
| Subscription status in app | schema only | Read `subscriptions.status` to gate features |
| Trial logic | not spec'd | Decide: 14-day trial vs no trial; codify in plan config |
| Invoicing / tax | not spec'd | Stripe Tax handles automatically — enable in dashboard |
| Failed payment handling | not spec'd | `past_due` status: degrade to read-only, send email, allow grace period |
| Plan upgrade/downgrade | not spec'd | Standard Stripe Subscription Update; reconcile via webhook |

## Plan Enforcement Gaps

`PRODUCT_DNA.md` plan limits + `COST_MODEL.md` cost ceilings need a single source of truth in code:

```ts
// src/server/services/billing/plans.ts
export const PLANS = {
  starter: {
    stripePriceId: env.STRIPE_PRICE_STARTER,
    maxBrands: 1,
    monthlyPosts: 30,
    monthlyImages: 50,
    schedulerProviders: ["manual"],
    weeklyReport: true,
    dmAutomation: false,
    autonomyMax: 60,
  },
  growth: { stripePriceId: ..., maxBrands: 3, monthlyPosts: 100, monthlyImages: 200, schedulerProviders: ["manual","vista_social","buffer"], dmAutomation: true, autonomyMax: 80, weeklyReport: true },
  agency: { stripePriceId: ..., maxBrands: 10, monthlyPosts: 500, monthlyImages: 1000, schedulerProviders: ["manual","vista_social","buffer"], dmAutomation: true, autonomyMax: 89, weeklyReport: true, whiteLabelReports: true },
  managed: { stripePriceId: ..., maxBrands: 50, monthlyPosts: 5000, monthlyImages: 10000, schedulerProviders: ["manual","vista_social","buffer"], dmAutomation: true, autonomyMax: 89, weeklyReport: true, whiteLabelReports: true, manualSupport: true },
};
```

Enforcement points:

| Action | Check |
|---|---|
| Create brand | `count(brands WHERE workspace_id=...) < plan.maxBrands` |
| Generate calendar | `usage_events.posts MTD < plan.monthlyPosts` |
| Generate image | `usage_events.images MTD < plan.monthlyImages` |
| Connect scheduler provider | `provider in plan.schedulerProviders` |
| Toggle DM automation | `plan.dmAutomation === true` |
| Set autonomy slider above plan max | reject |
| Weekly report runs | always allowed (cost is small) |

## Usage Limit Gaps

Without enforcement, plan limits are theatrical. Specifically:

- The `usage_events` table is the only source of truth for MTD usage. Make it append-only with strict schema.
- A nightly job aggregates usage per workspace and writes to KV `usage:summary:{workspaceId}:{yyyy-mm}` for fast reads.
- `costGuard` middleware reads from KV first, falls back to D1 aggregate.
- The UI shows a `CostBudgetMeter` per page where actions consume budget.

## Webhook Risks

| Risk | Fix |
|---|---|
| Forged webhook → free upgrade | Verify signature with `stripe.webhooks.constructEvent(rawBody, signature, secret)` |
| Replay attacks | Reject events older than 5 minutes via `event.created` timestamp |
| Duplicate processing | `webhooks_inbox UNIQUE(provider, external_event_id)` ensures each event handled once |
| Hono pre-parses JSON | Bypass JSON middleware for `/api/webhooks/stripe`; read `c.req.raw` |
| Out-of-order events | Always re-fetch the subscription from Stripe API after handling, to converge to current state |
| Missing webhook events | Handle: `customer.subscription.created/updated/deleted`, `invoice.payment_succeeded/failed`, `checkout.session.completed` |

## Required Billing Plan

1. Create `src/server/services/billing/plans.ts` with the plan map above.
2. Create Stripe Products + Prices in dashboard; capture price IDs as env vars (`STRIPE_PRICE_STARTER`, etc.).
3. `POST /api/billing/checkout-session` — auth required; creates Stripe Customer if missing; creates Checkout Session with `success_url=PUBLIC_APP_URL/billing/success&cancel_url=PUBLIC_APP_URL/billing/cancel`.
4. `POST /api/billing/portal` — auth required; creates Billing Portal session.
5. `POST /api/webhooks/stripe`:
   - Read raw body via `await c.req.raw.clone().text()`.
   - Verify signature.
   - Insert into `webhooks_inbox` (UNIQUE on `provider, external_event_id` rejects duplicates).
   - Update `subscriptions` row by `stripe_subscription_id`.
   - Audit log the change.
6. Add `requireActiveSubscription()` middleware that reads `subscriptions.status IN ('active','trialing')`. For non-active, return 451 with a checkout URL.
7. Add `enforcePlanLimit(env, workspaceId, kind, units)` helper used inside cost-guard middleware and at the boundaries of expensive actions.
8. UI: `/app/admin/billing` for admins; `Settings → Billing` for workspace owners with portal redirect.
9. UI: `CostBudgetMeter` component showing MTD usage for posts/images; warning at 80%.
10. Tests: a webhook fixture set including `checkout.session.completed`, `customer.subscription.updated`, `invoice.payment_failed`. Verify subscription state converges. Verify duplicate replays are no-ops.
