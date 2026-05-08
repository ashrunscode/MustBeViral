# Final Data Model

## Baseline

Use the System DNA `DATABASE_SCHEMA.sql` as the entity baseline. It already models users, workspaces, brands, social profiles, scans, profiles, assets, calendars, posts, variants, creatives, approvals, scheduled posts, DM rules, analytics, reports, opportunities, agent runs, workflow runs, usage, subscriptions, audit logs, and later creator/marketplace tables.

## Required Additions

- `sessions`
- `oauth_accounts`
- `password_credentials`
- `invitations`
- `webhooks_inbox`
- `idempotency_keys`
- optional `rate_limits` only if KV is insufficient

## Constraints

- Status columns get SQLite `CHECK` constraints where practical.
- Multi-tenant tables include `workspace_id` or reach workspace through `brand_id`.
- Writes use application-generated UUID/ULID IDs.
- Deletions are soft for audited business entities.
- D1 migration files are never edited after application.
