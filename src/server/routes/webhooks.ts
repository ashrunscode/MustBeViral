import { Hono } from "hono";

import { getDb } from "../db/client";
import { dbAll, dbFirst, dbRun, toJson } from "../db/sql";
import { errorEnvelope } from "../http/envelope";
import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { isPlatformEnabled } from "../services/platforms/feature-flags";
import { linkedInAdapter, verifyLinkedInWebhookSignature } from "../services/platforms/linkedin";
import type {
	PlatformId,
	PlatformIngestEvent,
} from "../services/platforms/types";
import { dispatchStripeEvent, type StripeEvent } from "../services/stripe/events";
import { verifyStripeWebhookSignature } from "../services/stripe/signature";
import { createId } from "../utils/id";

export const webhookRoutes = new Hono<AppHonoContext>();

webhookRoutes.post("/stripe", async (c) => {
	const requestId = c.get("requestId");
	const signature = c.req.header("stripe-signature");
	const rawBody = await c.req.raw.clone().text();
	const verification = await verifyStripeWebhookSignature(
		rawBody,
		signature,
		c.env.STRIPE_WEBHOOK_SECRET,
	);

	if (!verification.ok) {
		return c.json(
			errorEnvelope(
				"INVALID_STRIPE_SIGNATURE",
				"Stripe webhook signature verification failed.",
				requestId,
				{
					reason: verification.reason,
					signaturePresent: Boolean(signature),
				},
			),
			c.env.STRIPE_WEBHOOK_SECRET ? 400 : 501,
		);
	}

	let event: StripeEvent;
	try {
		event = JSON.parse(rawBody) as StripeEvent;
	} catch {
		return c.json(
			errorEnvelope("INVALID_WEBHOOK_JSON", "Stripe webhook payload must be JSON.", requestId),
			400,
		);
	}

	const externalEventId = event.id ?? createId("stripeevt");
	const db = getDb(c.env);

	// Idempotency: INSERT OR IGNORE on the unique (provider, external_event_id)
	// key. If a row with this id already exists and is not 'received', this is
	// a replay — return early with the prior status.
	await dbRun(
		db,
		`INSERT OR IGNORE INTO webhooks_inbox (
			id, provider, external_event_id, payload_json, status
		) VALUES (?, 'stripe', ?, ?, 'received')`,
		[createId("webhook"), externalEventId, toJson(event)],
	);
	const existing = await dbFirst<{ id: string; status: string }>(
		db,
		`SELECT id, status FROM webhooks_inbox
		 WHERE provider = 'stripe' AND external_event_id = ?
		 LIMIT 1`,
		[externalEventId],
	);
	if (!existing) {
		// Should not happen — the INSERT OR IGNORE just ran — but stay defensive.
		return c.json(
			successEnvelope(
				{ received: true, eventId: event.id ?? null, type: event.type ?? null, replay: false },
				requestId,
			),
		);
	}
	if (existing.status === "processed" || existing.status === "ignored") {
		return c.json(
			successEnvelope(
				{
					received: true,
					eventId: event.id ?? null,
					type: event.type ?? null,
					replay: true,
					previousStatus: existing.status,
				},
				requestId,
			),
		);
	}

	// Dispatch defensively: handler errors must not poison the inbox row;
	// surface them as 'failed' so retries from Stripe re-attempt.
	let dispatch;
	try {
		dispatch = await dispatchStripeEvent(c.env, db, event);
	} catch (err) {
		await dbRun(
			db,
			`UPDATE webhooks_inbox
			 SET status = 'failed', processed_at = CURRENT_TIMESTAMP
			 WHERE id = ?`,
			[existing.id],
		);
		return c.json(
			errorEnvelope("WEBHOOK_HANDLER_FAILED", "Stripe event handler raised an error.", requestId, {
				eventType: event.type ?? null,
				message: err instanceof Error ? err.message : String(err),
			}),
			500,
		);
	}

	await dbRun(
		db,
		`UPDATE webhooks_inbox
		 SET status = ?, processed_at = CURRENT_TIMESTAMP
		 WHERE id = ?`,
		[dispatch.status, existing.id],
	);

	return c.json(
		successEnvelope(
			{
				received: true,
				eventId: event.id ?? null,
				type: event.type ?? null,
				dispatched: dispatch,
			},
			requestId,
		),
	);
});

/**
 * LinkedIn comment / engagement webhook. LinkedIn signs the raw body with
 * HMAC-SHA-256 against the developer app's client secret (or webhook secret,
 * depending on subscription product).
 *
 * Fail-closed contract when ENABLE_LINKEDIN_INGEST="false": return 200 with
 * {ignored: "feature_disabled"}. Platforms penalise non-2xx responses with
 * noisy retry queues; a silent 200 drop avoids that.
 */
webhookRoutes.post("/linkedin", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabled(c.env, "linkedin", "ingest")) {
		return c.json(
			successEnvelope({ ignored: "feature_disabled", platform: "linkedin" }, requestId),
		);
	}
	const signature = c.req.header("x-linkedin-signature") ?? c.req.header("X-LinkedIn-Signature");
	const rawBody = await c.req.raw.clone().text();
	const webhookSecret = c.env.LINKEDIN_WEBHOOK_SECRET;
	if (!webhookSecret) {
		return c.json(
			errorEnvelope("LINKEDIN_WEBHOOK_NOT_CONFIGURED", "LinkedIn webhook secret missing.", requestId),
			501,
		);
	}
	const ok = await verifyLinkedInWebhookSignature(rawBody, signature ?? null, webhookSecret);
	if (!ok) {
		return c.json(
			errorEnvelope(
				"INVALID_LINKEDIN_SIGNATURE",
				"LinkedIn webhook signature verification failed.",
				requestId,
				{ signaturePresent: Boolean(signature) },
			),
			400,
		);
	}
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return c.json(
			errorEnvelope("INVALID_WEBHOOK_JSON", "LinkedIn webhook payload must be JSON.", requestId),
			400,
		);
	}
	const externalEventId = extractLinkedInEventId(payload);
	const db = getDb(c.env);
	await dbRun(
		db,
		`INSERT OR IGNORE INTO webhooks_inbox (
			id, provider, external_event_id, payload_json, status
		) VALUES (?, 'linkedin', ?, ?, 'received')`,
		[createId("webhook"), externalEventId, toJson(payload)],
	);
	const existing = await dbFirst<{ id: string; status: string }>(
		db,
		`SELECT id, status FROM webhooks_inbox
		 WHERE provider = 'linkedin' AND external_event_id = ?
		 LIMIT 1`,
		[externalEventId],
	);
	if (existing && (existing.status === "processed" || existing.status === "ignored")) {
		return c.json(
			successEnvelope({ received: true, replay: true, previousStatus: existing.status }, requestId),
		);
	}
	let ingest;
	try {
		ingest = await linkedInAdapter.ingestInbound!(payload, signature ?? null, c.env);
	} catch (err) {
		if (existing) {
			await dbRun(
				db,
				`UPDATE webhooks_inbox SET status = 'failed', processed_at = CURRENT_TIMESTAMP WHERE id = ?`,
				[existing.id],
			);
		}
		return c.json(
			errorEnvelope(
				"LINKEDIN_INGEST_FAILED",
				"LinkedIn ingest handler raised an error.",
				requestId,
				{ message: err instanceof Error ? err.message : String(err) },
			),
			500,
		);
	}
	const persistResult = await persistPlatformIngest(c.env, "linkedin", ingest.events);
	if (existing) {
		await dbRun(
			db,
			`UPDATE webhooks_inbox SET status = ?, processed_at = CURRENT_TIMESTAMP WHERE id = ?`,
			[ingest.ok ? "processed" : "ignored", existing.id],
		);
	}
	return c.json(
		successEnvelope(
			{
				received: true,
				eventsIngested: persistResult.commentsInserted,
				dmEventsCreated: persistResult.dmEventsInserted,
				ok: ingest.ok,
				reason: ingest.reason ?? null,
			},
			requestId,
		),
	);
});

// Meta subscription verification (GET). Meta calls this once when the
// developer registers the webhook endpoint with the verify_token. We respond
// with the hub.challenge as plain text if the token matches.
webhookRoutes.get("/meta", (c) => {
	const mode = c.req.query("hub.mode");
	const verifyToken = c.req.query("hub.verify_token");
	const challenge = c.req.query("hub.challenge");
	if (mode !== "subscribe") {
		return c.text("Bad request", 400);
	}
	const expected = c.env.META_WEBHOOK_VERIFY_TOKEN;
	if (!expected || verifyToken !== expected) {
		return c.text("Forbidden", 403);
	}
	return c.text(challenge ?? "", 200);
});

// Meta webhook ingest. Validates X-Hub-Signature-256 HMAC against META_APP_SECRET;
// normalises page+IG feed/comment events; persists via the shared
// persistPlatformIngest helper.
webhookRoutes.post("/meta", async (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabled(c.env, "meta", "ingest")) {
		return c.json(successEnvelope({ ignored: "feature_disabled", platform: "meta" }, requestId));
	}
	const signature = c.req.header("x-hub-signature-256") ?? c.req.header("X-Hub-Signature-256");
	const rawBody = await c.req.raw.clone().text();
	const appSecret = c.env.META_APP_SECRET;
	if (!appSecret) {
		return c.json(
			errorEnvelope(
				"WEBHOOK_SECRET_MISSING",
				"Set META_APP_SECRET via wrangler secret put.",
				requestId,
			),
			501,
		);
	}
	const { verifyMetaWebhookSignature, normaliseMetaPayload } = await import(
		"../services/platforms/meta"
	);
	const ok = await verifyMetaWebhookSignature(rawBody, signature ?? null, appSecret);
	if (!ok) {
		return c.json(
			errorEnvelope("INVALID_META_SIGNATURE", "Meta webhook signature did not verify.", requestId),
			400,
		);
	}
	let payload: unknown;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return c.json(
			errorEnvelope("INVALID_WEBHOOK_JSON", "Meta webhook body was not JSON.", requestId),
			400,
		);
	}
	const externalEventId = extractMetaEventId(payload);
	const db = getDb(c.env);
	await dbRun(
		db,
		`INSERT OR IGNORE INTO webhooks_inbox (
			id, provider, external_event_id, payload_json, status
		) VALUES (?, 'meta', ?, ?, 'received')`,
		[createId("webhook"), externalEventId, toJson(payload)],
	);
	const existing = await dbFirst<{ id: string; status: string }>(
		db,
		`SELECT id, status FROM webhooks_inbox
		 WHERE provider = 'meta' AND external_event_id = ?
		 LIMIT 1`,
		[externalEventId],
	);
	if (existing && (existing.status === "processed" || existing.status === "ignored")) {
		return c.json(
			successEnvelope(
				{ received: true, replay: true, previousStatus: existing.status },
				requestId,
			),
		);
	}
	const events = normaliseMetaPayload(payload);
	const persistResult = await persistPlatformIngest(c.env, "meta", events);
	if (existing) {
		await dbRun(
			db,
			`UPDATE webhooks_inbox SET status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE id = ?`,
			[existing.id],
		);
	}
	return c.json(
		successEnvelope(
			{
				received: true,
				eventsIngested: persistResult.commentsInserted,
				dmEventsCreated: persistResult.dmEventsInserted,
				ok: true,
			},
			requestId,
		),
	);
});

// TikTok webhook stub (Phase E implements the full ingest path).
webhookRoutes.post("/tiktok", (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabled(c.env, "tiktok", "ingest")) {
		return c.json(successEnvelope({ ignored: "feature_disabled", platform: "tiktok" }, requestId));
	}
	return c.json(
		successEnvelope({ ignored: "platform_not_ready", platform: "tiktok" }, requestId),
	);
});

function extractMetaEventId(payload: unknown): string {
	if (!payload || typeof payload !== "object") {
		return createId("metaevt");
	}
	const obj = payload as Record<string, unknown>;
	const entries: unknown[] = Array.isArray(obj.entry) ? obj.entry : [];
	if (entries.length === 0) return createId("metaevt");
	const first: unknown = entries[0];
	if (!first || typeof first !== "object") return createId("metaevt");
	const firstObj = first as Record<string, unknown>;
	if (typeof firstObj.id === "string" && typeof firstObj.time === "number") {
		return `${firstObj.id}:${firstObj.time}`;
	}
	if (typeof firstObj.id === "string") return firstObj.id;
	return createId("metaevt");
}

/**
 * X (Twitter) webhook stub. X v2 at Free + Basic tiers does NOT deliver
 * webhooks; mentions are polled via the scheduled cron handler. We accept
 * the path so platform-side configuration is uniform (no surprise 404s),
 * but always respond with 200-ignored. Future tier upgrades can extend
 * this handler with real signature verification.
 */
webhookRoutes.post("/x", (c) => {
	const requestId = c.get("requestId");
	if (!isPlatformEnabled(c.env, "x", "ingest")) {
		return c.json(successEnvelope({ ignored: "feature_disabled", platform: "x" }, requestId));
	}
	// Even with the flag on, X has no webhook at Free/Basic; cron poll is the
	// real path. Drop the payload silently with 200 to avoid retry storms.
	return c.json(
		successEnvelope(
			{
				ignored: "unsupported_tier",
				platform: "x",
				note: "X v2 Free/Basic tiers do not deliver webhooks. Mentions are polled via the scheduled cron handler.",
			},
			requestId,
		),
	);
});

interface PersistResult {
	commentsInserted: number;
	dmEventsInserted: number;
}

/**
 * Insert platform_comments + dm_events(status='received') rows for the events
 * normalised by the adapter. The brand_id + workspace_id are resolved via the
 * matching published_post row (when externalPostId is present) or the most
 * recent social_account_tokens row for the brand+platform.
 */
async function persistPlatformIngest(
	env: AppHonoContext["Bindings"],
	platform: PlatformId,
	events: PlatformIngestEvent[],
): Promise<PersistResult> {
	if (events.length === 0) {
		return { commentsInserted: 0, dmEventsInserted: 0 };
	}
	const db = getDb(env);
	let commentsInserted = 0;
	let dmEventsInserted = 0;
	for (const event of events) {
		let publishedPostId: string | null = null;
		let brandId: string | null = null;
		if (event.externalPostId) {
			const published = await dbFirst<{ id: string; brand_id: string }>(
				db,
				`SELECT id, brand_id FROM published_posts WHERE platform = ? AND external_post_id = ? LIMIT 1`,
				[platform, event.externalPostId],
			);
			if (published) {
				publishedPostId = published.id;
				brandId = published.brand_id;
			}
		}
		if (!brandId) {
			// Mention-only event with no owned post — fall back to the most
			// recent social_account_tokens row for this platform.
			const tokens = await dbAll<{ brand_id: string }>(
				db,
				`SELECT brand_id FROM social_account_tokens
				 WHERE platform = ? AND status = 'active'
				 ORDER BY last_used_at DESC, created_at DESC
				 LIMIT 1`,
				[platform],
			);
			if (tokens[0]) {
				brandId = tokens[0].brand_id;
			}
		}
		if (!brandId) {
			// No brand context — drop the event silently. webhooks_inbox already
			// stores the raw payload for forensic inspection.
			continue;
		}
		const commentId = createId("pcom");
		await dbRun(
			db,
			`INSERT OR IGNORE INTO platform_comments (
				id, brand_id, published_post_id, platform, external_comment_id,
				parent_external_comment_id, author_external_id, author_handle, body, metadata_json
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				commentId,
				brandId,
				publishedPostId,
				platform,
				event.externalCommentId,
				event.parentExternalCommentId ?? null,
				event.authorExternalId ?? null,
				event.authorHandle ?? null,
				event.body,
				toJson(event.metadata ?? {}),
			],
		);
		commentsInserted += 1;
		const dmEventId = createId("dme");
		await dbRun(
			db,
			`INSERT INTO dm_events (id, brand_id, rule_id, platform, status, event_json)
			VALUES (?, ?, NULL, ?, 'received', ?)`,
			[
				dmEventId,
				brandId,
				platform,
				toJson({
					platform_comment_id: commentId,
					external_comment_id: event.externalCommentId,
					external_post_id: event.externalPostId ?? null,
					author_external_id: event.authorExternalId ?? null,
					body: event.body,
				}),
			],
		);
		dmEventsInserted += 1;
	}
	return { commentsInserted, dmEventsInserted };
}

function extractLinkedInEventId(payload: unknown): string {
	if (!payload || typeof payload !== "object") {
		return createId("linkedinevt");
	}
	const obj = payload as Record<string, unknown>;
	if (typeof obj.eventUrn === "string") return obj.eventUrn;
	if (typeof obj.id === "string") return obj.id;
	if (Array.isArray(obj.events) && obj.events.length > 0) {
		const first = obj.events[0] as Record<string, unknown>;
		if (typeof first.eventUrn === "string") return first.eventUrn;
		if (typeof first.id === "string") return first.id;
	}
	return createId("linkedinevt");
}
