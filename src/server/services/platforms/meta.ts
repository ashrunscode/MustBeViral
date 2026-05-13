/**
 * Meta (Facebook Page + Instagram Business) adapter — implements PlatformAdapter.
 *
 * Publish:
 *   - Facebook Page: POST /{page-id}/feed body {message, access_token}
 *   - Instagram Business: 2-step container API
 *     1. POST /{ig-user-id}/media body {caption, image_url} → container_id
 *     2. POST /{ig-user-id}/media_publish body {creation_id}
 *
 *   The adapter chooses the FB or IG path based on the token's
 *   platform_metadata.surface ("facebook_page" | "instagram_business").
 *   When a brand has both connected (one social_account_tokens row per
 *   surface), the callback writes two rows; the publish step iterates them
 *   independently in ApprovalSchedulingWorkflow.
 *
 * Reply:
 *   - FB comment: POST /{comment-id}/comments body {message, access_token}
 *   - IG comment: POST /{comment-id}/replies body {message, access_token}
 *
 * Ingest webhook:
 *   - Meta delivers payloads with X-Hub-Signature-256: sha256=<hex>
 *   - Signature verified against META_APP_SECRET via HMAC-SHA-256
 *   - Body shape: { object: "page"|"instagram", entry: [{ id, changes: [{ value, field }] }] }
 *
 * Subscription verification (GET): Meta sends ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
 *   - Must match META_WEBHOOK_VERIFY_TOKEN
 *   - Respond 200 with hub.challenge as plain text
 */

import { registerAdapter } from "./registry";
import type {
	AccessToken,
	PlatformAdapter,
	PlatformEnv,
	PlatformIngestEvent,
	PlatformIngestResult,
	PlatformPublishInput,
	PlatformPublishResult,
	PlatformReplyInput,
	PlatformReplyResult,
} from "./types";

const META_GRAPH_VERSION = "v18.0";
const META_GRAPH_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const META_INSTAGRAM_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const metaAdapter: PlatformAdapter = {
	id: "meta",

	async publish(
		input: PlatformPublishInput,
		token: AccessToken,
	): Promise<PlatformPublishResult> {
		const surfaceRaw = token.platformMetadata?.["surface"];
		const surface = typeof surfaceRaw === "string" ? surfaceRaw : "facebook_page";
		if (surface === "instagram_business") {
			return publishInstagram(input, token);
		}
		return publishFacebook(input, token);
	},

	async reply(
		input: PlatformReplyInput,
		token: AccessToken,
	): Promise<PlatformReplyResult> {
		const surfaceRaw = token.platformMetadata?.["surface"];
		const surface = typeof surfaceRaw === "string" ? surfaceRaw : "facebook_page";
		const path = surface === "instagram_business" ? "replies" : "comments";
		const url = `${META_GRAPH_BASE}/${encodeURIComponent(input.externalCommentId)}/${path}`;
		const started = Date.now();
		try {
			const params = new URLSearchParams({
				message: input.replyBody,
				access_token: token.accessToken,
			});
			const response = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: params.toString(),
			});
			const elapsedMs = Date.now() - started;
			if (response.status === 429) {
				return {
					platform: "meta",
					status: "failed",
					errorCode: "rate_limited",
					errorMessage: "Meta 429 rate-limit",
					elapsedMs,
				};
			}
			if (response.status === 401 || response.status === 190) {
				return {
					platform: "meta",
					status: "failed",
					errorCode: "token_expired",
					errorMessage: "Meta access token invalid or expired",
					elapsedMs,
				};
			}
			if (!response.ok) {
				let detail: unknown = null;
				try {
					detail = await response.json();
				} catch {
					// ignore
				}
				return {
					platform: "meta",
					status: "failed",
					errorCode: "reply_error",
					errorMessage: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
					elapsedMs,
				};
			}
			const payload = toRecord(await response.json());
			const id = typeof payload.id === "string" ? payload.id : undefined;
			return {
				platform: "meta",
				status: "sent",
				...(id === undefined ? {} : { externalReplyId: id }),
				elapsedMs,
			};
		} catch (err) {
			return {
				platform: "meta",
				status: "failed",
				errorCode: "network_error",
				errorMessage: err instanceof Error ? err.message : "unknown",
				elapsedMs: Date.now() - started,
			};
		}
	},

	ingestInbound(
		payload: unknown,
		signature: string | null,
		env: PlatformEnv,
	): Promise<PlatformIngestResult> {
		const appSecret = (env as { META_APP_SECRET?: string }).META_APP_SECRET;
		if (!appSecret) {
			return Promise.resolve({ platform: "meta", ok: false, events: [], reason: "ignored" });
		}
		if (!signature) {
			return Promise.resolve({
				platform: "meta",
				ok: false,
				events: [],
				reason: "invalid_signature",
			});
		}
		// Adapter-level normalisation only; route handler verifies the
		// HMAC-SHA-256 signature against the raw body before calling this.
		const events = normaliseMetaPayload(payload);
		return Promise.resolve({
			platform: "meta",
			ok: true,
			events,
		});
	},
};

async function publishFacebook(
	input: PlatformPublishInput,
	token: AccessToken,
): Promise<PlatformPublishResult> {
	const pageId = token.externalAccountId;
	const url = `${META_GRAPH_BASE}/${encodeURIComponent(pageId)}/feed`;
	const started = Date.now();
	try {
		const params = new URLSearchParams({
			message: input.caption,
			access_token: token.accessToken,
		});
		const response = await fetch(url, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: params.toString(),
		});
		return mapPublishResponse(response, started, pageId, "facebook_page");
	} catch (err) {
		return {
			platform: "meta",
			status: "failed",
			errorCode: "network_error",
			errorMessage: err instanceof Error ? err.message : "unknown",
			elapsedMs: Date.now() - started,
		};
	}
}

async function publishInstagram(
	input: PlatformPublishInput,
	token: AccessToken,
): Promise<PlatformPublishResult> {
	const igRaw = token.platformMetadata?.["instagram_business_account_id"];
	const igUserId = typeof igRaw === "string" ? igRaw : token.externalAccountId;
	const started = Date.now();
	const imageUrlRaw =
		token.platformMetadata?.["image_url"] ?? input.platformMetadata?.["image_url"];
	const imageUrl = typeof imageUrlRaw === "string" ? imageUrlRaw : "";
	if (!imageUrl) {
		return {
			platform: "meta",
			status: "failed",
			errorCode: "instagram_missing_image_url",
			errorMessage:
				"Instagram publish requires an image_url (R2 presigned URL or public image). Pass via platformMetadata.image_url.",
			elapsedMs: 0,
		};
	}
	try {
		// Step 1: create container
		const createParams = new URLSearchParams({
			image_url: imageUrl,
			caption: input.caption,
			access_token: token.accessToken,
		});
		const createUrl = `${META_INSTAGRAM_BASE}/${encodeURIComponent(igUserId)}/media`;
		const createResponse = await fetch(createUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: createParams.toString(),
		});
		if (!createResponse.ok) {
			return mapPublishResponse(createResponse, started, igUserId, "instagram_business");
		}
		const createBody = toRecord(await createResponse.json());
		const containerId = typeof createBody.id === "string" ? createBody.id : null;
		if (!containerId) {
			return {
				platform: "meta",
				status: "failed",
				errorCode: "instagram_container_missing_id",
				errorMessage: "IG container creation did not return an id",
				elapsedMs: Date.now() - started,
			};
		}
		// Step 2: publish container
		const publishParams = new URLSearchParams({
			creation_id: containerId,
			access_token: token.accessToken,
		});
		const publishUrl = `${META_INSTAGRAM_BASE}/${encodeURIComponent(igUserId)}/media_publish`;
		const publishResponse = await fetch(publishUrl, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: publishParams.toString(),
		});
		return mapPublishResponse(publishResponse, started, igUserId, "instagram_business");
	} catch (err) {
		return {
			platform: "meta",
			status: "failed",
			errorCode: "network_error",
			errorMessage: err instanceof Error ? err.message : "unknown",
			elapsedMs: Date.now() - started,
		};
	}
}

async function mapPublishResponse(
	response: Response,
	started: number,
	subjectId: string,
	surface: "facebook_page" | "instagram_business",
): Promise<PlatformPublishResult> {
	const elapsedMs = Date.now() - started;
	if (response.status === 429) {
		return {
			platform: "meta",
			status: "failed",
			errorCode: "rate_limited",
			errorMessage: "Meta 429 rate-limit",
			elapsedMs,
		};
	}
	if (response.status === 401 || response.status === 190) {
		return {
			platform: "meta",
			status: "failed",
			errorCode: "token_expired",
			errorMessage: "Meta access token invalid or expired",
			elapsedMs,
		};
	}
	if (!response.ok) {
		let detail: unknown = null;
		try {
			detail = await response.json();
		} catch {
			// ignore
		}
		return {
			platform: "meta",
			status: "failed",
			errorCode: "publish_error",
			errorMessage: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
			elapsedMs,
		};
	}
	const payload = toRecord(await response.json());
	const externalPostId = typeof payload.id === "string" ? payload.id : undefined;
	const externalUrl =
		externalPostId && surface === "facebook_page"
			? `https://www.facebook.com/${subjectId}/posts/${externalPostId}`
			: externalPostId && surface === "instagram_business"
				? `https://www.instagram.com/p/${externalPostId}`
				: undefined;
	return {
		platform: "meta",
		status: "published",
		...(externalPostId === undefined ? {} : { externalPostId }),
		...(externalUrl === undefined ? {} : { externalUrl }),
		elapsedMs,
	};
}

export function normaliseMetaPayload(payload: unknown): PlatformIngestEvent[] {
	if (!payload || typeof payload !== "object") return [];
	const obj = payload as Record<string, unknown>;
	const entries = Array.isArray(obj.entry) ? obj.entry : [];
	const events: PlatformIngestEvent[] = [];
	const receivedAt = new Date().toISOString();
	for (const entry of entries) {
		if (!entry || typeof entry !== "object") continue;
		const entryObj = entry as Record<string, unknown>;
		const changes = Array.isArray(entryObj.changes) ? entryObj.changes : [];
		for (const change of changes) {
			if (!change || typeof change !== "object") continue;
			const changeObj = change as Record<string, unknown>;
			const field = typeof changeObj.field === "string" ? changeObj.field : "";
			const value = toRecord(changeObj.value);
			if (field === "feed" || field === "comments") {
				const commentId =
					typeof value.comment_id === "string"
						? value.comment_id
						: typeof value.id === "string"
							? value.id
							: null;
				if (!commentId) continue;
				const fromObj = toRecord(value.from);
				events.push({
					externalCommentId: commentId,
					...(typeof value.post_id === "string" ? { externalPostId: value.post_id } : {}),
					...(typeof value.parent_id === "string"
						? { parentExternalCommentId: value.parent_id }
						: {}),
					...(typeof fromObj.id === "string" ? { authorExternalId: fromObj.id } : {}),
					...(typeof fromObj.name === "string" ? { authorHandle: fromObj.name } : {}),
					body: typeof value.message === "string" ? value.message : "",
					receivedAt,
					metadata: { field, surface: typeof obj.object === "string" ? obj.object : null },
				});
			}
		}
	}
	return events;
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw body.
 * Header format: "sha256=<hex>". HMAC key is the META_APP_SECRET.
 */
export async function verifyMetaWebhookSignature(
	rawBody: string,
	signatureHeader: string | null,
	appSecret: string,
): Promise<boolean> {
	if (!signatureHeader) return false;
	const match = signatureHeader.match(/^sha256=([0-9a-f]+)$/i);
	if (!match) return false;
	const provided = match[1]!;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(appSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const computed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
	const computedHex = Array.from(new Uint8Array(computed), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
	return timingSafeEqualHex(provided.toLowerCase(), computedHex);
}

function timingSafeEqualHex(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i += 1) {
		diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return diff === 0;
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

registerAdapter(metaAdapter);
