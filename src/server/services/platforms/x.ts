/**
 * X (Twitter) adapter — implements PlatformAdapter.
 *
 * Publish: `POST /2/tweets` body `{text}`.
 * Reply:   `POST /2/tweets` body `{text, reply: {in_reply_to_tweet_id}}`.
 * Ingest:  Free + Basic tier do NOT expose webhooks. The cron handler in
 *          `src/server/index.ts::scheduled` polls `/2/users/:id/mentions`
 *          every 5 min with a `since_id` cursor stored in KV. The
 *          `ingestInbound` method here returns `{ok: false, reason: 'unsupported'}`
 *          so the webhook router can return 200-ignored without touching D1.
 *
 * Rate limits (Free tier, app-wide):
 *   POST /2/tweets       ~50 requests / 24h per user
 *   GET  /2/users/:id/mentions  ~ shared with app-wide read budget
 *
 * Our `services/platforms/rate-limit.ts` KV counter is a first-line guard;
 * X's 429 responses are still the authoritative limit and bubble up as
 * `errorCode: 'rate_limited'` with `rateLimitReset` parsed from the `x-rate-limit-reset`
 * header.
 */

import { checkAndConsume } from "./rate-limit";
import { registerAdapter } from "./registry";
import type {
	AccessToken,
	PlatformAdapter,
	PlatformEnv,
	PlatformIngestResult,
	PlatformPublishInput,
	PlatformPublishResult,
	PlatformRateLimitState,
	PlatformReplyInput,
	PlatformReplyResult,
} from "./types";

const X_TWEETS_URL = "https://api.twitter.com/2/tweets";

const RATE_LIMIT_WINDOW_SECONDS = 86_400; // 24h
const RATE_LIMIT_MAX_TWEETS = 50; // Free-tier-safe app-wide budget per account

interface DispatchEnv extends PlatformEnv {
	X_CLIENT_ID?: string | undefined;
	X_CLIENT_SECRET?: string | undefined;
}

export const xAdapter: PlatformAdapter = {
	id: "x",

	async publish(
		input: PlatformPublishInput,
		token: AccessToken,
	): Promise<PlatformPublishResult> {
		return postTweet({
			env: {}, // adapter doesn't need env for publish; rate-limit caller handles env
			token,
			text: input.caption,
		});
	},

	async reply(
		input: PlatformReplyInput,
		token: AccessToken,
	): Promise<PlatformReplyResult> {
		const started = Date.now();
		try {
			const response = await fetch(X_TWEETS_URL, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${token.accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					text: input.replyBody,
					reply: { in_reply_to_tweet_id: input.externalCommentId },
				}),
			});
			const elapsedMs = Date.now() - started;
			if (response.status === 429) {
				const reset = parseRateLimitReset(response);
				return {
					platform: "x",
					status: "failed",
					errorCode: "rate_limited",
					errorMessage: "X 429 rate-limit",
					...(reset === undefined ? {} : { rateLimitReset: reset }),
					elapsedMs,
				};
			}
			if (response.status === 401) {
				return {
					platform: "x",
					status: "failed",
					errorCode: "token_expired",
					errorMessage: "X access token expired or revoked",
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
					platform: "x",
					status: "failed",
					errorCode: "publish_error",
					errorMessage: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
					elapsedMs,
				};
			}
			const payload = toRecord(await response.json());
			const data = toRecord(payload.data);
			const externalReplyId = typeof data.id === "string" ? data.id : undefined;
			return {
				platform: "x",
				status: "sent",
				...(externalReplyId === undefined ? {} : { externalReplyId }),
				elapsedMs,
			};
		} catch (err) {
			return {
				platform: "x",
				status: "failed",
				errorCode: "network_error",
				errorMessage: err instanceof Error ? err.message : "unknown",
				elapsedMs: Date.now() - started,
			};
		}
	},

	ingestInbound(): Promise<PlatformIngestResult> {
		// X v2 at Free + Basic tiers does not deliver webhooks. The webhook
		// router returns 200-ignored when this method declines. Cron poll is
		// the real ingest path; see `src/server/index.ts::scheduled`.
		return Promise.resolve({
			platform: "x",
			ok: false,
			events: [],
			reason: "ignored",
		});
	},

	async getRateLimitState(env: PlatformEnv): Promise<PlatformRateLimitState> {
		const { getRateLimitState } = await import("./rate-limit");
		return getRateLimitState(env, "x", "app", RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_TWEETS);
	},
};

interface PostTweetInput {
	env: DispatchEnv;
	token: AccessToken;
	text: string;
}

async function postTweet(input: PostTweetInput): Promise<PlatformPublishResult> {
	const started = Date.now();
	// Best-effort rate limit pre-check (token's externalAccountId is the X user id).
	if (input.env.CACHE) {
		const rl = await checkAndConsume(input.env, {
			platform: "x",
			accountId: input.token.externalAccountId,
			max: RATE_LIMIT_MAX_TWEETS,
			windowSeconds: RATE_LIMIT_WINDOW_SECONDS,
		});
		if (!rl.ok) {
			return {
				platform: "x",
				status: "failed",
				errorCode: "rate_limited",
				errorMessage: "Local rate-limit guard exceeded (Free-tier-safe).",
				rateLimitReset: rl.reset,
				elapsedMs: Date.now() - started,
			};
		}
	}
	try {
		const response = await fetch(X_TWEETS_URL, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${input.token.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ text: input.text }),
		});
		const elapsedMs = Date.now() - started;
		if (response.status === 429) {
			const reset = parseRateLimitReset(response);
			return {
				platform: "x",
				status: "failed",
				errorCode: "rate_limited",
				errorMessage: "X 429 rate-limit",
				...(reset === undefined ? {} : { rateLimitReset: reset }),
				elapsedMs,
			};
		}
		if (response.status === 401) {
			return {
				platform: "x",
				status: "failed",
				errorCode: "token_expired",
				errorMessage: "X access token expired or revoked",
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
				platform: "x",
				status: "failed",
				errorCode: "publish_error",
				errorMessage: detail ? JSON.stringify(detail) : `status ${String(response.status)}`,
				elapsedMs,
			};
		}
		const payload = toRecord(await response.json());
		const data = toRecord(payload.data);
		const externalPostId = typeof data.id === "string" ? data.id : undefined;
		const usernameRaw = input.token.platformMetadata?.["username"];
		const username = typeof usernameRaw === "string" ? usernameRaw : undefined;
		const externalUrl =
			externalPostId && username
				? `https://x.com/${username}/status/${externalPostId}`
				: undefined;
		return {
			platform: "x",
			status: "published",
			...(externalPostId === undefined ? {} : { externalPostId }),
			...(externalUrl === undefined ? {} : { externalUrl }),
			elapsedMs,
		};
	} catch (err) {
		return {
			platform: "x",
			status: "failed",
			errorCode: "network_error",
			errorMessage: err instanceof Error ? err.message : "unknown",
			elapsedMs: Date.now() - started,
		};
	}
}

function parseRateLimitReset(response: Response): number | undefined {
	const header = response.headers.get("x-rate-limit-reset");
	if (!header) {
		return undefined;
	}
	const parsed = Number.parseInt(header, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function toRecord(value: unknown): Record<string, unknown> {
	if (value !== null && typeof value === "object" && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	return {};
}

/**
 * Poll /2/users/:id/mentions for an account. Used by the cron `scheduled`
 * handler. Returns the normalised events plus the new `since_id` cursor.
 */
export interface PollMentionsInput {
	accountId: string;
	accessToken: string;
	sinceId?: string;
}

export interface PollMentionsResult {
	ok: boolean;
	events: Array<{
		externalCommentId: string;
		authorExternalId?: string;
		authorHandle?: string;
		body: string;
		referencedTweetId?: string;
	}>;
	newestId?: string;
	errorCode?: string;
}

export async function pollXMentions(input: PollMentionsInput): Promise<PollMentionsResult> {
	const params = new URLSearchParams({
		"tweet.fields": "author_id,created_at,referenced_tweets",
		expansions: "author_id",
		"user.fields": "username",
		max_results: "10",
	});
	if (input.sinceId) {
		params.set("since_id", input.sinceId);
	}
	const url = `https://api.twitter.com/2/users/${encodeURIComponent(input.accountId)}/mentions?${params.toString()}`;
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { Authorization: `Bearer ${input.accessToken}` },
		});
	} catch (err) {
		return {
			ok: false,
			events: [],
			errorCode: err instanceof Error ? err.message : "network_error",
		};
	}
	if (response.status === 429) {
		return { ok: false, events: [], errorCode: "rate_limited" };
	}
	if (response.status === 401) {
		return { ok: false, events: [], errorCode: "token_expired" };
	}
	if (!response.ok) {
		return { ok: false, events: [], errorCode: `status_${response.status}` };
	}
	const payload = toRecord(await response.json());
	const data = Array.isArray(payload.data) ? payload.data : [];
	const includes = toRecord(payload.includes);
	const users = Array.isArray(includes.users) ? includes.users : [];
	const usersById = new Map<string, string>();
	for (const u of users) {
		if (!u || typeof u !== "object") continue;
		const rec = u as Record<string, unknown>;
		if (typeof rec.id === "string" && typeof rec.username === "string") {
			usersById.set(rec.id, rec.username);
		}
	}
	const meta = toRecord(payload.meta);
	const events: PollMentionsResult["events"] = [];
	let newestId: string | undefined;
	for (const item of data) {
		if (!item || typeof item !== "object") continue;
		const rec = item as Record<string, unknown>;
		const id = typeof rec.id === "string" ? rec.id : null;
		const text = typeof rec.text === "string" ? rec.text : "";
		if (!id) continue;
		const authorId = typeof rec.author_id === "string" ? rec.author_id : undefined;
		const referenced = Array.isArray(rec.referenced_tweets) ? rec.referenced_tweets : [];
		const refTweet =
			referenced.find(
				(r) =>
					r !== null &&
					typeof r === "object" &&
					(r as Record<string, unknown>).type === "replied_to",
			) as Record<string, unknown> | undefined;
		const referencedTweetId =
			refTweet && typeof refTweet.id === "string" ? refTweet.id : undefined;
		events.push({
			externalCommentId: id,
			...(authorId === undefined ? {} : { authorExternalId: authorId }),
			...(authorId && usersById.has(authorId) ? { authorHandle: usersById.get(authorId)! } : {}),
			body: text,
			...(referencedTweetId === undefined ? {} : { referencedTweetId }),
		});
	}
	if (typeof meta.newest_id === "string") {
		newestId = meta.newest_id;
	}
	return {
		ok: true,
		events,
		...(newestId === undefined ? {} : { newestId }),
	};
}

// Self-register on import. The route layer importing this file once is
// sufficient to make `getAdapter("x")` return this object everywhere.
registerAdapter(xAdapter);
