import { Hono } from "hono";

import { getDb } from "../db/client";
import { dbAll, dbFirst } from "../db/sql";
import { successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";

export const adminRoutes = new Hono<AppHonoContext>();

adminRoutes.use("*", requireAuth(), requireAdmin());

adminRoutes.get("/overview", async (c) => {
	const requestId = c.get("requestId");
	const db = getDb(c.env);
	const counts = {
		users: await count(db, "users"),
		workspaces: await count(db, "workspaces"),
		brands: await count(db, "brands"),
		pendingApprovals: await countWhere(db, "content_posts", "status = 'pending_approval'"),
		failedWorkflows: await countWhere(db, "workflow_runs", "status = 'failed'"),
	};
	const failedJobs = await dbAll(
		db,
		`SELECT id, workflow_name, brand_id, status, progress, error_message, created_at, updated_at
		FROM workflow_runs
		WHERE status IN ('failed', 'waiting_manual')
		ORDER BY updated_at DESC
		LIMIT 20`,
	);
	const usage = await dbAll(
		db,
		`SELECT provider, model, event_type, SUM(quantity) AS quantity, SUM(cost_estimate_cents) AS cost_cents
		FROM usage_events
		GROUP BY provider, model, event_type
		ORDER BY cost_cents DESC
		LIMIT 20`,
	);
	return c.json(successEnvelope({ counts, failedJobs, usage }, requestId));
});

async function count(db: D1Database, table: string): Promise<number> {
	const row = await dbFirst<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ${table}`);
	return row?.count ?? 0;
}

async function countWhere(db: D1Database, table: string, where: string): Promise<number> {
	const row = await dbFirst<{ count: number }>(db, `SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`);
	return row?.count ?? 0;
}
