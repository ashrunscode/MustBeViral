# P0 finish-sprint implementable product — 2026-08-30

Work packet: WP-P0-001 / p0-007 through p0-008  
Recorded: 2026-08-30

No secrets, tokens, customer identities, signed URLs, or raw environment values are recorded here.

## Onboarding and last-mile (passed)

- Signed-out landing at `/` names Meta Campaign Launch Pack value and honest closed enrollment.
- Sign-up at `/signup` is closed-enrollment only — no fake account creation form.
- Sign-in, verify-email, forgot-password, unauthorized, not-found, and maintenance surfaces use Lightfield status screens.
- Progressive campaign brief onboarding lives in the Studio brief workflow with packshot attach-only honesty.
- Continue-this-campaign at `/studio/continue` resumes the last browser session step only.
- Operator/internal surface at `/studio/[workspace]/internal` exposes kill-switch and reconciliation copy.

Component and flow tests cover landing, status screens, workflow nav, campaign progress, and brief schema validation.

## Web Vitals instrumentation (passed)

- `web-vitals` listeners register in the root layout for LCP, INP, and CLS.
- Rating thresholds align with Core Web Vitals p75 targets (LCP ≤2.5s, INP ≤200ms, CLS ≤0.1).
- Production-segment measurement path is documented in `web-vitals-measurement-path.md`; production p75 numbers remain pending authorized P1a deploy.

## Landed-cost instrumentation (passed)

- `computePackLandedCost` sums immutable provider, storage, execution, and artifact evidence in integer USD micros when observable.
- Catalog charge 4,550,000 micros is returned separately as customer price, not landed cost.
- P1a margin guardrail constant 1,820,000 micros ($1.82) is enforced in billing helpers.

## P1a groundwork started (successor scope)

The following P1a items were implemented in-repo but remain under WP-P1A-001 until successor activation:

- Supabase migration for kill switches, Stripe webhook dedup table, and workspace billing profiles.
- Privileged RPCs `get_platform_kill_switches` and `record_stripe_webhook_event`.
- Core `POST /webhooks/stripe` with signature verification and durable dedup ack.
- Stripe wallet credit planning helpers and billing UI states (funded, low-balance, blocked, closed).
- Fail-closed `@mustbeviral/email` (Resend) and expanded `@mustbeviral/telemetry` (Sentry/OTel bootstrap).

Live Stripe settlement, Resend SMTP provisioning, and production deploy evidence remain human-only.

## P1a session delta (2026-08-30, finish-sprint follow-up)

- `settleStripeWebhookEvent` handles wallet credit, subscription updates, and ignored events beyond `planStripeWalletCredit`.
- Core `billing.get` merges platform kill switches and workspace billing profiles into entitlements for quote/start_run gates.
- Resend adapter wired via `createCoreEmailPort` and optional Stripe webhook side effects.
- Handler integration tests cover generation-disabled quote blocks and paid insufficient-wallet start blocks.
- Billing UI wallet states polished with accessible labels and status roles.
- Migration grants `service_role` execute on `get_platform_kill_switches` for Core entitlement reads.

## P1a wallet persistence delta (2026-08-30, WP-P1A-001 follow-up)

- Supabase RPC `apply_stripe_wallet_credit` credits integer USD micros through `record_ledger_movement` with causative key `stripe:{event_id}` and updates `workspace_billing_profiles.wallet_balance_micros`; duplicate event ids replay without double credit.
- Supabase RPC `apply_stripe_subscription_update` persists subscription status and setup-fee paid state with stripe-event idempotency via audit ledger.
- Core `createStripeWebhookSettlementHandler` calls both RPCs after dedup ack; webhook route reports `persisted` in the success envelope.
- Database invariant suite `00029_p1a_stripe_wallet_settlement.test.sql` and Core/billing unit tests cover wallet credit replay and subscription replay.

## Verification

Focused unit tests pass for billing landed-cost, stripe webhook route/dedup/settlement planning, web vitals, signed-out surfaces, billing UI states, telemetry bootstrap, email fail-closed adapter, and platform kill-switch RPC mapping.

Implementation references (not packet evidence paths):

- Web Vitals: `apps/web/src/lib/telemetry/web-vitals.ts`, `apps/web/src/components/web-vitals-reporter.tsx`
- Landed cost: `packages/billing/src/landed-cost.ts`, `packages/billing/src/landed-cost.test.ts`
- Onboarding surfaces: `apps/web/src/components/landing-page.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/studio/continue/page.tsx`, `apps/web/src/components/signed-out-surfaces.test.tsx`

Full `pnpm agent:verify` requires a committed tree and pnpm on PATH in nested script invocations.
