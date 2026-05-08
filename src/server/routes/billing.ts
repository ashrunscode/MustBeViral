import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { parseJsonBody } from "../http/validation";
import { requireAuth } from "../middleware/auth";
import { requireWorkspaceMember } from "../middleware/rbac";
import { createId } from "../utils/id";

export const billingRoutes = new Hono<AppHonoContext>();

const checkoutSchema = z.object({
	plan: z.enum(["starter", "growth", "agency", "managed"]).default("starter"),
});

billingRoutes.use("/:workspaceId/*", requireAuth(), requireWorkspaceMember());
billingRoutes.use("/:workspaceId", requireAuth(), requireWorkspaceMember());

billingRoutes.get("/:workspaceId", async (c) => {
	const requestId = c.get("requestId");
	const subscription = await dbFirst(
		getDb(c.env),
		`SELECT id, workspace_id, stripe_customer_id, stripe_subscription_id, plan, status,
			current_period_end, metadata_json, created_at, updated_at
		FROM subscriptions
		WHERE workspace_id = ?
		LIMIT 1`,
		[c.get("workspaceId") ?? ""],
	);
	return c.json(successEnvelope({ subscription, stripeConfigured: hasStripeConfig(c.env) }, requestId));
});

billingRoutes.post("/:workspaceId/checkout", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, checkoutSchema);
	if (!parsed.ok) {
		return parsed.response;
	}
	const workspaceId = c.get("workspaceId") ?? "";
	const priceId = priceForPlan(c.env, parsed.data.plan);
	if (!c.env.STRIPE_SECRET_KEY || !priceId) {
		return c.json(
			successEnvelope(
				{
					configured: false,
					message: "Stripe test/live keys and price IDs are not configured. Checkout is safely disabled.",
					plan: parsed.data.plan,
				},
				requestId,
			),
		);
	}

	const session = await createStripeCheckoutSession(c.env, {
		workspaceId,
		plan: parsed.data.plan,
		priceId,
	});
	await dbRun(
		getDb(c.env),
		`INSERT INTO usage_events (id, workspace_id, event_type, provider, quantity, metadata_json)
		VALUES (?, ?, 'billing.checkout_created', 'stripe', 1, ?)`,
		[createId("usage"), workspaceId, toJson({ plan: parsed.data.plan, sessionId: session.id })],
	);
	return c.json(successEnvelope({ checkout: session }, requestId));
});

billingRoutes.post("/:workspaceId/portal", async (c) => {
	const requestId = c.get("requestId");
	const workspaceId = c.get("workspaceId") ?? "";
	const subscription = await dbFirst<{ stripe_customer_id: string | null }>(
		getDb(c.env),
		"SELECT stripe_customer_id FROM subscriptions WHERE workspace_id = ? LIMIT 1",
		[workspaceId],
	);
	if (!c.env.STRIPE_SECRET_KEY || !subscription?.stripe_customer_id) {
		return c.json(
			successEnvelope(
				{
					configured: false,
					message: "Stripe portal is safely disabled until a Stripe customer exists.",
				},
				requestId,
			),
		);
	}

	const portal = await createStripePortalSession(c.env, subscription.stripe_customer_id);
	return c.json(successEnvelope({ portal }, requestId));
});

function hasStripeConfig(env: AppHonoContext["Bindings"]): boolean {
	return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET);
}

function priceForPlan(env: AppHonoContext["Bindings"], plan: string): string | undefined {
	if (plan === "growth") {
		return env.STRIPE_PRICE_GROWTH;
	}
	if (plan === "agency") {
		return env.STRIPE_PRICE_AGENCY;
	}
	if (plan === "managed") {
		return env.STRIPE_PRICE_MANAGED;
	}
	return env.STRIPE_PRICE_STARTER;
}

async function createStripeCheckoutSession(
	env: AppHonoContext["Bindings"],
	input: { workspaceId: string; plan: string; priceId: string },
): Promise<Record<string, unknown>> {
	const body = new URLSearchParams({
		mode: "subscription",
		success_url: `${env.PUBLIC_APP_URL}/billing?checkout=success`,
		cancel_url: `${env.PUBLIC_APP_URL}/billing?checkout=cancelled`,
		"line_items[0][price]": input.priceId,
		"line_items[0][quantity]": "1",
		"metadata[workspace_id]": input.workspaceId,
		"metadata[plan]": input.plan,
	});
	const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	});
	return response.json<Record<string, unknown>>();
}

async function createStripePortalSession(
	env: AppHonoContext["Bindings"],
	customerId: string,
): Promise<Record<string, unknown>> {
	const body = new URLSearchParams({
		customer: customerId,
		return_url: `${env.PUBLIC_APP_URL}/billing`,
	});
	const response = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body,
	});
	return response.json<Record<string, unknown>>();
}
