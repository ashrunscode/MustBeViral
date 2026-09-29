# Production migration dry-run and defect — 2026-09-02

## Dry-run

The repository-pinned Supabase CLI linked to only project `jjgtlfblsfobdhmtngbz`. An authenticated
`db push --linked --dry-run --include-all` listed exactly 37 repository migrations, from
`20260712000000_cleanroom_bootstrap.sql` through
`20260831140000_p3_start_run_barrier_outbox_event_id.sql`. It listed no seed, role file, repair,
remote-only history, or unrelated project.

The pre-apply aggregate migration SHA-256 was
`eeaa570ca92b98b071310f9ec1cfab361f620fa4e66daf820684077979f44fcd`.

## Transactional stop

The production push applied the first 31 migrations through
`20260818120000_p0_pending_input_artifact_upload.sql`. PostgreSQL then rejected statement 15 of
`20260830163000_p1a_billing_kill_switches_stripe.sql` with SQLSTATE `42601` at:

```sql
get diagnostics v_inserted = row_count > 0;
```

`GET DIAGNOSTICS` accepts assignment of the `ROW_COUNT` item, not a boolean expression. The failing
migration was not added to remote migration history and its transaction did not commit.

## Authorized repair

Before changing migration source, this packet records and authorizes the bounded repair:

1. Assign `ROW_COUNT` to a local numeric variable.
2. Derive `v_inserted` from that numeric value in the next PL/pgSQL statement.
3. Add database assertions proving first claim, duplicate replay, and single-row idempotency.
4. Recompute the 37-file aggregate hash, dry-run the remaining six migrations, and resume only from
   the failed migration.

The expected aggregate SHA-256 after that exact repair is
`2d4ff1beb167d69895ff97216ae42e8cf88d881a413127a84835ed53004ff73e`.

No destructive repair, migration-history rewrite, seed, customer data, client binding, or unrelated
project mutation is authorized.
