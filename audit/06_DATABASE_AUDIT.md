# 06_DATABASE_AUDIT.md

## Schema Verdict

`DATABASE_SCHEMA.sql` defines **33 tables and 25 indexes** in 435 lines of SQLite-compatible DDL. Overall it is well-structured for a multi-brand marketing autopilot. It models the right entities and uses sensible scoping (`workspace_id` → `brand_id` → child rows). It is **not yet implementation-ready**. Major gaps are auth/sessions, no enumerated status sets, missing rate-limit / idempotency tables, and missing OAuth/social-token columns even though the product needs them.

## Verdict in one line

**Keep the schema as the design baseline. Add 6 tables / refactor 4 columns / add 7 indexes before going live.**

## Missing Tables

These exist nowhere in `DATABASE_SCHEMA.sql` but are required:

| Missing table | Reason needed | Source |
|---|---|---|
| `sessions` | `DEPLOYMENT_RUNBOOK.md` provisions `SESSION_SECRET` and `API_CONTRACTS.md` requires login. JWT-only is one option, but server-side sessions are better for revocation. | `API_CONTRACTS.md`, `DEPLOYMENT_RUNBOOK.md` |
| `oauth_accounts` | `API_CONTRACTS.md:32` includes signup/login; if Google/Apple OAuth ever ships, this table is mandatory. | implicit |
| `password_credentials` (or `password_hash` column on users) | Custom auth requires it. | `API_CONTRACTS.md:32–37` |
| `invitations` | Workspace member invites; without it workspace teams can't grow. | `PRODUCT_DNA.md` agency persona |
| `webhooks_inbox` | Stripe webhook idempotency requires storing event ids; otherwise duplicate webhooks corrupt subscriptions. | `SECURITY_CHECKLIST.md:50` |
| `idempotency_keys` | Required for double-submit protection on POST endpoints (approve/schedule). | best practice |
| `rate_limits` | Or use KV; spec leaves this open. Pick one. | `SECURITY_CHECKLIST.md:71` |
| `prompt_templates` (optional) | Versioned prompts for evidence/audit. Otherwise prompts live in code only. | quality concern |

If you go JWT-only and don't ship password auth in MVP (e.g., OAuth-only via Google), the first three may be deferred. **Decide auth model now** to avoid table churn.

## Broken Relationships

Non-fatal but worth correcting:

| Issue | Tables | Fix |
|---|---|---|
| `brands.marketing_agent_id` is `TEXT` with no FK and no comment defining its meaning | `brands` | Either drop the column (DO id is derivable from `idFromName(brandId)`) or add a stable string and document it |
| `marketing_scores.scan_id` is `TEXT` with no FK; in practice it should reference `website_scans.id` | `marketing_scores`, `website_scans` | Add FK and make the relationship explicit |
| `workflow_runs.brand_id` is nullable (`ON DELETE SET NULL`) but spec says every workflow has a brand | `workflow_runs` | Either keep nullable for system workflows or make required and add a `system_workflow_runs` table for non-brand jobs |
| `agent_runs.brand_id` similarly nullable | `agent_runs` | Same fix |
| `usage_events`, `audit_logs` set `*_id` to `NULL` on delete — losing audit trail when the entity is deleted | both | Acceptable for usage_events; for audit_logs this defeats audit purpose. Switch to `ON DELETE NO ACTION` and never hard-delete what audit_logs reference (use soft delete) |
| `creator_profiles.brand_id` UNIQUE not declared but logically a brand has one creator profile | `creator_profiles` | Add `UNIQUE(brand_id)` |
| `subscriptions.workspace_id` UNIQUE not declared; in practice one workspace has one active sub | `subscriptions` | Either add `UNIQUE(workspace_id)` or accept multiple historical rows — if multiple, add `is_current` flag with partial unique index |

## Index Problems

Existing indexes are reasonable for current tables. Missing/recommended:

| Missing index | Reason |
|---|---|
| `idx_users_email` (UNIQUE already enforced via `UNIQUE` constraint) | Confirm the UNIQUE constraint creates a usable index in SQLite (it does; no separate index needed). |
| `idx_brands_workspace_status` (composite) | Active-brand listing under workspace. Replace existing single-column indexes with composite. |
| `idx_posts_brand_scheduled_at` | Time-based queries need it. Currently only `idx_posts_scheduled_at` exists, no brand prefix. |
| `idx_approvals_user_date` | "What did this user approve last week?" admin query. |
| `idx_dm_events_brand_status_date` | DM event timeline. |
| `idx_audit_brand_date` | Per-brand audit timeline. Currently only `idx_audit_workspace_date`. |
| `idx_workflow_runs_external_id` | Faster lookup by Cloudflare workflow id. |
| `idx_scheduled_posts_post_id` | Avoids table scan when checking if a post is scheduled. |

## D1 Compatibility Issues

D1 is SQLite. Things to watch:

1. **No `JSONB` type.** The schema uses `TEXT` columns named `*_json` — correct. But there is no enforcement that these are valid JSON. Add `CHECK (json_valid(column))` on critical fields to fail fast.
2. **`PRAGMA foreign_keys = ON`** is set in the schema, but D1 ignores PRAGMA statements at the schema level. **Foreign keys are enforced per-connection in D1**; you must verify FK enforcement at runtime, or rely on application-level checks. Drizzle's D1 driver does not auto-set this.
3. **`ON DELETE CASCADE`** behavior depends on FK being on. If FKs aren't enforced in D1 reliably, cascades won't fire. Test with a real D1 to confirm.
4. **`AUTOINCREMENT`** is not used; primary keys are TEXT (UUID/ULID). Good — avoids hot-row issues.
5. **`CURRENT_TIMESTAMP`** in SQLite is UTC and second-resolution. Some product timestamps need millisecond precision. Either accept or store ISO-8601 strings written by the application using `new Date().toISOString()`.
6. **`UNIQUE(workspace_id, slug)`** on brands is correct, but slug generation algorithm undefined. Pick one (e.g., `slugify(name) + 4-char suffix on collision`).

## Migration Risks

- Spec ships **one migration** (`0001_initial.sql`). For a 33-table schema, that is fine for greenfield, but the migration **must include all CREATE TABLE statements** — `setup.py` writes only a placeholder.
- No down-migration strategy defined. D1 doesn't have rollback; if migration fails mid-way, manual cleanup is required.
- No seed data file. For dev, you need at least: a test user, a workspace, a brand with mocked scan output.
- D1 statement-per-file requirements: `wrangler d1 migrations apply` runs the whole file; it must be valid as a single transaction. SQLite doesn't allow `CREATE TABLE` inside another transaction reliably. Use migration tool that handles this (Drizzle Kit handles it correctly).

## Recommended Final Schema (Diff from spec)

Add to `DATABASE_SCHEMA.sql`:

```sql
-- AUTH
ALTER TABLE users ADD COLUMN password_hash TEXT;          -- nullable for OAuth-only users
ALTER TABLE users ADD COLUMN password_algo TEXT;          -- 'argon2id' | 'pbkdf2-sha512'
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hashed_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  invited_by TEXT REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- WEBHOOKS / IDEMPOTENCY
CREATE TABLE IF NOT EXISTS webhooks_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,                -- the key
  user_id TEXT REFERENCES users(id),
  workspace_id TEXT REFERENCES workspaces(id),
  request_hash TEXT NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

-- ENUMS via CHECK constraints (SQLite-compatible)
-- Apply on existing columns:
--   users.role IN ('user','admin')
--   workspaces.plan IN ('starter','growth','agency','managed')
--   workspace_members.role IN ('owner','admin','member')
--   brands.status IN ('active','paused','archived')
--   brands.onboarding_status IN ('not_started','running','complete','failed')
--   brands.profile_type IN ('brand','creator')
--   content_posts.status IN ('draft','pending_approval','approved','rejected','scheduled','published','failed')
--   approvals.action IN ('approve','reject','edit','regenerate')
--   scheduled_posts.status IN ('pending','scheduled','published','failed','manual_export')
--   subscriptions.status IN ('active','trialing','past_due','canceled','incomplete')
--   ... etc.

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_brands_workspace_status ON brands(workspace_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_posts_brand_scheduled_at ON content_posts(brand_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_audit_brand_date ON audit_logs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_external_id ON workflow_runs(external_workflow_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_post_id ON scheduled_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_dm_events_brand_status_date ON dm_events(brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_status ON subscriptions(workspace_id, status);
```

## Required Migration Order

1. `0001_initial_schema.sql` — every table from spec, with CHECK constraints added, missing tables included.
2. `0002_indexes.sql` — all indexes (split for readability; D1 applies in order).
3. `0003_seed_dev.sql` — local-only seeds, gated by `if (env.APP_ENV === 'development')`.
4. Treat each future structural change as a separate `000N_*.sql` file. Never edit applied migrations.
5. Use Drizzle Kit (`drizzle-kit generate`) so migrations and TypeScript types stay in sync.
