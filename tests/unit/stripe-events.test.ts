import { describe, expect, it } from "vitest";

import {
	dispatchStripeEvent,
	type DispatchDb,
	type DispatchPreparedStatement,
	type EventDispatchEnv,
	type StripeEvent,
} from "../../src/server/services/stripe/events";

interface RecordedStatement {
	sql: string;
	bindings: ReadonlyArray<unknown>;
}

// Tiny fake D1 that records every prepare/bind/run call. Sufficient to assert
// which UPDATE the dispatcher fires; we don't need real row state.
function makeFakeDb(): { db: DispatchDb; statements: RecordedStatement[] } {
	const statements: RecordedStatement[] = [];

	function buildPreparedStatement(
		sql: string,
		bindings: ReadonlyArray<unknown>,
	): DispatchPreparedStatement {
		return {
			bind(...more: ReadonlyArray<unknown>): DispatchPreparedStatement {
				return buildPreparedStatement(sql, [...bindings, ...more]);
			},
			run(): Promise<{ meta?: { changes?: number } }> {
				statements.push({ sql, bindings });
				return Promise.resolve({ meta: { changes: 1 } });
			},
		};
	}

	const db: DispatchDb = {
		prepare(sql: string): DispatchPreparedStatement {
			return buildPreparedStatement(sql, []);
		},
	};
	return { db, statements };
}

const baseEnv: EventDispatchEnv = {
	STRIPE_PRICE_STARTER: "price_starter",
	STRIPE_PRICE_GROWTH: "price_growth",
	STRIPE_PRICE_AGENCY: "price_agency",
	STRIPE_PRICE_MANAGED: "price_managed",
};

describe("Stripe webhook event dispatcher", () => {
	it("activates a subscription on checkout.session.completed with workspace metadata", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_1",
			type: "checkout.session.completed",
			data: {
				object: {
					id: "cs_test",
					customer: "cus_123",
					subscription: "sub_456",
					mode: "subscription",
					metadata: { workspace_id: "ws_42", plan: "growth", user_id: "usr_1" },
				},
			},
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result).toEqual({
			handled: true,
			status: "processed",
			action: "subscription_activated",
		});
		const update = statements.find((s) => /UPDATE subscriptions/.test(s.sql));
		expect(update).toBeDefined();
		expect(update?.sql).toMatch(/SET .*status = 'active'/);
		expect(update?.bindings).toContain("growth");
		expect(update?.bindings).toContain("cus_123");
		expect(update?.bindings).toContain("sub_456");
		expect(update?.bindings).toContain("ws_42");
	});

	it("ignores checkout.session.completed without workspace context", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_2",
			type: "checkout.session.completed",
			data: { object: { id: "cs_test", customer: "cus_x" } },
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result).toEqual({
			handled: false,
			status: "ignored",
			reason: "missing_workspace_id",
		});
		expect(statements.some((s) => /UPDATE subscriptions/.test(s.sql))).toBe(false);
	});

	it("advances status on customer.subscription.updated", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_3",
			type: "customer.subscription.updated",
			data: {
				object: {
					id: "sub_456",
					customer: "cus_123",
					status: "past_due",
					current_period_end: 1_900_000_000,
				},
			},
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result).toEqual({
			handled: true,
			status: "processed",
			action: "customer.subscription.updated",
		});
		const update = statements.find(
			(s) => /UPDATE subscriptions/.test(s.sql) && /stripe_subscription_id/.test(s.sql),
		);
		expect(update).toBeDefined();
		expect(update?.bindings).toContain("past_due");
		expect(update?.bindings).toContain("sub_456");
	});

	it("cancels a subscription on customer.subscription.deleted", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_4",
			type: "customer.subscription.deleted",
			data: { object: { id: "sub_456", cancellation_reason: "cancellation_requested" } },
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result).toEqual({
			handled: true,
			status: "processed",
			action: "subscription_canceled",
		});
		const update = statements.find((s) => /SET status = 'canceled'/.test(s.sql));
		expect(update).toBeDefined();
		expect(update?.bindings).toContain("sub_456");
	});

	it("marks a subscription past_due on invoice.payment_failed", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_5",
			type: "invoice.payment_failed",
			data: { object: { id: "in_1", subscription: "sub_456", customer: "cus_123" } },
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result).toEqual({
			handled: true,
			status: "processed",
			action: "subscription_past_due",
		});
		const update = statements.find((s) => /SET status = 'past_due'/.test(s.sql));
		expect(update).toBeDefined();
		expect(update?.bindings).toContain("sub_456");
	});

	it("ignores unknown event types", async () => {
		const { db, statements } = makeFakeDb();
		const event: StripeEvent = {
			id: "evt_6",
			type: "customer.created",
			data: { object: { id: "cus_x" } },
		};

		const result = await dispatchStripeEvent(baseEnv, db, event);
		expect(result.status).toBe("ignored");
		if (!result.handled) {
			expect(result.reason).toBe("unhandled_type:customer.created");
		}
		expect(statements.some((s) => /UPDATE subscriptions/.test(s.sql))).toBe(false);
	});
});
