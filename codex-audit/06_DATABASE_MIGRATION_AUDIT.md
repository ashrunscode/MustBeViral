# 06 — Database Migration Audit

Migration file: `src/server/db/migrations/0001_initial.sql` (476 lines, ~75 SQL statements: 37 `CREATE TABLE` + 36 `CREATE INDEX` + 1 `PRAGMA`).

## Table coverage check

| Table | Spec required (system DNA) | Created | Notes |
|---|---|---|---|
| users | ✅ | ✅ | role enum: 'user', 'admin'. Soft-delete via `deleted_at` |
| password_credentials | (added by Codex) | ✅ | PK `user_id`, ON DELETE CASCADE. Stores `password_algo='pbkdf2-sha512'` and `password_params_json` (JSON-validated) |
| sessions | (added by Codex) | ✅ | UNIQUE `hashed_token`, FK CASCADE. Tracks `revoked_at`, `rotated_at` (column unused), `last_active_at`, `ip_hash`, `user_agent` |
| oauth_accounts | (added by Codex) | ✅ | UNIQUE(provider, provider_account_id). Phase 2 |
| workspaces | ✅ | ✅ | UNIQUE `slug`. Plan enum locked to 4 values matching Stripe `STRIPE_PRICE_*` |
| workspace_members | ✅ | ✅ | UNIQUE(workspace_id, user_id). Role enum: owner/admin/member |
| invitations | (added by Codex) | ✅ | UNIQUE `token_hash`. Never read by app code today |
| brands | ✅ | ✅ | **`autonomy_level` CHECK 0-89** (spec says 0-100; intentional cap?). UNIQUE(workspace_id, slug). `profile_type` enum: brand/creator |
| brand_social_profiles | ✅ | ✅ | UNIQUE(brand_id, platform, handle) |
| brand_profile_versions | ✅ | ✅ | UNIQUE(brand_id, version). Profile JSON enforced via `json_valid` |
| brand_assets | ✅ | ✅ | Tracks R2 `r2_key`. **Currently never written** |
| website_scans | ✅ | ✅ | Status enum and JSON-validated columns |
| social_scans | ✅ | ✅ | Never populated |
| competitor_scans | ✅ | ✅ | Never populated |
| marketing_scores | ✅ | ✅ | overall_score 0-100. Populated by mock generator only |
| target_market_reports | ✅ | ✅ | Populated by mock generator only |
| campaigns | ✅ | ✅ | Status enum: draft/active/paused/complete/archived |
| content_calendars | ✅ | ✅ | start_date/end_date stored as TEXT |
| content_posts | ✅ | ✅ | **Status CHECK enforces approval-before-publish state machine.** ('draft','pending_approval','approved','rejected','scheduled','published','failed') |
| post_variants | ✅ | ✅ | One per post |
| generated_creatives | ✅ | ✅ | `r2_key` stored but R2 object **never uploaded** |
| approvals | ✅ | ✅ | action enum: approve/reject/edit/regenerate |
| scheduled_posts | ✅ | ✅ | UNIQUE(scheduler_provider, external_id). Status includes `manual_export` |
| dm_rules | ✅ | ✅ | `requires_approval INTEGER CHECK IN (0,1) DEFAULT 1`. Status enum includes `pending_approval`/`approved` |
| dm_events | ✅ | ✅ | Status: received/drafted/approved/sent/failed/manual. Never populated |
| analytics_snapshots | ✅ | ✅ | UNIQUE(brand_id, snapshot_date, source). Never populated |
| weekly_reports | ✅ | ✅ | UNIQUE(brand_id, week_start). `pdf_r2_key` column unused |
| growth_opportunities | ✅ | ✅ | impact_score 0-100. Status: new/accepted/dismissed/converted |
| agent_runs | ✅ | ✅ | Used by mock onboarding only |
| workflow_runs | ✅ | ✅ | progress 0-100. Used by mock generators (every "workflow" is logged as `complete` 100%) |
| usage_events | ✅ | ✅ | Logged by ModelRouter and billing checkout |
| subscriptions | ✅ | ✅ | UNIQUE(workspace_id). Plan/status enums match Stripe + spec |
| webhooks_inbox | (added by Codex) | ✅ | UNIQUE(provider, external_event_id). Used for Stripe idempotency |
| idempotency_keys | (added by Codex) | ✅ | **Table exists but no app code uses it** |
| audit_logs | ✅ | ✅ | NO ACTION on workspace/brand FK; SET NULL on user FK |
| creator_profiles | ✅ | ✅ | UNIQUE(brand_id). Phase 2, never populated |
| marketplace_matches | ✅ | ✅ | Phase 2, never populated |

**Coverage:** 37/37 tables present. ✅ matches `tests/unit/schema.test.ts`.

## CHECK constraints

All status/role enums use `CHECK ... IN (...)`. JSON columns use `CHECK (json_valid(...))`. `autonomy_level` and score columns use range checks. ✅ Strong invariants at the schema layer.

## Indexes

36 indexes, covering:

* Auth: `idx_sessions_user_expires`, `idx_oauth_user`
* Membership: `idx_workspace_members_workspace`, `idx_workspace_members_user`, `idx_invitations_workspace_email`
* Brands: `idx_brands_workspace_status (workspace_id, status, deleted_at)`
* Scans: `idx_website_scans_brand`, `idx_social_scans_brand_platform`, `idx_competitor_scans_brand` (last is missing — confirmed not in migration)
* Content: `idx_calendars_brand`, `idx_posts_brand_status`, `idx_posts_brand_platform_status`, `idx_posts_brand_scheduled_at`
* Approvals/scheduling: `idx_approvals_brand_post`, `idx_approvals_user_date`, `idx_scheduled_brand_status`, `idx_scheduled_post_id`
* DM/analytics/reports: standard
* Audit: `idx_audit_workspace_date`, `idx_audit_brand_date`
* Usage/billing: `idx_usage_workspace_date`, `idx_usage_brand_date`, `idx_subscriptions_workspace_status`
* Webhook/idempotency: `idx_webhooks_provider_event`, `idx_idempotency_workspace_expires`

Missing indexes:

| Missing index | Justification |
|---|---|
| `idx_competitor_scans_brand` | `competitor_scans` table is queried by brand_id but has no index |
| `idx_users_email` | `users.email` already has implicit index from `UNIQUE` constraint, so OK |
| `idx_workflow_runs_workspace_status` | Admin overview queries `workflow_runs.status`, scoped by workspace |
| `idx_audit_logs_user_date` | Audit by user across workspaces |

Severity: Low — query volume is small for MVP.

## FK ON DELETE behaviour

| FK | Behaviour | Verdict |
|---|---|---|
| Most child tables → parent on brand/workspace deletion | CASCADE | OK for soft-delete via column; risky if hard-deleted (cascading data loss). But actual app uses `deleted_at` |
| `audit_logs.workspace_id`/`brand_id` | NO ACTION | ✅ Audit survives |
| `audit_logs.user_id` | SET NULL | ✅ |
| `idempotency_keys.user_id`/`workspace_id` | SET NULL | OK (currently unused) |
| `marketing_scores.scan_id`, `content_calendars.campaign_id`, `content_posts.{calendar_id,campaign_id}`, `generated_creatives.post_id`, `dm_events.rule_id` | SET NULL | OK |

## Migration safety

* **Single migration file (0001_initial.sql)**. No 0002+, no rollback file. Reapplication is `IF NOT EXISTS`-safe but cannot be partially rolled back.
* Codex's BUILD_LOG (Milestone 8) reports applying the migration to production. Indexes are also `IF NOT EXISTS`. Safe to re-run.
* `PRAGMA foreign_keys = ON` set at top.

## Codex's `autonomy_level` ceiling

Migration `0001_initial.sql:90`:

```sql
autonomy_level INTEGER NOT NULL DEFAULT 50 CHECK (autonomy_level >= 0 AND autonomy_level <= 89),
```

Spec (`docs/system-dna/PRODUCT_DNA.md` per Explore agent's reading) calls for 0-100. Setting 89 as the ceiling means brands cannot go fully autonomous, which aligns with the "approval first" non-negotiable. **Intentional design choice; should be documented in DECISIONS_LOG.** Currently undocumented.

## Codex's `pdf_r2_key` column

`weekly_reports.pdf_r2_key TEXT`. The spec promised PDF reports. Code never produces a PDF; column is always NULL. Either drop the promise or implement.

## Issues table

| ID | Severity | Issue | Required Fix |
|---|---|---|---|
| DB-1 | Medium | `idempotency_keys` table exists but no route uses it. Idempotency contract not enforced anywhere | Wire on at least mutating routes (workspace create, brand create, scheduler/manual-export) |
| DB-2 | Medium | `analytics_snapshots`, `dm_events`, `social_scans`, `competitor_scans`, `creator_profiles`, `marketplace_matches`, `brand_assets` are all empty tables waiting for code | Acceptable for Phase 1 if documented; otherwise drop until needed |
| DB-3 | Low | `competitor_scans` lacks brand index | Add `CREATE INDEX IF NOT EXISTS idx_competitor_scans_brand ON competitor_scans(brand_id, created_at DESC)` |
| DB-4 | Low | `autonomy_level` ceiling 89 vs spec 100 | Document in DECISIONS_LOG |
| DB-5 | Low | `weekly_reports.pdf_r2_key` always NULL | Either implement PDF generation or drop column |
| DB-6 | Low | Single migration file with no rollback path | Future migrations should be additive only |
| DB-7 | Low | `sessions.rotated_at` column unused (rotation never invoked) | Wire session rotation on login (currently login creates a NEW session but does not invalidate the prior one) |
| DB-8 | Medium | Login does not revoke prior session for the user | `routes/auth.ts:96-145` does not delete or rotate any prior session before creating a new one. Multiple active sessions can pile up | Add `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL` before `createSession`, or implement the spec's session rotation |

## Verdict

The schema is **comprehensive and well-constrained.** The status/JSON CHECK constraints are a strong defence against business-rule drift. Index coverage is good. Foreign-key behaviour is sensible.

The schema is **substantially over-built for the current code** — many tables have no code path that ever populates them. That's not a bug, but it's worth knowing: the database is ready for features the application has not yet implemented.
