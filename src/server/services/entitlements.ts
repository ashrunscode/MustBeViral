export type Plan = "starter" | "growth" | "agency" | "managed";
export type CapType = "brands" | "content_posts_per_month" | "ai_requests_per_month";

export interface CapResult {
	allowed: boolean;
	used: number;
	limit: number;
	plan: Plan;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

/**
 * Plan limits enforced at the API boundary. Numbers are deliberately
 * conservative for Phase 1; Sprint 4.4 / audit gap H-11. The "managed" tier
 * is treated as unlimited until contract caps are negotiated.
 */
const PLAN_LIMITS: Record<Plan, Record<CapType, number>> = {
	starter: { brands: 1, content_posts_per_month: 50, ai_requests_per_month: 100 },
	growth: { brands: 5, content_posts_per_month: 500, ai_requests_per_month: 2000 },
	agency: { brands: 15, content_posts_per_month: 2000, ai_requests_per_month: 10000 },
	managed: {
		brands: UNLIMITED,
		content_posts_per_month: UNLIMITED,
		ai_requests_per_month: UNLIMITED,
	},
};

/**
 * Minimal `D1Database` surface used by the entitlements service. Defined
 * structurally so this file compiles in both the cloudflare and node TS
 * projects (the latter owns the unit tests). Real `D1Database` from
 * worker-configuration.d.ts is structurally compatible — call sites in
 * routes/* pass `getDb(c.env)` unchanged.
 */
export interface EntitlementsDb {
	prepare(sql: string): EntitlementsPreparedStatement;
}

export interface EntitlementsPreparedStatement {
	bind(...values: ReadonlyArray<unknown>): EntitlementsPreparedStatement;
	first<T extends Record<string, unknown>>(): Promise<T | null>;
}

interface SubscriptionRow extends Record<string, unknown> {
	plan: Plan;
	status: string;
}

export async function getWorkspacePlan(db: EntitlementsDb, workspaceId: string): Promise<Plan> {
	const row = await db
		.prepare("SELECT plan, status FROM subscriptions WHERE workspace_id = ? LIMIT 1")
		.bind(workspaceId)
		.first<SubscriptionRow>();
	if (!row) {
		return "starter";
	}
	// Cancelled / incomplete subscriptions revert to starter caps so a churned
	// workspace cannot keep using paid-tier capacity.
	if (row.status === "canceled" || row.status === "incomplete") {
		return "starter";
	}
	return row.plan;
}

export async function checkBrandCap(db: EntitlementsDb, workspaceId: string): Promise<CapResult> {
	const plan = await getWorkspacePlan(db, workspaceId);
	const limit = PLAN_LIMITS[plan].brands;
	const row = await db
		.prepare("SELECT COUNT(*) AS count FROM brands WHERE workspace_id = ? AND deleted_at IS NULL")
		.bind(workspaceId)
		.first<{ count: number }>();
	const used = row?.count ?? 0;
	return { allowed: used < limit, used, limit, plan };
}

export async function checkAiRequestCap(
	db: EntitlementsDb,
	workspaceId: string,
): Promise<CapResult> {
	const plan = await getWorkspacePlan(db, workspaceId);
	const limit = PLAN_LIMITS[plan].ai_requests_per_month;
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS count
			FROM usage_events
			WHERE workspace_id = ?
				AND provider IN ('mock', 'workers_ai', 'external')
				AND created_at >= strftime('%Y-%m-01 00:00:00', 'now')`,
		)
		.bind(workspaceId)
		.first<{ count: number }>();
	const used = row?.count ?? 0;
	return { allowed: used < limit, used, limit, plan };
}

export async function checkPostCap(db: EntitlementsDb, workspaceId: string): Promise<CapResult> {
	const plan = await getWorkspacePlan(db, workspaceId);
	const limit = PLAN_LIMITS[plan].content_posts_per_month;
	const row = await db
		.prepare(
			`SELECT COUNT(*) AS count
			FROM content_posts cp
			INNER JOIN brands b ON b.id = cp.brand_id
			WHERE b.workspace_id = ?
				AND cp.created_at >= strftime('%Y-%m-01 00:00:00', 'now')`,
		)
		.bind(workspaceId)
		.first<{ count: number }>();
	const used = row?.count ?? 0;
	return { allowed: used < limit, used, limit, plan };
}

export function planLimitsForTesting(): typeof PLAN_LIMITS {
	return PLAN_LIMITS;
}
