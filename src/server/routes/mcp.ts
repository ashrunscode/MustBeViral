import { Hono } from "hono";
import { z } from "zod";

import { getDb } from "../db/client";
import { dbAll } from "../db/sql";
import { errorEnvelope, successEnvelope } from "../http/envelope";
import type { AppHonoContext } from "../http/types";
import { parseJsonBody } from "../http/validation";
import { requireAuth } from "../middleware/auth";
import { requireAdmin } from "../middleware/rbac";
import { REQUIRED_TABLES } from "../db/schema";

export const mcpRoutes = new Hono<AppHonoContext>();

const querySchema = z.object({
	tool: z.enum([
		"list_tables",
		"describe_table",
		"query_readonly",
		"list_brands",
		"get_agent_runs",
		"get_failed_jobs",
		"get_usage_costs",
		"get_pending_approvals",
		"get_scheduler_status",
		"get_weekly_reports",
	]),
	input: z.record(z.string(), z.unknown()).optional(),
});

mcpRoutes.use("*", requireAuth(), requireAdmin());

mcpRoutes.get("/tools", (c) => {
	const requestId = c.get("requestId");
	return c.json(
		successEnvelope(
			{
				mode: "read_only",
				tools: querySchema.shape.tool.options,
			},
			requestId,
		),
	);
});

mcpRoutes.post("/query", async (c) => {
	const requestId = c.get("requestId");
	const parsed = await parseJsonBody(c, querySchema);
	if (!parsed.ok) {
		return parsed.response;
	}

	const db = getDb(c.env);
	const input = parsed.data.input ?? {};
	const result = await runReadOnlyTool(db, parsed.data.tool, input);
	if (!result.ok) {
		return c.json(errorEnvelope(result.code, result.message, requestId), 400);
	}
	return c.json(successEnvelope({ result: result.data }, requestId));
});

async function runReadOnlyTool(
	db: D1Database,
	tool: z.infer<typeof querySchema>["tool"],
	input: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | { ok: false; code: string; message: string }> {
	if (tool === "list_tables") {
		return { ok: true, data: REQUIRED_TABLES };
	}
	if (tool === "describe_table") {
		const table = typeof input.table === "string" ? input.table : "";
		if (!isKnownTable(table)) {
			return { ok: false, code: "INVALID_TABLE", message: "Table is not in the read-only allowlist." };
		}
		return { ok: true, data: await dbAll(db, `PRAGMA table_info(${table})`) };
	}
	if (tool === "query_readonly") {
		const sql = typeof input.sql === "string" ? input.sql.trim().replace(/;$/, "") : "";
		if (!/^SELECT\b/i.test(sql) || /;\s*\S/.test(sql) || /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE)\b/i.test(sql)) {
			return { ok: false, code: "INVALID_QUERY", message: "Only a single read-only SELECT statement is allowed." };
		}
		return { ok: true, data: await dbAll(db, `${sql} LIMIT 100`) };
	}
	if (tool === "list_brands") {
		return { ok: true, data: await dbAll(db, "SELECT id, workspace_id, name, status, onboarding_status FROM brands LIMIT 100") };
	}
	if (tool === "get_agent_runs") {
		return { ok: true, data: await dbAll(db, "SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT 100") };
	}
	if (tool === "get_failed_jobs") {
		return { ok: true, data: await dbAll(db, "SELECT * FROM workflow_runs WHERE status IN ('failed', 'waiting_manual') ORDER BY updated_at DESC LIMIT 100") };
	}
	if (tool === "get_usage_costs") {
		return { ok: true, data: await dbAll(db, "SELECT event_type, provider, model, SUM(quantity) AS quantity, SUM(cost_estimate_cents) AS cost_cents FROM usage_events GROUP BY event_type, provider, model LIMIT 100") };
	}
	if (tool === "get_pending_approvals") {
		return { ok: true, data: await dbAll(db, "SELECT * FROM content_posts WHERE status = 'pending_approval' ORDER BY scheduled_at ASC LIMIT 100") };
	}
	if (tool === "get_scheduler_status") {
		return { ok: true, data: await dbAll(db, "SELECT * FROM scheduled_posts ORDER BY created_at DESC LIMIT 100") };
	}
	return { ok: true, data: await dbAll(db, "SELECT * FROM weekly_reports ORDER BY week_start DESC LIMIT 100") };
}

function isKnownTable(table: string): boolean {
	return REQUIRED_TABLES.includes(table as (typeof REQUIRED_TABLES)[number]);
}
