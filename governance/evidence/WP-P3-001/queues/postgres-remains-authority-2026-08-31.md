# Postgres remains authority on the P3 queue path — 2026-08-31

Work packet: WP-P3-001, acceptance `postgres-remains-authority`  
Branch: `codex/viralgraph-cleanroom`

## Proof

The Cloudflare Queue path, when later enabled, is a wake only. Tests in `apps/core/test/unit/outbox-queue.test.ts` and `packages/contracts/src/responses.test.ts` prove:

1. `QUEUES_ENABLED` must be the string `true`; otherwise enqueue and consume are no-ops.
2. Wake messages may contain only `{ type: 'outbox.wake', event_id }`.
3. Ledger, reservation, wallet, revision, canvas-head, and membership keys are rejected.
4. Consume validates the wake, then calls the existing `runProviderScheduled` drain. It does not write ledger, membership, or canvas head.
5. `start_run` public results cannot carry `event_id`. The barrier repository maps the
   existing outbox `event_id` for the post-commit wake only; composition strips it before
   the handler return. Ledger, reservation, wallet, revision, and membership keys still
   cannot travel on the queue.

Postgres remains the authority for permissions, revisions, runs, and money. The queue never becomes a second ledger or revision store.
