---
doc_id: deploy-rollback-incidents
---

# Deploy, rollback, and incidents

## Promotion model

Changes flow preview → staging → production from a commit merged into `main`, the active packet's canonical branch. The reviewed cleanroom promotion preserves historical receipts and does not itself deploy or enable customer traffic. The preview environment is not created yet, so releases start at staging. Workflows pin allowed actions by full commit SHA, but GitHub Actions remains disabled by the owner's September 28 instruction. Production requires approved migrations, all quality gates, a staging smoke test, rollback evidence, environment/secret validation, and explicit deployment approval. For deploys to existing V2 targets that follow the guarded release below, `adr-0009-standing-release-authority` is that approval.

Deployment order for compatible releases:

1. Apply additive Supabase migrations and verify RLS/functions.
2. Deploy Core Worker with compatible contracts and disabled new behavior.
3. Deploy Next.js web.
4. Enable catalog/feature changes through controlled configuration.
5. Run authenticated golden-flow, webhook, private artifact, ledger, and telemetry smoke tests.

Breaking schema work uses expand/backfill/contract across releases. Never make a database rollback depend on restoring deleted data.

## Guarded release

Local agents merge and deploy under `adr-0009-standing-release-authority` without asking again, only through these steps:

1. Merge only after the merge gates in `quality-gates` pass for the exact pull request head.
2. Deploy only the merged commit, and only to these existing V2 targets: Workers `mustbeviral-v2-staging-core`, `mustbeviral-v2-staging-collaboration`, `mustbeviral-v2-production-core` and `mustbeviral-v2-production-collaboration`; Vercel projects `mustbeviral-web-staging` and `mustbeviral-web-production`. A target that does not exist is a new cloud resource. Confirm no other session is releasing to the same target.
3. Before deploying, record each target's live version or deployment as its rollback target (`wrangler deployments status` with the Worker's `--config` and `--env` gives the live version). A Worker deploy applies the merged config's vars, bindings, cron triggers, routes, `workers_dev` reachability and queue consumers, not only code. Run these checks for each Worker. If any of them finds a difference, stop: that deploy is an enablement or routing change that needs an owner sentence.
   - **Config:** `git diff <deployed-commit> <merged-commit> -- apps/<worker>/wrangler.jsonc` must not change `vars`, bindings, `triggers`, `routes`, `queues`, `workers_dev` or `preview_urls`, at the top level or under that `--env`. `<deployed-commit>` is the source commit of the latest record of a `wrangler deploy` that applied that target's config. Records of only a `wrangler secret put` publish or a rollback do not count. If no such record names a source commit, treat the config as changed.
   - **Live vars and bindings:** each binding's name, type and value in the live version (`wrangler versions view <version-id> --json`, `resources.bindings`) must match the merged `wrangler.jsonc` for that `--env`. Compare values against the config file, not the dry run. `wrangler deploy --dry-run` shortens long values, so use it only to confirm the set of binding names and types. For example, a kill switch such as `QUEUES_ENABLED` switched off outside the config would be switched back on.
   - **Out-of-band changes:** no deployment record, open incident or owner message may say a cron, route, `workers.dev` reachability or queue consumer was changed outside the config since `<deployed-commit>`. Wrangler cannot read live cron or `workers.dev` state, so these records are the check. A change of that kind made outside the config and recorded nowhere cannot be detected here, and the deploy will revert it. For a queue, `wrangler queues info <queue>` must show the consumer the config declares.
4. Deploy staging first, in the deployment order above, and pass the staging smoke. Then deploy the same commit to production. A production deploy that needs a production migration waits for the owner.
5. Use only these routine release commands for the target being released:
   - Worker: `pnpm exec wrangler deploy --config apps/<worker>/wrangler.jsonc --env <environment> --keep-vars`.
   - Staging migrations: only merged, additive migrations, applied in order through the Supabase MCP `list_migrations` then `apply_migration` path. Use a connection confirmed to target `mustbeviral-staging`, as in `governance/evidence/WP-P3-001/queues/start-run-barrier-event-id-staging-apply-2026-08-31.md`. Do not use `supabase db push`.
   - Web: no Vercel deploy command is recorded yet. Before the first web deploy, ask the owner for the exact invocation and record it. Later web deploys reuse the recorded command.

   The read-only commands in step 3 and the rollback commands in step 6 are also permitted. A command recorded for another purpose, such as creating a queue, is not a routine release command. No command may produce an effect that `adr-0009-standing-release-authority` leaves owner-gated. If a step has no routine command, stop and ask.

6. Smoke each target after deploying. If a smoke check fails, roll that target back to its recorded rollback target (Workers: `wrangler rollback <version-id>` with the matching `--config` and `--env`; web: `vercel rollback` or `vercel promote` of the prior deployment), then open an incident.
7. Record the deployment under the active packet's governance evidence. Include the fields listed at the end of the Rollback section, plus the source commit, reviewed head and gate results.

A deploy ships code; the checks in step 3 keep live Worker settings as they are. These still need a dated owner sentence naming the exact action:

- legacy V1 production (`preserve_until_v2_cutover`), cutover, traffic, DNS, custom domains, routes and `workers.dev` reachability;
- production database writes, including migrations;
- secrets, environment variables and project settings;
- enabling features, catalog entries, queues, provider execution, charging or a Stripe mode;
- new cloud resources.

Remote destructive actions stay forbidden unless `PROJECT_STATE.yaml` and the active packet name exact resources and rollback evidence.

The Stripe webhook endpoint for each environment subscribes to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created`, `customer.subscription.updated` and `customer.subscription.deleted` (ADR-0007). Core acknowledges other event types without settling them. Deploy the Core Worker that calls `apply_stripe_wallet_top_up` before any release creates wallet top-up Checkout Sessions. The migration that adds it also makes `apply_stripe_wallet_credit` refuse every call. Apply that migration and deploy that Worker back to back: in between, the previous Worker returns 500 for `checkout.session.completed` and `invoice.paid` deliveries, which is expected and loses nothing as long as the new Worker is live well inside Stripe's three-day retry window. For the same reason, a Core Worker rolled back past that change fails wallet credits (Stripe retries them) instead of crediting twice; roll Core forward to resume them. A contract migration later drops `apply_stripe_wallet_credit`.

## Rollback

- Web: promote the last known-good Vercel deployment.
- Core: deploy the last known-good Worker version/config after confirming binding compatibility.
- Model/provider: disable the route or restore the prior catalog version; do not rewrite historical runs.
- Database: roll application behavior forward around additive schema, or execute a pre-tested repair migration. Restore is reserved for data-loss incidents.
- Media: revoke signing path/route; private R2 objects remain intact during compute rollback.
- Billing: stop new reservations/charges with kill switches, reconcile existing attempts, and preserve the immutable ledger. To find Stripe webhook receipts with no settlement evidence, run `supabase/tests/operator/stripe_webhook_settlement_gaps.psql` in a read-only session as a role with BYPASSRLS; deliveries that failed without writing a receipt appear only in the Stripe dashboard's webhook delivery log. That query also lists receipts that correctly have no credit: a Checkout Session that is not a wallet top-up, a completed top-up still awaiting a delayed payment, and a second event for a session another event already credited.
- Rejected wallet top-up: Core logs `core.stripe_webhook.wallet_top_up_rejected` with the Stripe event id and reason when a paid top-up cannot be credited exactly (ADR-0007). Stripe resends the same payload, so every retry fails the same way until Stripe stops retrying, and no receipt is written. Look up the event and its Checkout Session in the Stripe dashboard and confirm the payment. If the reason is `unsupported_currency`, `invalid_amount` or `invalid_checkout_session_id`, refund the payment or escalate; it cannot be credited. Otherwise confirm the intended workspace with its owner, then, as `service_role`, call `apply_stripe_wallet_top_up` once with that workspace id, the Checkout Session id, the Stripe event id and customer id, `amount_total` × 10,000 micros, the event type, an incident request id, and `p_metadata` of `{"repair": "operator_runbook", "incident": "<incident id>"}` so the credit is distinguishable from a webhook credit. Because retention of Core's logs may be shorter than Stripe's retry window, forward the rejection event to an alert. Retried deliveries of that event are still rejected before any credit, and the function replays if it is called again for the session.

Each staging and production deployment records version identifiers, migration range, enabled catalog/policy versions, smoke evidence, operator, start/end time, and rollback target.

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
