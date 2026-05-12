-- 0003_platform_integration.sql
-- Option D dark-deploy foundation. Three new tables + 6 indexes.
-- All statements are CREATE … IF NOT EXISTS so the migration is idempotent and
-- safe to apply against any DB that already has the post-0002 baseline.

CREATE TABLE IF NOT EXISTS social_account_tokens (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	platform TEXT NOT NULL CHECK (platform IN ('linkedin','x','meta','tiktok')),
	external_account_id TEXT NOT NULL,
	account_label TEXT NOT NULL,
	scope_csv TEXT NOT NULL,
	token_kv_key TEXT NOT NULL,
	access_token_expires_at TEXT NOT NULL,
	refresh_token_expires_at TEXT,
	status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
	last_used_at TEXT,
	created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(brand_id, platform, external_account_id)
);

CREATE INDEX IF NOT EXISTS idx_social_tokens_brand_platform
	ON social_account_tokens(brand_id, platform, status);

CREATE TABLE IF NOT EXISTS published_posts (
	id TEXT PRIMARY KEY,
	post_id TEXT NOT NULL REFERENCES content_posts(id) ON DELETE CASCADE,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	platform TEXT NOT NULL,
	external_post_id TEXT NOT NULL,
	external_url TEXT,
	social_account_token_id TEXT NOT NULL REFERENCES social_account_tokens(id),
	published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	UNIQUE(platform, external_post_id)
);

CREATE INDEX IF NOT EXISTS idx_published_posts_brand_platform_published_at
	ON published_posts(brand_id, platform, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_posts_post
	ON published_posts(post_id);

CREATE TABLE IF NOT EXISTS platform_comments (
	id TEXT PRIMARY KEY,
	brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
	published_post_id TEXT REFERENCES published_posts(id),
	platform TEXT NOT NULL,
	external_comment_id TEXT NOT NULL,
	parent_external_comment_id TEXT,
	author_external_id TEXT,
	author_handle TEXT,
	body TEXT,
	metadata_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(metadata_json)),
	ingested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	UNIQUE(platform, external_comment_id)
);

CREATE INDEX IF NOT EXISTS idx_platform_comments_brand_post
	ON platform_comments(brand_id, published_post_id, ingested_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_comments_platform_ingested
	ON platform_comments(platform, ingested_at DESC);
