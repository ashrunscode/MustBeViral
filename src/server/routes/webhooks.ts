import { Hono } from "hono";

import { getDb } from "../db/client";
import { dbRun, toJson } from "../db/sql";
import { errorEnvelope } from "../http/envelope";
import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { verifyStripeWebhookSignature } from "../services/stripe/signature";
import { createId } from "../utils/id";

export const webhookRoutes = new Hono<AppHonoContext>();

webhookRoutes.post("/stripe", async (c) => {
	const requestId = c.get("requestId");
	const signature = c.req.header("stripe-signature");
	const rawBody = await c.req.raw.clone().text();
	const verification = await verifyStripeWebhookSignature(rawBody, signature, c.env.STRIPE_WEBHOOK_SECRET);

	if (!verification.ok) {
		return c.json(
			errorEnvelope("INVALID_STRIPE_SIGNATURE", "Stripe webhook signature verification failed.", requestId, {
				reason: verification.reason,
				signaturePresent: Boolean(signature),
			}),
			c.env.STRIPE_WEBHOOK_SECRET ? 400 : 501,
		);
	}

	let event: { id?: string; type?: string; data?: unknown };
	try {
		event = JSON.parse(rawBody) as { id?: string; type?: string; data?: unknown };
	} catch {
		return c.json(errorEnvelope("INVALID_WEBHOOK_JSON", "Stripe webhook payload must be JSON.", requestId), 400);
	}

	await dbRun(
		getDb(c.env),
		`INSERT OR IGNORE INTO webhooks_inbox (
			id, provider, external_event_id, payload_json, status
		) VALUES (?, 'stripe', ?, ?, 'received')`,
		[createId("webhook"), event.id ?? createId("stripeevt"), toJson(event)],
	);

	return c.json(successEnvelope({ received: true, eventId: event.id ?? null, type: event.type ?? null }, requestId));
});
