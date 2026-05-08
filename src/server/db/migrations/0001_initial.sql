PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
	id TEXT PRIMARY KEY,
	email TEXT NOT NULL UNIQUE,
	name TEXT,
	role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
	email_verified_at TEXT,
	failed_login_attempts INTEGER NOT NULL DEFAULT 0,
	locked_until TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS password_credentials (
	user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
	password_hash TEXT NOT NULL,
	password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha512',
	password_params_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(password_params_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	hashed_token TEXT NOT NULL UNIQUE,
	expires_at TEXT NOT NULL,
	rotated_at TEXT,
	revoked_at TEXT,
	ip_hash TEXT,
	user_agent TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	provider TEXT NOT NULL,
	provider_account_id TEXT NOT NULL,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	slug TEXT NOT NULL UNIQUE,
	plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'agency', 'managed')),
	settings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(settings_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workspace_members (
	id TEXT PRIMARY KEY,
	workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS invitations (
	id TEXT PRIMARY KEY,
	workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	email TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
	invited_by TEXT REFERENCES users(id),
	token_hash TEXT NOT NULL UNIQUE,
	expires_at TEXT NOT NULL,
	accepted_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS brands (
	id TEXT PRIMARY KEY,
	workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	slug TEXT NOT NULL,
	website_url TEXT,
	industry TEXT,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
	onboarding_status TEXT NOT NULL DEFAULT 'not_started' CHECK (onboarding_status IN ('not_started', 'running', 'complete', 'failed')),
	profile_type TEXT NOT NULL DEFAULT 'brand' CHECK (profile_type IN ('brand', 'creator')),
	autonomy_level INTEGER NOT NULL DEFAULT 50 CHECK (autonomy_level >= 0 AND autonomy_level <= 89),
	brand_rules_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(brand_rules_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	deleted_at TEXT,
	UNIQUE(workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS brand_social_profiles (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	platform TEXT NOT NULL,
	handle TEXT,
	profile_url TEXT,
	connected_status TEXT NOT NULL DEFAULT 'not_connected' CHECK (connected_status IN ('not_connected', 'connecting', 'connected', 'failed', 'disconnected')),
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id, platform, handle)
);

CREATE TABLE IF NOT EXISTS brand_profile_versions (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	version INTEGER NOT NULL,
	profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
	locked_fields_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(locked_fields_json)),
	created_by TEXT REFERENCES users(id),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id, version)
);

CREATE TABLE IF NOT EXISTS brand_assets (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	asset_type TEXT NOT NULL,
	r2_key TEXT NOT NULL,
	file_name TEXT,
	mime_type TEXT NOT NULL,
	byte_size INTEGER NOT NULL DEFAULT 0,
	width INTEGER,
	height INTEGER,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_scans (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	url TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
	findings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(findings_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	error_message TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_scans (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	platform TEXT NOT NULL,
	profile_url TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
	findings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(findings_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitor_scans (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	competitor_url TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
	findings_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(findings_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_scores (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	scan_id TEXT REFERENCES website_scans(id),
	overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
	scores_json TEXT NOT NULL CHECK (json_valid(scores_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS target_market_reports (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	report_json TEXT NOT NULL CHECK (json_valid(report_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	objective TEXT,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'complete', 'archived')),
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_calendars (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
	start_date TEXT NOT NULL,
	end_date TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
	strategy_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(strategy_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_posts (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	calendar_id TEXT REFERENCES content_calendars(id) ON DELETE SET NULL,
	campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
	platform TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'scheduled', 'published', 'failed')),
	risk_level TEXT NOT NULL DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
	caption TEXT NOT NULL,
	hashtags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(hashtags_json)),
	why_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(why_json)),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	scheduled_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_variants (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
	platform TEXT NOT NULL,
	caption TEXT NOT NULL,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_creatives (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	post_id TEXT REFERENCES content_posts(id) ON DELETE SET NULL,
	prompt TEXT NOT NULL,
	provider TEXT NOT NULL,
	model TEXT NOT NULL,
	r2_key TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
	usage_event_id TEXT,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
	user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'edit', 'regenerate')),
	note TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
	scheduler_provider TEXT NOT NULL DEFAULT 'manual' CHECK (scheduler_provider IN ('manual', 'vista_social', 'buffer')),
	external_id TEXT,
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'published', 'failed', 'manual_export')),
	scheduled_at TEXT NOT NULL,
	retry_count INTEGER NOT NULL DEFAULT 0,
	failure_reason TEXT,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(scheduler_provider, external_id)
);

CREATE TABLE IF NOT EXISTS dm_rules (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	platform TEXT NOT NULL,
	trigger_type TEXT NOT NULL,
	trigger_value TEXT NOT NULL,
	response_template TEXT NOT NULL,
	requires_approval INTEGER NOT NULL DEFAULT 1 CHECK (requires_approval IN (0, 1)),
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'paused', 'rejected')),
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dm_events (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	rule_id TEXT REFERENCES dm_rules(id) ON DELETE SET NULL,
	platform TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'drafted', 'approved', 'sent', 'failed', 'manual')),
	event_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(event_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	snapshot_date TEXT NOT NULL,
	source TEXT NOT NULL,
	metrics_json TEXT NOT NULL CHECK (json_valid(metrics_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id, snapshot_date, source)
);

CREATE TABLE IF NOT EXISTS weekly_reports (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	week_start TEXT NOT NULL,
	week_end TEXT NOT NULL,
	report_json TEXT NOT NULL CHECK (json_valid(report_json)),
	pdf_r2_key TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id, week_start)
);

CREATE TABLE IF NOT EXISTS growth_opportunities (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	opportunity_type TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted', 'dismissed', 'converted')),
	evidence_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(evidence_json)),
	impact_score INTEGER NOT NULL DEFAULT 0 CHECK (impact_score >= 0 AND impact_score <= 100),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_runs (
	id TEXT PRIMARY KEY,
	brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
	workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
	agent_name TEXT NOT NULL,
	action TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
	input_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_json)),
	output_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(output_json)),
	error_message TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_runs (
	id TEXT PRIMARY KEY,
	external_workflow_id TEXT,
	brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
	workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
	workflow_name TEXT NOT NULL,
	status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'complete', 'failed', 'waiting_manual')),
	progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
	input_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(input_json)),
	output_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(output_json)),
	error_message TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usage_events (
	id TEXT PRIMARY KEY,
	workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
	brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
	event_type TEXT NOT NULL,
	provider TEXT,
	model TEXT,
	quantity INTEGER NOT NULL DEFAULT 1,
	cost_estimate_cents INTEGER NOT NULL DEFAULT 0,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
	id TEXT PRIMARY KEY,
	workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
	stripe_customer_id TEXT,
	stripe_subscription_id TEXT,
	plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'agency', 'managed')),
	status TEXT NOT NULL DEFAULT 'incomplete' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'incomplete')),
	current_period_end TEXT,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS webhooks_inbox (
	id TEXT PRIMARY KEY,
	provider TEXT NOT NULL,
	external_event_id TEXT NOT NULL,
	payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
	status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processed', 'failed', 'ignored')),
	processed_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(provider, external_event_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
	id TEXT PRIMARY KEY,
	user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
	request_hash TEXT NOT NULL,
	response_status INTEGER,
	response_body TEXT,
	expires_at TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
	id TEXT PRIMARY KEY,
	workspace_id TEXT REFERENCES workspaces(id) ON DELETE NO ACTION,
	brand_id TEXT REFERENCES brands(id) ON DELETE NO ACTION,
	user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
	action TEXT NOT NULL,
	entity_type TEXT NOT NULL,
	entity_id TEXT,
	before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
	after_json TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creator_profiles (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id)
);

CREATE TABLE IF NOT EXISTS marketplace_matches (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	creator_profile_id TEXT REFERENCES creator_profiles(id) ON DELETE SET NULL,
	status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'contacted', 'accepted', 'rejected', 'archived')),
	match_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(match_json)),
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_expires ON sessions(user_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_oauth_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace_email ON invitations(workspace_id, email);
CREATE INDEX IF NOT EXISTS idx_brands_workspace_status ON brands(workspace_id, status, deleted_at);
CREATE INDEX IF NOT EXISTS idx_social_brand_platform ON brand_social_profiles(brand_id, platform);
CREATE INDEX IF NOT EXISTS idx_assets_brand_type ON brand_assets(brand_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_website_scans_brand ON website_scans(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_scans_brand_platform ON social_scans(brand_id, platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_brand ON marketing_scores(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_target_market_brand ON target_market_reports(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand_status ON campaigns(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_calendars_brand ON content_calendars(brand_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_posts_brand_status ON content_posts(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_brand_platform_status ON content_posts(brand_id, platform, status);
CREATE INDEX IF NOT EXISTS idx_posts_brand_scheduled_at ON content_posts(brand_id, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_approvals_brand_post ON approvals(brand_id, post_id);
CREATE INDEX IF NOT EXISTS idx_approvals_user_date ON approvals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scheduled_brand_status ON scheduled_posts(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_scheduled_post_id ON scheduled_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_dm_rules_brand ON dm_rules(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_events_brand_status_date ON dm_events(brand_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_brand_date ON analytics_snapshots(brand_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reports_brand_week ON weekly_reports(brand_id, week_start);
CREATE INDEX IF NOT EXISTS idx_opportunities_brand_status ON growth_opportunities(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_brand ON agent_runs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_brand_status ON workflow_runs(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_external_id ON workflow_runs(external_workflow_id);
CREATE INDEX IF NOT EXISTS idx_usage_workspace_date ON usage_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_brand_date ON usage_events(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_status ON subscriptions(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_webhooks_provider_event ON webhooks_inbox(provider, external_event_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_workspace_expires ON idempotency_keys(workspace_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_date ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_brand_date ON audit_logs(brand_id, created_at DESC);
