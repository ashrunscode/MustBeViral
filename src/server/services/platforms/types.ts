/**
 * Option D platform-integration shared types.
 *
 * Adapter contract followed by every per-platform implementation
 * (LinkedIn, X, Meta, TikTok). Kept dependency-free so the file
 * compiles in both tsconfig.cloudflare (server) and tsconfig.node
 * (unit tests).
 */

export type PlatformId = "linkedin" | "x" | "meta" | "tiktok";

export type PlatformCapability = "publish" | "ingest";

export type PublishStatus = "published" | "scheduled" | "failed" | "feature_disabled";

export type ReplyStatus = "sent" | "failed" | "feature_disabled";

/**
 * Decrypted token bag handed to an adapter call. Never returned to clients,
 * never echoed to chat or logs.
 */
export interface AccessToken {
	accessToken: string;
	refreshToken?: string;
	/** Token type per RFC 6749 §7.1. Typically `Bearer`. */
	tokenType?: string;
	expiresAt?: string; // ISO timestamp
	scopes: string[];
	externalAccountId: string;
	socialAccountTokenId: string;
	platformMetadata?: Record<string, unknown>;
}

/**
 * Cipher payload stored encrypted in KV under `social_account_tokens.token_kv_key`.
 * D1 only ever stores metadata (platform, scopes, expiry, the KV key); the
 * tokens themselves never touch D1.
 */
export interface StoredTokenPayload {
	access_token: string;
	refresh_token?: string;
	token_type?: string;
	issued_at: string; // ISO
	platform_metadata?: Record<string, unknown>;
}

export interface PlatformPublishInput {
	brandId: string;
	workspaceId: string;
	postId: string;
	caption: string;
	mediaR2Keys: string[];
	scheduledAt: string; // ISO; if past, publish immediately
	approvedBy: string;
	platformMetadata?: Record<string, unknown>;
}

export interface PlatformPublishResult {
	platform: PlatformId;
	status: PublishStatus;
	externalPostId?: string;
	externalUrl?: string;
	errorCode?: string;
	errorMessage?: string;
	rateLimitReset?: number; // unix seconds
	requestId?: string;
	elapsedMs?: number;
}

export interface PlatformReplyInput {
	brandId: string;
	workspaceId: string;
	inboundEventId: string;
	externalCommentId: string;
	replyBody: string;
	approvedBy: string;
	platformMetadata?: Record<string, unknown>;
}

export interface PlatformReplyResult {
	platform: PlatformId;
	status: ReplyStatus;
	externalReplyId?: string;
	errorCode?: string;
	errorMessage?: string;
	rateLimitReset?: number;
	requestId?: string;
	elapsedMs?: number;
}

/**
 * Returned by adapter.ingestInbound when a webhook is verified + parsed.
 * The route layer is responsible for persisting comments + dispatching the
 * approval workflow; the adapter just normalises the payload.
 */
export interface PlatformIngestEvent {
	externalCommentId: string;
	externalPostId?: string;
	parentExternalCommentId?: string;
	authorExternalId?: string;
	authorHandle?: string;
	body: string;
	receivedAt: string; // ISO
	metadata?: Record<string, unknown>;
}

export interface PlatformIngestResult {
	platform: PlatformId;
	ok: boolean;
	events: PlatformIngestEvent[];
	reason?: "feature_disabled" | "invalid_signature" | "malformed_payload" | "ignored";
}

/**
 * Rate-limit hint each adapter exposes so workflows can pre-check before
 * making a publish/reply call.
 */
export interface PlatformRateLimitState {
	remaining: number;
	reset: number; // unix seconds
}

/**
 * Subset of `Env` the platform layer reads. Defined structurally so service
 * files stay compilable under tsconfig.node (which lacks the Cloudflare
 * ambient types) — same pattern as services/stripe/events.ts::EventDispatchEnv.
 *
 * Every feature flag is declared explicitly so the `isPlatformEnabled` helper
 * can do `env[FeatureFlagKey]` with proper TS narrowing. Adding a new flag
 * means: (a) wrangler.jsonc vars block, (b) AppVars in env.ts, (c) this
 * interface — keep all three in sync.
 */
export interface PlatformEnv {
	TOKEN_ENCRYPTION_KEY?: string;
	APP_ENV?: string;
	PUBLIC_APP_URL?: string;
	CACHE?: PlatformKvNamespace;
	ENABLE_LINKEDIN_PUBLISH?: "true" | "false";
	ENABLE_LINKEDIN_INGEST?: "true" | "false";
	ENABLE_X_PUBLISH?: "true" | "false";
	ENABLE_X_INGEST?: "true" | "false";
	ENABLE_META_PUBLISH?: "true" | "false";
	ENABLE_META_INGEST?: "true" | "false";
	ENABLE_TIKTOK_PUBLISH?: "true" | "false";
	ENABLE_TIKTOK_INGEST?: "true" | "false";
}

/**
 * Minimal KVNamespace surface. Cloudflare Workers' KVNamespace is
 * structurally compatible with this.
 */
export interface PlatformKvNamespace {
	get(key: string, options?: { type?: "text" | "json" | "arrayBuffer" | "stream" }): Promise<string | null | ArrayBuffer | ReadableStream<Uint8Array>>;
	put(
		key: string,
		value: string | ArrayBuffer | ReadableStream<Uint8Array>,
		options?: { expirationTtl?: number; expiration?: number; metadata?: Record<string, unknown> },
	): Promise<void>;
	delete(key: string): Promise<void>;
}

export interface PlatformAdapter {
	id: PlatformId;
	publish(input: PlatformPublishInput, token: AccessToken): Promise<PlatformPublishResult>;
	reply(input: PlatformReplyInput, token: AccessToken): Promise<PlatformReplyResult>;
	/** Optional: only platforms with real webhooks implement this. */
	ingestInbound?(
		payload: unknown,
		signature: string | null,
		env: PlatformEnv,
	): Promise<PlatformIngestResult>;
	/** Optional rate-limit hint; falls back to a default budget if missing. */
	getRateLimitState?(env: PlatformEnv): Promise<PlatformRateLimitState>;
}

/**
 * Audit-log helper input shared across the platform layer. Mirrors
 * services/audit.ts::AuditLogInput but defined locally so this file doesn't
 * import the Cloudflare-typed audit service.
 */
export interface PlatformAuditInput {
	workspaceId?: string | null;
	brandId?: string | null;
	userId?: string | null;
	action: string; // e.g. "platform.linkedin.publish"
	entityType: string;
	entityId?: string | null;
	before?: unknown;
	after?: unknown;
	metadata?: Record<string, unknown>;
}

export const PLATFORM_IDS: readonly PlatformId[] = ["linkedin", "x", "meta", "tiktok"] as const;
export const PLATFORM_CAPABILITIES: readonly PlatformCapability[] = ["publish", "ingest"] as const;
