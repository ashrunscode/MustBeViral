# Final Billing Strategy

## Billing Model

Stripe is the billing system. MustBeViral stores workspace subscription state in D1 and reconciles from Stripe webhooks.

Plans:
- Starter: 1 brand, manual export, limited posts/images.
- Growth: 3 brands, higher usage, DM rules, scheduler integrations when verified.
- Agency: 10 brands, advanced admin and approval workflows.
- Managed: high-touch plan with expanded brand/usage limits.

## Required Implementation

- `plans.ts` as the source of truth.
- Checkout session route.
- Customer portal route.
- Raw-body webhook with signature verification.
- `webhooks_inbox` duplicate protection.
- `usage_events` and plan enforcement at server boundaries.

No real charges are created during this build pass.
