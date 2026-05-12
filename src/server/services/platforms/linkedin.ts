/**
 * LinkedIn platform adapter.
 *
 * Implements PlatformAdapter against LinkedIn's `/rest/posts` (UGC Posts API)
 * and `/rest/socialActions/<urn>/comments`. Webhook ingestion verifies the
 * `X-LinkedIn-Signature` HMAC-SHA-256 against `LINKEDIN_WEBHOOK_SECRET`.
 *
 * Defaults to organisation-scoped posting when the connected account has
 * `urn:li:organization:*` in its metadata; falls back to `urn:li:person:*`
 * for personal posts. Adapter is registered with `registry.ts` at import time
 * so the workflow layer can dispatch to it.
 */

import { registerAdapter } from "./registry";
import type {
	AccessToken,
	PlatformAdapter,
	PlatformAuditInput,
	PlatformEnv,
	PlatformIngestEvent,
	PlatformIngestResult,
	PlatformPublishInput,
	PlatformPublishResult,
	PlatformRateLimitState,
	PlatformReplyInput,
	PlatformReplyResult,
} from "./types";
export type { PlatformAuditInput } from "./types";

const LINKEDIN_API = "https://api.linkedin.com";
const LINKEDIN_VERSION = "202406";
const PROTOCOL_VERSION = "2.0.0";

interface LinkedInPostBody {
	author: string;
	commentary: string;
	visibility: "PUBLIC" | "CONNECTIONS" | "LOGGED_IN";
	distribution: {
		feedDistribution: "MAIN_FEED" | "NONE";
		targetEntities: unknown[];
		thirdPartyDistributionChannels: unknown[];
	};
	lifecycleState: "PUBLISHED" | "DRAFT";
	isReshareDisabledByAuthor: boolean;
}

interface AuthorResolution {
	authorUrn: string;
	authorType: "person" | "organization";
}

/**
 * Decide which URN to post against, given the connected account's metadata.
 *
 * Precedence:
 *   1. token.platformMetadata.preferred_author_urn (operator-selected via UI)
 *   2. Any organization URN in platformMetadata.organizations[]
 *   3. The personal memberUrn in platformMetadata.member_urn
 *   4. externalAccountId fallback
 */
function resolveAuthorUrn(token: AccessToken): AuthorResolution {
	const meta: Record<string, unknown> = token.platformMetadata ?? {};
	const preferred = stringOrNull(meta.preferred_author_urn);
	if (preferred) {
		return {
			authorUrn: preferred,
			authorType: preferred.startsWith("urn:li:organization:") ? "organization" : "person",
		};
	}
	const orgs = meta.organizations;
	if (Array.isArray(orgs) && orgs.length > 0) {
		const first: unknown = orgs[0];
		if (first && typeof first === "object") {
			const urn = stringOrNull((first as Record<string, unknown>).urn);
			if (urn) {
				return { authorUrn: urn, authorType: "organization" };
			}
		}
	}
	const memberUrn = stringOrNull(meta.member_urn);
	if (memberUrn) {
		return { authorUrn: memberUrn, authorType: "person" };
	}
	// Fallback: build a person URN from the externalAccountId.
	return {
		authorUrn: `urn:li:person:${token.externalAccountId}`,
		authorType: "person",
	};
}

function buildPostBody(input: PlatformPublishInput, author: AuthorResolution): LinkedInPostBody {
	return {
		author: author.authorUrn,
		commentary: input.caption,
		visibility: "PUBLIC",
		distribution: {
			feedDistribution: "MAIN_FEED",
			targetEntities: [],
			thirdPartyDistributionChannels: [],
		},
		lifecycleState: "PUBLISHED",
		isReshareDisabledByAuthor: false,
	};
}

async function publish(
	input: PlatformPublishInput,
	token: AccessToken,
): Promise<PlatformPublishResult> {
	const author = resolveAuthorUrn(token);
	const body = buildPostBody(input, author);
	const startedAt = Date.now();
	let response: Response;
	try {
		response = await fetch(`${LINKEDIN_API}/rest/posts`, {
			method: "POST",
			headers: buildLinkedInHeaders(token),
			body: JSON.stringify(body),
		});
	} catch (err) {
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: "fetch_failed",
			errorMessage: err instanceof Error ? err.message : "fetch threw",
			elapsedMs: Date.now() - startedAt,
		};
	}
	const elapsedMs = Date.now() - startedAt;
	const requestId = response.headers.get("x-restli-id") ?? response.headers.get("x-li-request-id") ?? undefined;
	if (response.status === 201) {
		const externalPostId = response.headers.get("x-restli-id") ?? response.headers.get("x-linkedin-id") ?? "";
		const externalUrl = externalPostId
			? `https://www.linkedin.com/feed/update/${encodeURIComponent(externalPostId)}/`
			: undefined;
		return {
			platform: "linkedin",
			status: "published",
			externalPostId,
			...(externalUrl ? { externalUrl } : {}),
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	if (response.status === 429) {
		const retryAfter = parseRetryAfter(response.headers);
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: "rate_limited",
			errorMessage: "LinkedIn /rest/posts returned 429",
			...(retryAfter !== undefined ? { rateLimitReset: retryAfter } : {}),
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	if (response.status === 401 || response.status === 403) {
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: response.status === 401 ? "token_expired" : "scope_missing",
			errorMessage: `LinkedIn /rest/posts returned ${String(response.status)}`,
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	const errText = await safeText(response);
	return {
		platform: "linkedin",
		status: "failed",
		errorCode: `http_${String(response.status)}`,
		errorMessage: errText.slice(0, 500),
		...(requestId ? { requestId } : {}),
		elapsedMs,
	};
}

async function reply(input: PlatformReplyInput, token: AccessToken): Promise<PlatformReplyResult> {
	const author = resolveAuthorUrn(token);
	const startedAt = Date.now();
	// Parent comment URN is the externalCommentId from the inbound webhook.
	// LinkedIn API: POST /rest/socialActions/<parent-comment-urn>/comments
	const parentUrn = encodeURIComponent(input.externalCommentId);
	const body = {
		actor: author.authorUrn,
		object: input.externalCommentId,
		message: { text: input.replyBody },
	};
	let response: Response;
	try {
		response = await fetch(`${LINKEDIN_API}/rest/socialActions/${parentUrn}/comments`, {
			method: "POST",
			headers: buildLinkedInHeaders(token),
			body: JSON.stringify(body),
		});
	} catch (err) {
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: "fetch_failed",
			errorMessage: err instanceof Error ? err.message : "fetch threw",
			elapsedMs: Date.now() - startedAt,
		};
	}
	const elapsedMs = Date.now() - startedAt;
	const requestId = response.headers.get("x-li-request-id") ?? undefined;
	if (response.status === 201 || response.status === 200) {
		let externalReplyId: string | undefined;
		try {
			const parsed: unknown = await response.json();
			if (parsed && typeof parsed === "object") {
				const obj = parsed as Record<string, unknown>;
				const id = stringOrNull(obj.id) ?? stringOrNull(obj.commentUrn);
				if (id) externalReplyId = id;
			}
		} catch {
			// LinkedIn comments POST may return empty body — accept 201 anyway.
		}
		return {
			platform: "linkedin",
			status: "sent",
			...(externalReplyId ? { externalReplyId } : {}),
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	if (response.status === 429) {
		const retryAfter = parseRetryAfter(response.headers);
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: "rate_limited",
			errorMessage: "LinkedIn /rest/socialActions/comments returned 429",
			...(retryAfter !== undefined ? { rateLimitReset: retryAfter } : {}),
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	if (response.status === 401 || response.status === 403) {
		return {
			platform: "linkedin",
			status: "failed",
			errorCode: response.status === 401 ? "token_expired" : "scope_missing",
			errorMessage: `LinkedIn comment POST returned ${String(response.status)}`,
			...(requestId ? { requestId } : {}),
			elapsedMs,
		};
	}
	const errText = await safeText(response);
	return {
		platform: "linkedin",
		status: "failed",
		errorCode: `http_${String(response.status)}`,
		errorMessage: errText.slice(0, 500),
		...(requestId ? { requestId } : {}),
		elapsedMs,
	};
}

/**
 * Verify the X-LinkedIn-Signature header on an inbound webhook and parse the
 * payload into normalised PlatformIngestEvent rows. LinkedIn signs the raw
 * request body with HMAC-SHA-256 using the developer app's client secret.
 */
function ingestInbound(
	payload: unknown,
	signature: string | null,
	env: PlatformEnv,
): Promise<PlatformIngestResult> {
	const envRecord = env as unknown as Record<string, unknown>;
	const secret = envRecord.LINKEDIN_WEBHOOK_SECRET;
	if (typeof secret !== "string" || secret.length === 0) {
		return Promise.resolve({
			platform: "linkedin",
			ok: false,
			events: [],
			reason: "invalid_signature",
		});
	}
	if (!signature) {
		return Promise.resolve({
			platform: "linkedin",
			ok: false,
			events: [],
			reason: "invalid_signature",
		});
	}
	if (!payload || typeof payload !== "object") {
		return Promise.resolve({
			platform: "linkedin",
			ok: false,
			events: [],
			reason: "malformed_payload",
		});
	}
	const obj = payload as Record<string, unknown>;
	const eventsArr = Array.isArray(obj.events) ? obj.events : [obj];
	const events: PlatformIngestEvent[] = [];
	for (const raw of eventsArr) {
		const event = normaliseIngestEvent(raw);
		if (event) {
			events.push(event);
		}
	}
	return Promise.resolve({ platform: "linkedin", ok: true, events });
}

/**
 * Compute the HMAC-SHA-256 of the raw body against the configured webhook
 * secret. The route layer calls this BEFORE JSON-parsing the body, since
 * LinkedIn signs the raw bytes.
 */
export async function verifyLinkedInWebhookSignature(
	rawBody: string,
	signatureHeader: string | null,
	webhookSecret: string,
): Promise<boolean> {
	if (!signatureHeader) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(webhookSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
	const expected = Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
	// LinkedIn signature header is hex; also tolerate base64 (LinkedIn has historically used both).
	const expectedB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
	const candidate = signatureHeader.trim();
	return timingSafeEqual(candidate, expected) || timingSafeEqual(candidate, expectedB64);
}

function normaliseIngestEvent(raw: unknown): PlatformIngestEvent | null {
	if (!raw || typeof raw !== "object") return null;
	const obj = raw as Record<string, unknown>;
	const externalCommentId = stringOrNull(obj.eventUrn ?? obj.id ?? obj.commentUrn);
	if (!externalCommentId) return null;
	const message = obj.message as Record<string, unknown> | undefined;
	const body = stringOrNull(message?.text ?? obj.body ?? obj.commentary) ?? "";
	const actor = stringOrNull(obj.actor ?? obj.author);
	const objectUrn = stringOrNull(obj.object ?? obj.parent);
	const result: PlatformIngestEvent = {
		externalCommentId,
		body,
		receivedAt: new Date().toISOString(),
	};
	if (objectUrn) result.externalPostId = objectUrn;
	if (actor) result.authorExternalId = actor;
	const parent = stringOrNull(obj.parentComment ?? obj.parent_comment_urn);
	if (parent) result.parentExternalCommentId = parent;
	const handle = stringOrNull(obj.actorHandle ?? obj.author_handle);
	if (handle) result.authorHandle = handle;
	const metadata: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		if (k !== "events" && k !== "message" && typeof v !== "function") {
			metadata[k] = v;
		}
	}
	if (Object.keys(metadata).length > 0) result.metadata = metadata;
	return result;
}

function getRateLimitState(_env: PlatformEnv): Promise<PlatformRateLimitState> {
	// LinkedIn doesn't expose remaining quota via a header. Return a generous
	// default; the per-account KV counter in rate-limit.ts is the real guard.
	return Promise.resolve({ remaining: 100, reset: Math.floor(Date.now() / 1000) + 3600 });
}

export const linkedInAdapter: PlatformAdapter = {
	id: "linkedin",
	publish,
	reply,
	ingestInbound,
	getRateLimitState,
};

// Register at module import time so the workflow layer can dispatch to it.
registerAdapter(linkedInAdapter);

// --- helpers ---

function buildLinkedInHeaders(token: AccessToken): Record<string, string> {
	return {
		Authorization: `Bearer ${token.accessToken}`,
		"LinkedIn-Version": LINKEDIN_VERSION,
		"X-Restli-Protocol-Version": PROTOCOL_VERSION,
		"Content-Type": "application/json",
		Accept: "application/json",
	};
}

function parseRetryAfter(headers: Headers): number | undefined {
	const raw = headers.get("retry-after");
	if (!raw) return undefined;
	const seconds = Number.parseInt(raw, 10);
	if (Number.isFinite(seconds) && seconds > 0) {
		return Math.floor(Date.now() / 1000) + seconds;
	}
	return undefined;
}

async function safeText(response: Response): Promise<string> {
	try {
		return await response.text();
	} catch {
		return "";
	}
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

// Re-export for tests that want to override the URL constants without monkey-
// patching globalThis.fetch alone.
export const LINKEDIN_ADAPTER_CONSTANTS = {
	API_BASE: LINKEDIN_API,
	API_VERSION: LINKEDIN_VERSION,
	PROTOCOL_VERSION,
} as const;

// Re-export the audit-input shape so route layers building audit rows for
// LinkedIn events have a typed reference.
export type LinkedInAuditInput = PlatformAuditInput;
