/**
 * TikTok for Business adapter — implements PlatformAdapter.
 *
 * Publish (video-first; image via Photo Mode):
 *   1. POST /v2/post/publish/inbox/video/init/ with `post_info` + `source_info`
 *      → publish_id
 *   2. (For URL-source uploads, TikTok pulls the video from `video_url`)
 *   3. Status poll via /v2/post/publish/status/fetch/ → result code
 *
 *   For Phase E we ship the publish_init call. The pull-then-publish lifecycle
 *   is platform-driven; the workflow polls /status/fetch on a retry. The
 *   adapter returns 'published' when init returns successfully (TikTok flips
 *   the post to inbox/draft state and the user confirms in-app). Operators
 *   approve in MustBeViral; TikTok requires per-post in-app confirmation
 *   for community guidelines compliance.
 *
 * Reply (Comment Management API):
 *   POST /v2/comment/reply/create/ body {video_id, comment_id, text}
 *
 * Webhook:
 *   POST /api/webhooks/tiktok with X-Tiktok-Signature header.
 *   Signature = HEX(HMAC_SHA256(client_secret, timestamp + body))
 *
 * For Sandbox Mode (used during build), all of these endpoints are available
 * against test accounts only.
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

const TIKTOK_POST_PUBLISH_INIT_URL =
	"https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
const TIKTOK_COMMENT_REPLY_URL =
	"https://open.tiktokapis.com/v2/comment/reply/create/";

export const tiktokAdapter: PlatformAdapter = {
	id: "tiktok",

	async publish(
		input: PlatformPublishInput,
		token: AccessToken,
	): Promise<PlatformPublishResult> {
		const videoUrlRaw =
			token.platformMetadata?.["video_url"] ?? input.platformMetadata?.["video_url"];
		const videoUrl = typeof videoUrlRaw === "string" ? videoUrlRaw : "";
		if (!videoUrl) {
			return {
				platform: "tiktok",
				status: "failed",
				errorCode: "tiktok_missing_video_url",
				errorMessage:
					"TikTok publish requires a video_url (R2 presigned URL or public video). Pass via platformMetadata.video_url.",
				elapsedMs: 0,
			};
		}
		const started = Date.now();
		try {
			const response = await fetch(TIKTOK_POST_PUBLISH_INIT_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					post_info: {
						title: input.caption.slice(0, 150),
						privacy_level: "MUTUAL_FOLLOW_FRIENDS",
						disable_comment: false,
						disable_duet: false,
						disable_stitch: false,
					},
					source_info: {
						source: "PULL_FROM_URL",
						video_url: videoUrl,
					},
				}),
			});
			return mapTikTokPublishResponse(response, started);
		} catch (err) {
			return {
				platform: "tiktok",
				status: "failed",
				errorCode: "network_error",
				errorMessage: err instanceof Error ? err.message : "unknown",
				elapsedMs: Date.now() - started,
			};
		}
	},

	async reply(
		input: PlatformReplyInput,
		token: AccessToken,
	): Promise<PlatformReplyResult> {
		const videoIdRaw =
			input.platformMetadata?.["video_id"] ?? token.platformMetadata?.["video_id"];
		const videoId = typeof videoIdRaw === "string" ? videoIdRaw : "";
		if (!videoId) {
			return {
				platform: "tiktok",
				status: "failed",
				errorCode: "tiktok_missing_video_id",
				errorMessage:
					"TikTok comment reply requires video_id (the video the comment is on). Pass via platformMetadata.video_id.",
				elapsedMs: 0,
			};
		}
		const started = Date.now();
		try {
			const response = await fetch(TIKTOK_COMMENT_REPLY_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					video_id: videoId,
					comment_id: input.externalCommentId,
					text: input.replyBody,
				}),
			});
			const elapsedMs = Date.now() - started;
			if (response.status === 429) {
				return {
					platform: "tiktok",
					status: "failed",
					errorCode: "rate_limited",
					errorMessage: "TikTok 429 rate-limit",
					elapsedMs,
				};
			}
			if (response.status === 401) {
				return {
					platform: "tiktok",
					status: "failed",
					errorCode: "token_expired",
					errorMessage: "TikTok access token invalid or expired",
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
					platform: "tiktok",
					status: "failed",
					errorCode: "reply_error",
					errorMessage: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
					elapsedMs,
				};
			}
			const payload = toRecord(await response.json());
			const data = toRecord(payload.data);
			const replyComment = toRecord(data.reply_comment);
			const id = typeof replyComment.comment_id === "string" ? replyComment.comment_id : undefined;
			return {
				platform: "tiktok",
				status: "sent",
				...(id === undefined ? {} : { externalReplyId: id }),
				elapsedMs,
			};
		} catch (err) {
			return {
				platform: "tiktok",
				status: "failed",
				errorCode: "network_error",
				errorMessage: err instanceof Error ? err.message : "unknown",
				elapsedMs: Date.now() - started,
			};
		}
	},

	ingestInbound(
		payload: unknown,
		_signature: string | null,
		_env: PlatformEnv,
	): Promise<PlatformIngestResult> {
		// Verification is handled in the route layer. Normalisation only here.
		const events = normaliseTikTokPayload(payload);
		return Promise.resolve({
			platform: "tiktok",
			ok: true,
			events,
		});
	},
};

async function mapTikTokPublishResponse(
	response: Response,
	started: number,
): Promise<PlatformPublishResult> {
	const elapsedMs = Date.now() - started;
	if (response.status === 429) {
		return {
			platform: "tiktok",
			status: "failed",
			errorCode: "rate_limited",
			errorMessage: "TikTok 429 rate-limit",
			elapsedMs,
		};
	}
	if (response.status === 401) {
		return {
			platform: "tiktok",
			status: "failed",
			errorCode: "token_expired",
			errorMessage: "TikTok access token invalid or expired",
			elapsedMs,
		};
	}
	const payload = toRecord(await response.json().catch(() => ({})));
	if (!response.ok) {
		const err = toRecord(payload.error);
		return {
			platform: "tiktok",
			status: "failed",
			errorCode: typeof err.code === "string" ? err.code : "publish_error",
			errorMessage:
				typeof err.message === "string" ? err.message : `status ${String(response.status)}`,
			elapsedMs,
		};
	}
	// TikTok also surfaces errors inside payload.error.code !== "ok".
	const errObj = toRecord(payload.error);
	const errCode = typeof errObj.code === "string" ? errObj.code : "ok";
	if (errCode !== "ok" && errCode !== "") {
		return {
			platform: "tiktok",
			status: "failed",
			errorCode: errCode,
			errorMessage: typeof errObj.message === "string" ? errObj.message : "TikTok returned error",
			elapsedMs,
		};
	}
	const data = toRecord(payload.data);
	const publishId = typeof data.publish_id === "string" ? data.publish_id : undefined;
	return {
		platform: "tiktok",
		status: "published",
		...(publishId === undefined ? {} : { externalPostId: publishId }),
		elapsedMs,
	};
}

export function normaliseTikTokPayload(payload: unknown): PlatformIngestEvent[] {
	if (!payload || typeof payload !== "object") return [];
	const obj = payload as Record<string, unknown>;
	const events: PlatformIngestEvent[] = [];
	const receivedAt = new Date().toISOString();
	// TikTok webhook format (Phase E baseline; may evolve):
	// { event: "comment", client_key, user_openid, create_time, content: {comment_id, video_id, text, ...} }
	if (obj.event === "comment") {
		const content = toRecord(obj.content);
		const commentId =
			typeof content.comment_id === "string"
				? content.comment_id
				: typeof content.id === "string"
					? content.id
					: null;
		if (commentId) {
			events.push({
				externalCommentId: commentId,
				...(typeof content.video_id === "string" ? { externalPostId: content.video_id } : {}),
				...(typeof obj.user_openid === "string"
					? { authorExternalId: obj.user_openid }
					: {}),
				body: typeof content.text === "string" ? content.text : "",
				receivedAt,
				metadata: { event: "comment", platform_source: "tiktok" },
			});
		}
	}
	return events;
}

/**
 * Verify TikTok's X-Tiktok-Signature header.
 * Header format: just hex of HMAC_SHA256(client_secret, timestamp + "\n" + body).
 */
export async function verifyTikTokWebhookSignature(
	timestamp: string,
	rawBody: string,
	signatureHeader: string | null,
	clientSecret: string,
): Promise<boolean> {
	if (!signatureHeader) return false;
	if (!/^[0-9a-f]+$/i.test(signatureHeader)) return false;
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(clientSecret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const message = new TextEncoder().encode(`${timestamp}\n${rawBody}`);
	const computed = await crypto.subtle.sign("HMAC", key, message);
	const computedHex = Array.from(new Uint8Array(computed), (b) =>
		b.toString(16).padStart(2, "0"),
	).join("");
	return timingSafeEqualHex(signatureHeader.toLowerCase(), computedHex);
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

registerAdapter(tiktokAdapter);
