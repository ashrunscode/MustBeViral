-- DATABASE_SCHEMA.sql
-- MustBeViral D1 schema
-- SQLite-compatible

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  website_url TEXT,
  industry TEXT,
  profile_type TEXT NOT NULL DEFAULT 'brand',
  status TEXT NOT NULL DEFAULT 'active',
  marketing_agent_id TEXT,
  ai_autonomy_level INTEGER NOT NULL DEFAULT 50,
  onboarding_status TEXT NOT NULL DEFAULT 'not_started',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS brand_social_profiles (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  url TEXT,
  handle TEXT,
  connected_status TEXT NOT NULL DEFAULT 'not_connected',
  auth_provider TEXT,
  external_account_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_id, platform, handle)
);

CREATE TABLE IF NOT EXISTS brand_profile_versions (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  profile_json TEXT NOT NULL,
  locked_fields_json TEXT NOT NULL DEFAULT '[]',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(brand_id, version)
);

CREATE TABLE IF NOT EXISTS brand_assets (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  image_id TEXT,
  public_url TEXT,
  title TEXT,
  description TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS website_scans (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  workflow_id TEXT,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  findings_json TEXT NOT NULL DEFAULT '{}',
  screenshots_json TEXT NOT NULL DEFAULT '[]',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS social_scans (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  workflow_id TEXT,
  platform TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  findings_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS competitor_scans (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  workflow_id TEXT,
  competitor_url TEXT,
  competitor_name TEXT,
  findings_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketing_scores (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  scan_id TEXT,
  marketing_readiness INTEGER NOT NULL,
  brand_clarity INTEGER NOT NULL,
  content_consistency INTEGER NOT NULL,
  offer_strength INTEGER NOT NULL,
  visual_quality INTEGER NOT NULL,
  engagement_health INTEGER NOT NULL,
  conversion_path INTEGER NOT NULL,
  audience_fit INTEGER NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS target_market_reports (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  report_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  objective TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  strategy_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_calendars (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  generated_by_workflow_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS content_posts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  calendar_id TEXT REFERENCES content_calendars(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  post_type TEXT NOT NULL DEFAULT 'feed',
  title TEXT,
  hook TEXT,
  caption TEXT NOT NULL,
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  cta TEXT,
  target_audience TEXT,
  funnel_stage TEXT,
  scheduled_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  score INTEGER,
  risk_level TEXT NOT NULL DEFAULT 'low',
  why_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS post_variants (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  copy TEXT NOT NULL,
  hashtags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_creatives (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES content_posts(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  seed TEXT,
  source_asset_ids_json TEXT NOT NULL DEFAULT '[]',
  r2_key_original TEXT,
  image_id TEXT,
  variants_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'generated',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approvals (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  reason TEXT,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scheduled_posts (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
  scheduler_provider TEXT NOT NULL,
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  scheduled_at TEXT,
  published_at TEXT,
  failure_reason TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dm_rules (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  trigger_type TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  response_template TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 1,
  lead_capture_fields_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dm_events (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  dm_rule_id TEXT REFERENCES dm_rules(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  external_thread_id TEXT,
  trigger_text TEXT,
  response_text TEXT,
  status TEXT NOT NULL DEFAULT 'logged',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics_snapshots (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  post_id TEXT REFERENCES content_posts(id) ON DELETE SET NULL,
  snapshot_date TEXT NOT NULL,
  metrics_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_reports (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  week_start TEXT NOT NULL,
  week_end TEXT NOT NULL,
  report_json TEXT NOT NULL DEFAULT '{}',
  pdf_r2_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS growth_opportunities (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  expected_impact TEXT,
  difficulty TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL,
  workflow_id TEXT,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL DEFAULT '{}',
  output_json TEXT NOT NULL DEFAULT '{}',
  error_json TEXT NOT NULL DEFAULT '{}',
  token_usage_json TEXT NOT NULL DEFAULT '{}',
  cost_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS workflow_runs (
  id TEXT PRIMARY KEY,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  workflow_name TEXT NOT NULL,
  external_workflow_id TEXT,
  status TEXT NOT NULL,
  progress_json TEXT NOT NULL DEFAULT '{}',
  error_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  usage_type TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  quantity REAL NOT NULL DEFAULT 0,
  cost_estimate REAL NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_start TEXT,
  current_period_end TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS creator_profiles (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  niche TEXT,
  audience_json TEXT NOT NULL DEFAULT '{}',
  platforms_json TEXT NOT NULL DEFAULT '{}',
  rate_card_json TEXT NOT NULL DEFAULT '{}',
  media_kit_json TEXT NOT NULL DEFAULT '{}',
  brand_safety_json TEXT NOT NULL DEFAULT '{}',
  marketplace_visibility INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_matches (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  creator_profile_id TEXT NOT NULL REFERENCES creator_profiles(id) ON DELETE CASCADE,
  match_score INTEGER NOT NULL,
  match_reasons_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_brands_workspace ON brands(workspace_id);
CREATE INDEX IF NOT EXISTS idx_brands_status ON brands(status);
CREATE INDEX IF NOT EXISTS idx_social_brand_platform ON brand_social_profiles(brand_id, platform);
CREATE INDEX IF NOT EXISTS idx_assets_brand_type ON brand_assets(brand_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_website_scans_brand ON website_scans(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_scans_brand_platform ON social_scans(brand_id, platform, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scores_brand ON marketing_scores(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_calendars_brand ON content_calendars(brand_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_posts_brand_status ON content_posts(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_brand_platform_status ON content_posts(brand_id, platform, status);
CREATE INDEX IF NOT EXISTS idx_posts_calendar_status ON content_posts(calendar_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_at ON content_posts(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_approvals_brand_post ON approvals(brand_id, post_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_brand_status ON scheduled_posts(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_dm_rules_brand ON dm_rules(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_analytics_brand_date ON analytics_snapshots(brand_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reports_brand_week ON weekly_reports(brand_id, week_start);
CREATE INDEX IF NOT EXISTS idx_opportunities_brand_status ON growth_opportunities(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_runs_brand ON agent_runs(brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_brand_status ON workflow_runs(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_usage_workspace_date ON usage_events(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_date ON audit_logs(workspace_id, created_at DESC);
