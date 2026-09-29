# P1a production deploy / rollback evidence stub — 2026-08-30

Work packet: WP-P1A-001 / p1a-005-production-deploy-rollback-and-vitals  
Recorded under WP-P0-001 until operator commits and activates WP-P1A-001 evidence paths.

No secret values, signed URLs, customer media, or live production mutations are recorded here.

## Status

**Pending operator authorization.** Kill switches remain `signups_enabled=false` and `charging_enabled=false` until go/no-go.

## Target resource IDs (fill before any live deploy)

| Surface                | Identifier                           | Rollback pointer                               | Status  |
| ---------------------- | ------------------------------------ | ---------------------------------------------- | ------- |
| Vercel production web  | _TBD — project name + deployment ID_ | _Previous production deployment ID_            | pending |
| Cloudflare Core Worker | _TBD — worker name + version ID_     | _Previous 100% version ID_                     | pending |
| Supabase production    | _TBD — project ref_                  | _Migration rollback note / prior snapshot ref_ | pending |
| Private R2 bucket      | _TBD — bucket name only_             | _Disable writes; no object keys recorded_      | pending |

## Staging references (sanitized, from P0)

These are **not** production promotion evidence. They anchor rollback vocabulary only.

- Staging Vercel deployment: `dpl_EFVgRCdcWm3DkrVBL8usUQgidkMN` (2026-08-30 buyer-journey proof)
- Staging Core Worker: `mustbeviral-v2-staging-core`, version `246b5df9-bbcd-48cb-b90c-a050db73f208`
- Prior staging rollback example: `governance/evidence/WP-P0-001/staging-recovery-deploy-2026-08-26.md`

## Pre-deploy checklist (operator)

1. Record exact production IDs in this file (or `governance/evidence/WP-P1A-001/` after packet activation).
2. Confirm Stripe remains **test mode** until commercial go/no-go.
3. Confirm Resend auth SMTP provisioned in Supabase (see `p1a-implementation-progress-2026-08-30.md`).
4. Deploy Core Worker → verify `GET /health` → deploy Vercel from monorepo root with lockfile.
5. Attach Web Vitals production-segment reporter per `web-vitals-measurement-path.md`.
6. Capture rollback command outputs (Wrangler/Vercel/Supabase) without secrets.

## Rollback strategy

Revert to prior deployment IDs listed above. Disable charging and signup kill switches if settlement misbehaves. Do not destroy remote resources without separate authorization.
