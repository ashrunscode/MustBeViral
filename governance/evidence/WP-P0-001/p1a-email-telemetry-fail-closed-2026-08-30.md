# P1a email and telemetry fail-closed evidence — 2026-08-30

Work packet: WP-P1A-001 / p1a-003-transactional-email-and-telemetry  
Recorded under WP-P0-001 until operator activates WP-P1A-001 evidence paths.

No secret values, signed URLs, or customer media are recorded.

## Acceptance criterion

Missing Resend or Sentry configuration fails closed; successful paths never persist secrets, signed URLs, or customer media in logs or fixtures.

## Resend transactional email (Core)

| Behavior                                         | Implementation                                | Automated proof                                                             |
| ------------------------------------------------ | --------------------------------------------- | --------------------------------------------------------------------------- |
| Missing `RESEND_API_KEY` / `RESEND_FROM_ADDRESS` | `createCoreEmailPort` returns `disabled`      | `apps/core/test/unit/core-email.test.ts`                                    |
| Wallet-credit operator notification              | Stripe webhook settlement via `core-email.ts` | `apps/core/test/unit/stripe-webhook-settlement.test.ts`                     |
| Auth delivery path                               | Supabase Auth SMTP (operator provisioning)    | Browser surfaces in `apps/web/app/verify-email`, `forgot-password`, `login` |

Operator-only: configure Supabase Auth SMTP to Resend (`smtp.resend.com`, user `resend`, API key in operator secret store). Documented in `p1a-implementation-progress-2026-08-30.md`.

## Sentry / OTel telemetry

| Behavior                    | Implementation                                                    | Automated proof                                   |
| --------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| Missing DSN / OTLP endpoint | `bootstrapTelemetry` → `{ sentry: 'disabled', otel: 'disabled' }` | `packages/telemetry/src/index.test.ts`            |
| Credentials present         | `{ sentry: 'ready', otel: 'ready' }`                              | `packages/telemetry/src/index.test.ts`            |
| Attribute redaction         | `sanitizeTelemetryAttributes` redacts `authorization`             | `packages/telemetry/src/index.test.ts`            |
| Core wiring                 | `createCoreObservability` fail-closes capture                     | `apps/core/src/composition/core-observability.ts` |
| Web Vitals (browser)        | `web-vitals-reporter.tsx` + pluggable reporter                    | `apps/web/src/lib/telemetry/web-vitals.test.ts`   |

Telemetry is **not** business-state authority. Exception capture in Core never blocks webhook or REST handling.

## Status

Automated fail-closed paths: **proven in tree (uncommitted)**.  
Live Sentry/OTel sink attachment in production: **pending** authorized deploy (see `p1a-production-deploy-rollback-stub-2026-08-30.md`).
