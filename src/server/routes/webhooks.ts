import { Hono } from "hono";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import { errorEnvelope } from "../http/envelope";
import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
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
