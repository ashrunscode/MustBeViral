# WP-P1A-001 implementation progress — 2026-08-30

Sanitized operator notes for the P1a successor handoff. No secret values, signed URLs, or customer media.

## Completed in tree (uncommitted)

### Stripe wallet settlement (prior agent)

- `apply_stripe_wallet_credit` and `apply_stripe_subscription_update` RPCs with idempotent replay.
- Core webhook settlement wired through `stripe-webhook-settlement.ts`.
- Database invariant tests under `supabase/tests/database/00029_p1a_stripe_wallet_credit.test.sql`.

### Core transactional email port

- `createCoreEmailPort` fail-closes without `RESEND_API_KEY` / `RESEND_FROM_ADDRESS`.
- Wallet-credit operator notification sent from Stripe webhook settlement when `operatorEmail` is supplied.
- Unit coverage in `apps/core/test/unit/core-email.test.ts`.

### Kill-switch enforcement

- Platform kill switches flow into billing entitlements via `createBillingEntitlementsPort`.
- `start_run` now blocks on `provider_routes_disabled` through shared entitlement evaluation.
- `quote_run` continues to block on `generation_disabled` and paid-prerequisite reasons.

### Auth email surfaces (browser)

- Verify-email, forgot-password, reset-password, and login notice states cover verification required, recovery sent, expired link, and rate-limited paths.
- Supabase Auth remains the delivery path for signup verification and password recovery; Resend SMTP is an operator provisioning step (see below).

### Windows verify toolchain

- Governance scripts resolve nested `pnpm` through `corepack pnpm` when `pnpm.cmd` is absent from PATH.
- Root `verify` / `governance:check` chains use `npm run` for nested script invocation.

## Operator-only (not in repo)

### Resend auth SMTP

Configure the staging/production Supabase project Auth SMTP settings to use Resend:

- Host: `smtp.resend.com`
- Port: `465` (SSL) or `587` (STARTTLS)
- Username: `resend`
- Password: Resend API key (operator secret store only)
- Sender identity: product-owned domain aligned with `RESEND_FROM_ADDRESS`

Until SMTP is configured, auth email actions fail closed at Supabase and browser surfaces show honest recovery/verification notices without exposing account existence.

### Production deploy evidence

Record sanitized target IDs and rollback pointers before any live mutation:

- Vercel production project + deployment ID
- Cloudflare Core Worker name + version ID
- Supabase production project ref
- Private R2 bucket name (no object keys with customer media)

Kill switches must remain `signups_enabled=false` and `charging_enabled=false` until operator go/no-go.

## Next implementable slice

1. Operator commit of finish-sprint + P1a tree, then `pnpm agent:finish --successor governance/evidence/WP-P0-001/successor-WP-P1A-001.yaml`.
2. ~~Billing usage UI acceptance tests for funded / low-balance / blocked states.~~ **Done (2026-08-30 follow-up):** `BILLING_ACCEPTANCE_FIXTURES` + expanded `billing-usage-panel.test.tsx` covering funded, low_balance, blocked, receipt_detail, refund_release; Lightfield wallet/subscription badges in billing panel.
3. ~~Sentry/OTel fail-closed wiring evidence.~~ **Done:** `p1a-email-telemetry-fail-closed-2026-08-30.md`.
4. ~~Production deploy/rollback dry-run evidence stub with exact resource IDs.~~ **Stub done:** `p1a-production-deploy-rollback-stub-2026-08-30.md` (TBD IDs until operator authorization).

## Evidence added (2026-08-30 follow-up)

- `governance/evidence/WP-P0-001/p1a-production-deploy-rollback-stub-2026-08-30.md`
- `governance/evidence/WP-P0-001/p1a-email-telemetry-fail-closed-2026-08-30.md`
