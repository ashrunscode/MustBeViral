---
doc_id: deploy-rollback-incidents
---

# Deploy, rollback, and incidents

## Promotion model

Changes flow preview → staging → production from protected `main`. CI pins allowed actions by full commit SHA. Production requires approved migrations, all quality gates, a staging smoke test, rollback evidence, environment/secret validation, and explicit deployment approval.

Deployment order for compatible releases:

1. Apply additive Supabase migrations and verify RLS/functions.
2. Deploy Core Worker with compatible contracts and disabled new behavior.
3. Deploy Next.js web.
4. Enable catalog/feature changes through controlled configuration.
5. Run authenticated golden-flow, webhook, private artifact, ledger, and telemetry smoke tests.

Breaking schema work uses expand/backfill/contract across releases. Never make a database rollback depend on restoring deleted data.

## Rollback

- Web: promote the last known-good Vercel deployment.
- Core: deploy the last known-good Worker version/config after confirming binding compatibility.
- Model/provider: disable the route or restore the prior catalog version; do not rewrite historical runs.
- Database: roll application behavior forward around additive schema, or execute a pre-tested repair migration. Restore is reserved for data-loss incidents.
- Media: revoke signing path/route; private R2 objects remain intact during compute rollback.
- Billing: stop new reservations/charges with kill switches, reconcile existing attempts, and preserve the immutable ledger.

Each production deployment records version identifiers, migration range, enabled catalog/policy versions, smoke evidence, operator, start/end time, and rollback target.

## Observability and alerts

Every request/run carries request, workspace, run, node, attempt, provider job, outbox, and ledger correlation IDs as applicable. Logs are structured and redacted. Traces cover web → Core → database/provider/R2. Metrics include barrier latency, outbox lag, provider submit/success/failure/ambiguity, artifact verification, run time, quote/capture difference, duplicate suppression, spend caps, and product funnel timings.

Page immediately on cross-tenant access, public artifact exposure, unbounded spend, ledger imbalance, duplicate charge/submission, signature bypass, or sustained inability to stop execution. Alert on SLO degradation, provider/model drift, outbox backlog, reconciliation age, and elevated failure/cost.

## Incident procedure

1. Declare severity/commander and open an immutable incident timeline.
2. Contain using the narrowest kill switch; protect evidence and avoid blind retries.
3. Identify affected workspaces, runs, artifacts, money, credentials, and regulatory duties.
4. Restore safe service through verified rollback or repair and reconcile provider/ledger state.
5. Communicate accurate impact and recovery; never claim resolution before evidence.
6. Rotate exposed credentials and notify affected parties when required.
7. Complete a blameless review with root cause, detection gap, corrective owner/date, tests, runbook changes, and recurrence proof.

Disaster-recovery rehearsals prove database restore, R2 inventory/recovery, configuration recreation, secret rotation, DNS rollback, and receipt reconciliation before paid launch.
