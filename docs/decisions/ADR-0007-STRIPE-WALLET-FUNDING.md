---
doc_id: adr-0007-stripe-wallet-funding
---

# ADR-0007: Fund the prepaid usage wallet only from explicit Stripe top-ups

## Status

Accepted on 2026-09-16 by owner decision, recorded in issue #20. The shared Stripe customer decision below was accepted by the owner on the same day.

## Decision

Only an explicit wallet top-up funds the prepaid usage wallet. A top-up is a Stripe Checkout Session in `payment` mode that MustBeViral creates with `metadata.purpose = "wallet_top_up"`, with the workspace id in both `client_reference_id` and `metadata.workspace_id`.

- Core credits a top-up on `checkout.session.completed` when `payment_status` is `paid`, or on `checkout.session.async_payment_succeeded` for delayed payment methods. A completed session that is `unpaid` or `no_payment_required` is not credited.
- The credit is integer USD micros from `amount_total`, and only a `usd` session can be credited. Stripe reports `currency` and `amount_total` in the integration currency even when Adaptive Pricing lets the customer pay in a local currency.
- The credit is keyed on the Checkout Session id, so every event and redelivery for one session settles into one credit. Stripe may change id prefixes and lengths, so the id is checked by character set (`A-Z`, `a-z`, `0-9`, `_`) and a maximum of 216 characters, which is what fits the ledger's 240-character causative key.
- The $500 setup fee and the $149 monthly subscription never fund the wallet. They update billing state through `customer.subscription.*`. `invoice.paid` never credits the wallet.
- A marked top-up that Stripe reports as paid but that cannot be credited exactly fails settlement instead of being acknowledged. That covers an async success without a paid status, a missing workspace id, a workspace field that is present but not a workspace id, two different workspace ids, a currency other than `usd`, an invalid amount, and an invalid or over-long Checkout Session id. Core logs the reason, and the operator runbook in `deploy-rollback-incidents` describes the repair.

A Stripe customer may be shared across several workspaces. `workspace_billing_profiles.stripe_customer_id` stays non-unique. Because a customer does not identify a workspace, every settled Stripe event names its workspace itself: top-up sessions through `client_reference_id` and `metadata.workspace_id`, subscriptions through `subscription_data.metadata.workspace_id`. A customer-only lookup that matches more than one billing profile is refused with `STRIPE_CUSTOMER_AMBIGUOUS`, and a wallet credit never uses a customer lookup. A top-up copies its customer id onto a billing profile only when the profile has none, so it never re-points an existing mapping.

## Rationale

P1a pilot pricing lists the setup fee, the monthly subscription and the prepaid usage wallet as separate components. Crediting every Stripe payment turned platform fees into usage credit. It also credited one payment twice: a subscription-mode Checkout Session emits `checkout.session.completed` and, for its first invoice, `invoice.paid`, and each credit was keyed on its own event id. Stripe does not guarantee event order and can send separate Event objects for one object, so a credit keyed on the paid object is the only key that survives both. A dedicated top-up marker keeps the rule independent of how setup and subscription payments are sold.

## Consequences

- `packages/billing` plans a wallet credit only for a paid top-up session. `apps/core` passes the Checkout Session id and workspace id to `apply_stripe_wallet_top_up`, and fails a paid top-up it cannot credit, so no receipt is written and Stripe retries.
- `apply_stripe_wallet_top_up` accepts only the two Checkout Session event types, requires a workspace id, and keys the credit, the replay check and the delivery lock on the Checkout Session.
- The event-keyed `apply_stripe_wallet_credit` keeps its signature and grants but refuses every call. Left callable, a Core Worker rolled back past this change would credit a top-up a second time under its event key and credit subscription payments again. Rolling Core back therefore delays wallet credits, which Stripe retries, instead of duplicating them. A later migration drops the function once this Worker runs in every environment. Credits already written under the event key are not re-keyed.
- Deploy this Worker before any code creates top-up Checkout Sessions.
- The Stripe webhook endpoint needs `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted`. `invoice.paid` is not needed for wallet funding.
- A rejected paid top-up fails every Stripe retry, because Stripe resends the same payload, and writes no receipt. Until rejections are recorded durably, operators find them in Core's `core.stripe_webhook.wallet_top_up_rejected` log and the Stripe dashboard's failed deliveries.
- If tax is ever collected on top-ups, decide whether the credit excludes it before enabling tax; the credit is `amount_total` today.
- Refunds and disputes of a top-up do not debit the wallet yet.
