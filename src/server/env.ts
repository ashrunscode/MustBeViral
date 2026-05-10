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
};

export type Env = Cloudflare.Env & AppVars & AppSecrets;
