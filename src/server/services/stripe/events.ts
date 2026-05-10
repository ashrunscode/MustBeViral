import { createId } from "../../utils/id";

export type StripeEventType =
	| "checkout.session.completed"
	| "customer.subscription.created"
	| "customer.subscription.updated"
	| "customer.subscription.deleted"
	| "invoice.payment_failed"
	| (string & {});

export interface StripeEvent {
	id?: string;
	type?: StripeEventType;
	data?: { object?: Record<string, unknown> };
}

export type SubscriptionPlan = "starter" | "growth" | "agency" | "managed";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

/**
 * Subset of `Env` the dispatcher actually reads. Defined structurally so this
 * file does not need access to the Cloudflare ambient types — keeps it
 * compilable in both the cloudflare and node TS projects (the latter owns
 * the unit tests).
 */
export interface EventDispatchEnv {
	STRIPE_PRICE_STARTER?: string | undefined;
	STRIPE_PRICE_GROWTH?: string | undefined;
	STRIPE_PRICE_AGENCY?: string | undefined;
	STRIPE_PRICE_MANAGED?: string | undefined;
}

/**
 * Minimal `D1Database` surface used by the dispatcher. Real `D1Database`
 * (from worker-configuration.d.ts) is structurally compatible — the call
 * site in `routes/webhooks.ts` passes `getDb(c.env)` directly.
 */
export interface DispatchDb {
	prepare(sql: string): DispatchPreparedStatement;
}

export interface DispatchPreparedStatement {
	bind(...values: ReadonlyArray<unknown>): DispatchPreparedStatement;
	// Returns whatever the underlying D1 statement.run() returns; we narrow at
	// call sites via `(result as { meta?: { changes?: number } }).meta?.changes`.
	run(): Promise<unknown>;
}

export type DispatchResult =
	| { handled: true; status: "processed"; action: string }
	| { handled: false; status: "ignored"; reason: string };

/**
 * Dispatch on the relevant Stripe event types and advance `subscriptions`
 * row state accordingly. Idempotency is enforced upstream by the
 * webhooks_inbox UNIQUE(provider, external_event_id) constraint plus an
 * `INSERT OR IGNORE` insert in the route handler.
 *
 * Returns `handled: true` for events that mutated the DB; `handled: false`
 * for unknown / no-op events that should be marked `'ignored'` in
 * webhooks_inbox.
 */
export async function dispatchStripeEvent(
	env: EventDispatchEnv,
	db: DispatchDb,
	event: StripeEvent,
): Promise<DispatchResult> {
	const type = event.type ?? "";
	const data = event.data?.object ?? {};

	switch (type) {
		case "checkout.session.completed": {
			return handleCheckoutCompleted(env, db, event, data);
		}
		case "customer.subscription.created":
		case "customer.subscription.updated": {
			return handleSubscriptionUpsert(env, db, event, type, data);
		}
		case "customer.subscription.deleted": {
			return handleSubscriptionDeleted(env, db, event, data);
		}
		case "invoice.payment_failed": {
			return handleInvoicePaymentFailed(env, db, event, data);
		}
		default: {
			return { handled: false, status: "ignored", reason: `unhandled_type:${type}` };
		}
	}
}

async function handleCheckoutCompleted(
	env: EventDispatchEnv,
	db: DispatchDb,
	event: StripeEvent,
	data: Record<string, unknown>,
): Promise<DispatchResult> {
	const metadata = (data.metadata ?? {}) as Record<string, unknown>;
	const workspaceId = stringOrNull(metadata.workspace_id) ?? stringOrNull(data.client_reference_id);
	if (!workspaceId) {
		return { handled: false, status: "ignored", reason: "missing_workspace_id" };
	}

	const stripeCustomerId = stringOrNull(data.customer);
	const stripeSubscriptionId = stringOrNull(data.subscription);
	const planFromMetadata = parsePlan(metadata.plan);
	const plan = planFromMetadata ?? planFromPriceId(env, stringOrNull(extractPriceId(data))) ?? null;

	const sets: string[] = ["status = 'active'", "updated_at = CURRENT_TIMESTAMP"];
	const bindings: Array<string | null> = [];
	if (stripeCustomerId) {
		sets.push("stripe_customer_id = ?");
		bindings.push(stripeCustomerId);
	}
	if (stripeSubscriptionId) {
		sets.push("stripe_subscription_id = ?");
		bindings.push(stripeSubscriptionId);
	}
	if (plan) {
		sets.push("plan = ?");
		bindings.push(plan);
	}
	bindings.push(workspaceId);
	await runStmt(db, `UPDATE subscriptions SET ${sets.join(", ")} WHERE workspace_id = ?`, bindings);
	await insertAuditLog(db, {
		workspaceId,
		action: "billing.checkout_completed",
		entityType: "subscription",
		entityId: stripeSubscriptionId ?? stripeCustomerId ?? workspaceId,
		after: { plan, stripeCustomerId, stripeSubscriptionId, eventId: event.id ?? null },
	});

	return { handled: true, status: "processed", action: "subscription_activated" };
}

async function handleSubscriptionUpsert(
	_env: EventDispatchEnv,
	db: DispatchDb,
	event: StripeEvent,
	type: string,
	data: Record<string, unknown>,
): Promise<DispatchResult> {
	const stripeSubscriptionId = stringOrNull(data.id);
	if (!stripeSubscriptionId) {
		return { handled: false, status: "ignored", reason: "missing_subscription_id" };
	}

	const status = parseStatus(stringOrNull(data.status));
	const currentPeriodEnd = unixToIso(numberOrNull(data.current_period_end));

	const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
	const bindings: Array<string | null> = [];
	if (status) {
		sets.push("status = ?");
		bindings.push(status);
	}
	if (currentPeriodEnd) {
		sets.push("current_period_end = ?");
		bindings.push(currentPeriodEnd);
	}
	bindings.push(stripeSubscriptionId);
	const result = await runStmt(
		db,
		`UPDATE subscriptions SET ${sets.join(", ")} WHERE stripe_subscription_id = ?`,
		bindings,
	);

	// If the row is missing (e.g. created event arriving before checkout
	// completion stored the id), fall back to a scoped UPDATE via
	// stripe_customer_id. Stripe's "created" event includes the customer.
	const rowsChanged = (result as { meta?: { changes?: number } } | undefined)?.meta?.changes ?? 0;
	if (rowsChanged === 0) {
		const stripeCustomerId = stringOrNull(data.customer);
		if (stripeCustomerId) {
			const fallbackSets: string[] = [
				"stripe_subscription_id = ?",
				"updated_at = CURRENT_TIMESTAMP",
			];
			const fallbackBindings: Array<string | null> = [stripeSubscriptionId];
			if (status) {
				fallbackSets.push("status = ?");
				fallbackBindings.push(status);
			}
			if (currentPeriodEnd) {
				fallbackSets.push("current_period_end = ?");
				fallbackBindings.push(currentPeriodEnd);
			}
			fallbackBindings.push(stripeCustomerId);
			await runStmt(
				db,
				`UPDATE subscriptions SET ${fallbackSets.join(", ")} WHERE stripe_customer_id = ?`,
				fallbackBindings,
			);
		}
	}

	await insertAuditLog(db, {
		action:
			type === "customer.subscription.created"
				? "billing.subscription_created"
				: "billing.subscription_updated",
		entityType: "subscription",
		entityId: stripeSubscriptionId,
		after: { status, currentPeriodEnd, eventId: event.id ?? null },
	});

	return { handled: true, status: "processed", action: type };
}

async function handleSubscriptionDeleted(
	_env: EventDispatchEnv,
	db: DispatchDb,
	event: StripeEvent,
	data: Record<string, unknown>,
): Promise<DispatchResult> {
	const stripeSubscriptionId = stringOrNull(data.id);
	if (!stripeSubscriptionId) {
		return { handled: false, status: "ignored", reason: "missing_subscription_id" };
	}

	await runStmt(
		db,
		`UPDATE subscriptions
		 SET status = 'canceled', updated_at = CURRENT_TIMESTAMP
		 WHERE stripe_subscription_id = ?`,
		[stripeSubscriptionId],
	);
	await insertAuditLog(db, {
		action: "billing.subscription_canceled",
		entityType: "subscription",
		entityId: stripeSubscriptionId,
		after: { eventId: event.id ?? null },
		metadata: { reason: stringOrNull(data.cancellation_reason) ?? "stripe_event" },
	});

	return { handled: true, status: "processed", action: "subscription_canceled" };
}

async function handleInvoicePaymentFailed(
	_env: EventDispatchEnv,
	db: DispatchDb,
	event: StripeEvent,
	data: Record<string, unknown>,
): Promise<DispatchResult> {
	const stripeSubscriptionId = stringOrNull(data.subscription);
	const stripeCustomerId = stringOrNull(data.customer);
	if (!stripeSubscriptionId && !stripeCustomerId) {
		return { handled: false, status: "ignored", reason: "missing_subscription_or_customer" };
	}

	if (stripeSubscriptionId) {
		await runStmt(
			db,
			`UPDATE subscriptions
			 SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
			 WHERE stripe_subscription_id = ?`,
			[stripeSubscriptionId],
		);
	} else if (stripeCustomerId) {
		await runStmt(
			db,
			`UPDATE subscriptions
			 SET status = 'past_due', updated_at = CURRENT_TIMESTAMP
			 WHERE stripe_customer_id = ?`,
			[stripeCustomerId],
		);
	}

	await insertAuditLog(db, {
		action: "billing.invoice_payment_failed",
		entityType: "subscription",
		entityId: stripeSubscriptionId ?? stripeCustomerId,
		after: { eventId: event.id ?? null },
		metadata: { invoiceId: stringOrNull(data.id) },
	});

	return { handled: true, status: "processed", action: "subscription_past_due" };
}

// --- helpers ---

interface AuditLogInput {
	workspaceId?: string | null;
	brandId?: string | null;
	userId?: string | null;
	action: string;
	entityType: string;
	entityId?: string | null;
	before?: unknown;
	after?: unknown;
	metadata?: Record<string, unknown>;
}

async function insertAuditLog(db: DispatchDb, input: AuditLogInput): Promise<void> {
	await runStmt(
		db,
		`INSERT INTO audit_logs (
			id, workspace_id, brand_id, user_id, action, entity_type, entity_id,
			before_json, after_json, metadata_json
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			createId("audit"),
			input.workspaceId ?? null,
			input.brandId ?? null,
			input.userId ?? null,
			input.action,
			input.entityType,
			input.entityId ?? null,
			input.before === undefined ? null : JSON.stringify(input.before),
			input.after === undefined ? null : JSON.stringify(input.after),
			JSON.stringify(input.metadata ?? {}),
		],
	);
}

async function runStmt(
	db: DispatchDb,
	sql: string,
	bindings: ReadonlyArray<unknown>,
): Promise<unknown> {
	const stmt = db.prepare(sql).bind(...bindings);
	return stmt.run();
}

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

function numberOrNull(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function unixToIso(seconds: number | null): string | null {
	if (seconds === null) {
		return null;
	}
	return new Date(seconds * 1000).toISOString();
}

function parseStatus(value: string | null): SubscriptionStatus | null {
	if (
		value === "trialing" ||
		value === "active" ||
		value === "past_due" ||
		value === "canceled" ||
		value === "incomplete"
	) {
		return value;
	}
	if (value === "incomplete_expired" || value === "unpaid") {
		// Stripe-only granularity that the schema CHECK (status IN ...) does not
		// allow. Map to the closest valid value so the row update succeeds.
		return value === "unpaid" ? "past_due" : "incomplete";
	}
	return null;
}

function parsePlan(value: unknown): SubscriptionPlan | null {
	if (value === "starter" || value === "growth" || value === "agency" || value === "managed") {
		return value;
	}
	return null;
}

function extractPriceId(data: Record<string, unknown>): string | null {
	const items = (data.items ?? data.subscription_details ?? null) as Record<string, unknown> | null;
	if (!items) {
		// Checkout session uses a different shape: line_items via separate API.
		// We accept the metadata.plan path; price_id mapping is best-effort only.
		return null;
	}
	const list = (items.data ?? null) as Array<Record<string, unknown>> | null;
	const first = Array.isArray(list) && list.length > 0 ? list[0] : null;
	if (!first) {
		return null;
	}
	const price = first.price as Record<string, unknown> | undefined;
	return stringOrNull(price?.id);
}

function planFromPriceId(env: EventDispatchEnv, priceId: string | null): SubscriptionPlan | null {
	if (!priceId) {
		return null;
	}
	if (priceId === env.STRIPE_PRICE_STARTER) {
		return "starter";
	}
	if (priceId === env.STRIPE_PRICE_GROWTH) {
		return "growth";
	}
	if (priceId === env.STRIPE_PRICE_AGENCY) {
		return "agency";
	}
	if (priceId === env.STRIPE_PRICE_MANAGED) {
		return "managed";
	}
	return null;
}
