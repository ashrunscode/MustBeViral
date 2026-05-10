import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbFirst, dbRun, toJson } from "../db/sql";
import { errorEnvelope, successEnvelope } from "../http/envelope";
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
	return c.json(
		successEnvelope({ subscription, stripeConfigured: hasStripeConfig(c.env) }, requestId),
	);
});

billingRoutes.post("/:workspaceId/checkout", async (c) => {
	const requestId = c.get("requestId");
	const auth = c.get("auth");
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
					message:
						"Stripe test/live keys and price IDs are not configured. Checkout is safely disabled.",
					plan: parsed.data.plan,
				},
				requestId,
			),
		);
	}

	const result = await createStripeCheckoutSession(c.env, {
		workspaceId,
		plan: parsed.data.plan,
		priceId,
		customerEmail: auth?.email,
		userId: auth?.userId,
		idempotencyKey: requestId,
	});
	if (!result.ok) {
		return c.json(
			errorEnvelope("STRIPE_ERROR", result.error.message, requestId, {
				status: result.status,
				stripeError: result.error,
			}),
			result.status === 401 || result.status === 403 ? 502 : 502,
		);
	}
	await dbRun(
		getDb(c.env),
		`INSERT INTO usage_events (id, workspace_id, event_type, provider, quantity, metadata_json)
		VALUES (?, ?, 'billing.checkout_created', 'stripe', 1, ?)`,
		[
			createId("usage"),
			workspaceId,
			toJson({
				plan: parsed.data.plan,
				sessionId: result.session.id,
				userId: auth?.userId ?? null,
			}),
		],
	);
	return c.json(successEnvelope({ checkout: result.session }, requestId));
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

	const result = await createStripePortalSession(c.env, subscription.stripe_customer_id, requestId);
	if (!result.ok) {
		return c.json(
			errorEnvelope("STRIPE_ERROR", result.error.message, requestId, {
				status: result.status,
				stripeError: result.error,
			}),
			502,
		);
	}
	return c.json(successEnvelope({ portal: result.session }, requestId));
});

interface StripeError {
	type?: string | undefined;
	code?: string | undefined;
	message: string;
}

type StripeApiResult<T> =
	| { ok: true; session: T }
	| { ok: false; status: number; error: StripeError };

interface StripeCheckoutSession extends Record<string, unknown> {
	id: string;
	url?: string;
}

interface StripePortalSession extends Record<string, unknown> {
	id: string;
	url?: string;
}

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
	input: {
		workspaceId: string;
		plan: string;
		priceId: string;
		customerEmail: string | undefined;
		userId: string | undefined;
		idempotencyKey: string;
	},
): Promise<StripeApiResult<StripeCheckoutSession>> {
	const body = new URLSearchParams({
		mode: "subscription",
		success_url: `${env.PUBLIC_APP_URL}/billing?checkout=success`,
		cancel_url: `${env.PUBLIC_APP_URL}/billing?checkout=cancelled`,
		"line_items[0][price]": input.priceId,
		"line_items[0][quantity]": "1",
		"metadata[workspace_id]": input.workspaceId,
		"metadata[plan]": input.plan,
		client_reference_id: input.workspaceId,
	});
	if (input.customerEmail) {
		body.append("customer_email", input.customerEmail);
	}
	if (input.userId) {
		body.append("metadata[user_id]", input.userId);
	}
	return await callStripe<StripeCheckoutSession>(
		env,
		"/v1/checkout/sessions",
		body,
		input.idempotencyKey,
	);
}

async function createStripePortalSession(
	env: AppHonoContext["Bindings"],
	customerId: string,
	idempotencyKey: string,
): Promise<StripeApiResult<StripePortalSession>> {
	const body = new URLSearchParams({
		customer: customerId,
		return_url: `${env.PUBLIC_APP_URL}/billing`,
	});
	return await callStripe<StripePortalSession>(
		env,
		"/v1/billing_portal/sessions",
		body,
		idempotencyKey,
	);
}

async function callStripe<T extends Record<string, unknown>>(
	env: AppHonoContext["Bindings"],
	path: string,
	body: URLSearchParams,
	idempotencyKey: string,
): Promise<StripeApiResult<T>> {
	let response: Response;
	try {
		response = await fetch(`https://api.stripe.com${path}`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
				"Content-Type": "application/x-www-form-urlencoded",
				// Stripe's idempotency contract: same key + same payload => same
				// response. The Hono request id is a UUID, unique per request,
				// safe to forward.
				"Idempotency-Key": idempotencyKey,
			},
			body,
		});
	} catch (err) {
		return {
			ok: false,
			status: 0,
			error: {
				type: "network_error",
				message: err instanceof Error ? err.message : "Stripe API request failed.",
			},
		};
	}

	const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		const stripeError = (payload.error ?? {}) as Record<string, unknown>;
		return {
			ok: false,
			status: response.status,
			error: {
				type: stringField(stripeError.type) ?? "stripe_error",
				code: stringField(stripeError.code),
				message:
					stringField(stripeError.message) ??
					`Stripe ${path} returned status ${String(response.status)}`,
			},
		};
	}

	if (typeof payload.id !== "string") {
		return {
			ok: false,
			status: response.status,
			error: { type: "invalid_response", message: "Stripe response missing session id." },
		};
	}
	return { ok: true, session: payload as T };
}

function stringField(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}
