export type AppEnvironment = "development" | "staging" | "production";
export type SchedulerProviderId = "manual" | "vista_social" | "buffer";

export interface PostPublishQueueMessage {
	brandId: string;
	postId: string;
	scheduledPostId: string;
	attempt: number;
}

export type AppSecrets = {
	// SESSION_SECRET removed — sessions use raw 32-byte random tokens hashed
	// with SHA-256 before storage. A future "pepper" rotation could reintroduce
	// this; until then it is dead config (audit gap L-3).
	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	AI_GATEWAY_TOKEN?: string;
	KIMI_API_KEY?: string;
	OPENAI_API_KEY?: string;
	ANTHROPIC_API_KEY?: string;
	VISTA_SOCIAL_API_KEY?: string;
	BUFFER_API_KEY?: string;
	STRIPE_PRICE_STARTER?: string;
	STRIPE_PRICE_GROWTH?: string;
	STRIPE_PRICE_AGENCY?: string;
	STRIPE_PRICE_MANAGED?: string;
	// Option D platform integration. All optional during the dark-deploy build;
	// platform routes fail-closed when their flags are OFF (the post-build
	// default) regardless of credential presence.
	TOKEN_ENCRYPTION_KEY?: string;
	LINKEDIN_CLIENT_ID?: string;
	LINKEDIN_CLIENT_SECRET?: string;
	LINKEDIN_REDIRECT_URI?: string;
	LINKEDIN_WEBHOOK_SECRET?: string;
	X_CLIENT_ID?: string;
	X_CLIENT_SECRET?: string;
	X_REDIRECT_URI?: string;
	X_WEBHOOK_SECRET?: string;
	META_APP_ID?: string;
	META_APP_SECRET?: string;
	META_REDIRECT_URI?: string;
	META_WEBHOOK_VERIFY_TOKEN?: string;
	TIKTOK_CLIENT_KEY?: string;
	TIKTOK_CLIENT_SECRET?: string;
	TIKTOK_REDIRECT_URI?: string;
	TIKTOK_WEBHOOK_SECRET?: string;
};

export type AppVars = {
	APP_ENV: AppEnvironment;
	PUBLIC_APP_URL: string;
	DEFAULT_SCHEDULER_PROVIDER: SchedulerProviderId;
	DEFAULT_TEXT_MODEL: string;
	AI_GATEWAY_ACCOUNT_ID?: string;
	AI_GATEWAY_ID?: string;
	DEFAULT_IMAGE_MODEL: string;
	PREMIUM_IMAGE_MODEL: string;
	FAST_IMAGE_MODEL: string;
	USE_MOCK_AI: "true" | "false";
	USE_BROWSER_RUN: "true" | "false";
	// Option D platform feature flags. Default to "false" in production; any
	// other string value also reads as disabled (see services/platforms/feature-flags.ts).
	// Production flag flips are per-platform launch decisions made via
	// `wrangler secret put ENABLE_<X>_<Y> --env production "true"`.
	ENABLE_LINKEDIN_PUBLISH: "true" | "false";
	ENABLE_LINKEDIN_INGEST: "true" | "false";
	ENABLE_X_PUBLISH: "true" | "false";
	ENABLE_X_INGEST: "true" | "false";
	ENABLE_META_PUBLISH: "true" | "false";
	ENABLE_META_INGEST: "true" | "false";
	ENABLE_TIKTOK_PUBLISH: "true" | "false";
	ENABLE_TIKTOK_INGEST: "true" | "false";
};

export type Env = Cloudflare.Env & AppVars & AppSecrets;
